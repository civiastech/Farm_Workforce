import {
  CONTACT_VISIBLE_STATUSES,
  applicationInputSchema,
  jobInputSchema,
  jobSearchSchema,
  jobUpdateSchema,
  reportInputSchema,
  uuidSchema,
  type Applicant,
  type ApplicationStatus,
  type EmployerJob,
  type JobDetail,
  type Paginated,
  type PlatformStats,
  type JobSummary,
} from "@fwp/shared";
import { and, count, desc, eq, ilike, inArray, isNotNull, ne, or, sql, type SQL } from "drizzle-orm";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { applications, employerProfiles, jobs, reports, users, workerProfiles } from "../db/schema";
import { audit } from "../lib/audit";
import { AppError, badRequest, notFound } from "../lib/errors";
import { parse } from "../lib/validation";
import { requireRole, requireUser } from "../plugins/auth";
import { jobSummaryColumns, likePattern, listingExpiry, toJobSummary } from "../services/jobs";

// ~22 working days or ~4.33 weeks per month.
const monthlyPayMax = sql`case ${jobs.payPeriod} when 'day' then ${jobs.payMax} * 22 when 'week' then ${jobs.payMax} * 13 / 3 else ${jobs.payMax} end`;

export const jobRoutes: FastifyPluginAsync = async (app) => {
  const parseId = (request: FastifyRequest) => parse(uuidSchema, (request.params as { id?: string }).id);

  async function findJob(id: string) {
    const [row] = await app.db
      .select({
        job: jobs,
        organisationName: employerProfiles.organisationName,
        verifiedAt: employerProfiles.verifiedAt,
      })
      .from(jobs)
      .innerJoin(employerProfiles, eq(employerProfiles.userId, jobs.employerId))
      .where(eq(jobs.id, id))
      .limit(1);
    return row;
  }

  app.get("/stats", async (): Promise<PlatformStats> => {
    const [[openJobs], [employers], [workers]] = await Promise.all([
      app.db.select({ n: count() }).from(jobs).where(eq(jobs.status, "open")),
      app.db.select({ n: count() }).from(employerProfiles),
      app.db.select({ n: count() }).from(workerProfiles),
    ]);
    return { openJobs: openJobs?.n ?? 0, employers: employers?.n ?? 0, workers: workers?.n ?? 0 };
  });

  app.get("/jobs", async (request): Promise<Paginated<JobSummary>> => {
    const query = parse(jobSearchSchema, request.query);
    const filters: SQL[] = [eq(jobs.status, "open")];
    if (query.category) filters.push(eq(jobs.category, query.category));
    if (query.state) filters.push(eq(jobs.state, query.state));
    if (query.employmentType) filters.push(eq(jobs.employmentType, query.employmentType));
    if (query.q) {
      const pattern = likePattern(query.q);
      filters.push(
        or(
          ilike(jobs.title, pattern),
          ilike(jobs.description, pattern),
          ilike(jobs.town, pattern),
          ilike(employerProfiles.organisationName, pattern),
        )!,
      );
    }
    const where = and(...filters);

    const [rows, [total]] = await Promise.all([
      app.db
        .select(jobSummaryColumns)
        .from(jobs)
        .innerJoin(employerProfiles, eq(employerProfiles.userId, jobs.employerId))
        .where(where)
        .orderBy(
          ...(query.sort === "pay" ? [desc(monthlyPayMax)] : []),
          desc(jobs.publishedAt),
          desc(jobs.id),
        )
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      app.db
        .select({ n: count() })
        .from(jobs)
        .innerJoin(employerProfiles, eq(employerProfiles.userId, jobs.employerId))
        .where(where),
    ]);

    const totalCount = total?.n ?? 0;
    return {
      items: rows.map(toJobSummary),
      page: query.page,
      pageSize: query.pageSize,
      total: totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / query.pageSize)),
    };
  });

  app.get("/jobs/:id", async (request): Promise<JobDetail> => {
    const id = parseId(request);
    const row = await findJob(id);
    const user = request.user;
    const isOwner = !!row && user?.id === row.job.employerId;
    const isAdmin = user?.role === "admin";
    // Open and closed jobs are public; drafts and removed jobs only to their owner and moderators.
    if (!row || (!["open", "closed"].includes(row.job.status) && !isOwner && !isAdmin)) throw notFound("Job");

    let myApplication: JobDetail["myApplication"] = null;
    if (user?.role === "worker") {
      const [application] = await app.db
        .select({ id: applications.id, status: applications.status, createdAt: applications.createdAt })
        .from(applications)
        .where(and(eq(applications.jobId, id), eq(applications.workerId, user.id)));
      if (application) myApplication = { ...application, createdAt: application.createdAt.toISOString() };
    }

    const { job } = row;
    return {
      ...toJobSummary({ ...job, organisationName: row.organisationName, verifiedAt: row.verifiedAt }),
      description: job.description,
      startDate: job.startDate,
      updatedAt: job.updatedAt.toISOString(),
      isOwner,
      myApplication,
    };
  });

  app.post("/jobs", async (request, reply) => {
    const user = requireRole(request, "employer");
    const input = parse(jobInputSchema, request.body);

    const [profile] = await app.db
      .select({ userId: employerProfiles.userId })
      .from(employerProfiles)
      .where(eq(employerProfiles.userId, user.id));
    if (!profile)
      throw new AppError(
        400,
        "employer_profile_required",
        "Complete your organisation profile before posting jobs",
      );

    const [job] = await app.db
      .insert(jobs)
      .values({
        ...input,
        startDate: input.startDate ?? null,
        employerId: user.id,
        publishedAt: input.status === "open" ? new Date() : null,
        expiresAt: input.status === "open" ? listingExpiry() : null,
      })
      .returning({ id: jobs.id });

    await audit(request, { action: "job.created", entityType: "job", entityId: job!.id });
    return reply.status(201).send({ id: job!.id });
  });

  app.patch("/jobs/:id", async (request) => {
    const user = requireRole(request, "employer");
    const id = parseId(request);
    const input = parse(jobUpdateSchema, request.body);

    const [job] = await app.db.select().from(jobs).where(eq(jobs.id, id));
    if (!job || job.employerId !== user.id) throw notFound("Job");
    if (job.status === "removed")
      throw new AppError(403, "job_removed", "This job was removed by a moderator and cannot be edited");

    const payMin = input.payMin ?? job.payMin;
    const payMax = input.payMax ?? job.payMax;
    if (payMax < payMin)
      throw badRequest("Maximum pay must be at least the minimum pay", { payMax: "Too low" });

    await app.db
      .update(jobs)
      .set({
        ...input,
        ...(input.status === "open" && !job.publishedAt ? { publishedAt: new Date() } : {}),
        // Opening, reopening or extending an open job starts a fresh listing period.
        ...(input.status === "open" ? { expiresAt: listingExpiry() } : {}),
      })
      .where(eq(jobs.id, id));

    await audit(request, {
      action: "job.updated",
      entityType: "job",
      entityId: id,
      metadata: { fields: Object.keys(input) },
    });
    return { id };
  });

  app.get("/employer/jobs", async (request): Promise<{ items: EmployerJob[] }> => {
    const user = requireRole(request, "employer");
    const rows = await app.db
      .select(jobSummaryColumns)
      .from(jobs)
      .innerJoin(employerProfiles, eq(employerProfiles.userId, jobs.employerId))
      .where(eq(jobs.employerId, user.id))
      .orderBy(desc(jobs.createdAt));

    const ids = rows.map((r) => r.id);
    const counts = ids.length
      ? await app.db
          .select({ jobId: applications.jobId, status: applications.status, n: count() })
          .from(applications)
          .where(inArray(applications.jobId, ids))
          .groupBy(applications.jobId, applications.status)
      : [];

    const countsByJob = new Map<string, Partial<Record<ApplicationStatus, number>>>();
    for (const c of counts) {
      const entry = countsByJob.get(c.jobId) ?? {};
      entry[c.status] = c.n;
      countsByJob.set(c.jobId, entry);
    }

    return {
      items: rows.map((row) => ({ ...toJobSummary(row), applicationCounts: countsByJob.get(row.id) ?? {} })),
    };
  });

  app.get("/employer/jobs/:id/applications", async (request): Promise<{ items: Applicant[] }> => {
    const user = requireRole(request, "employer", "admin");
    const id = parseId(request);
    const [job] = await app.db.select({ employerId: jobs.employerId }).from(jobs).where(eq(jobs.id, id));
    if (!job || (user.role !== "admin" && job.employerId !== user.id)) throw notFound("Job");

    const rows = await app.db
      .select({
        application: applications,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        profile: workerProfiles,
      })
      .from(applications)
      .innerJoin(users, eq(users.id, applications.workerId))
      .leftJoin(workerProfiles, eq(workerProfiles.userId, applications.workerId))
      .where(and(eq(applications.jobId, id), ne(applications.status, "withdrawn")))
      .orderBy(desc(applications.createdAt));

    return {
      items: rows.map(({ application, profile, ...worker }) => {
        // Privacy by default: contact details are shared only once the employer shortlists.
        const showContact = CONTACT_VISIBLE_STATUSES.includes(application.status);
        return {
          id: application.id,
          status: application.status,
          coverNote: application.coverNote,
          createdAt: application.createdAt.toISOString(),
          worker: {
            fullName: worker.fullName,
            state: profile?.state ?? null,
            town: profile?.town ?? null,
            primaryCategory: profile?.primaryCategory ?? null,
            skills: profile?.skills ?? [],
            yearsExperience: profile?.yearsExperience ?? null,
            bio: profile?.bio ?? null,
            phone: showContact ? worker.phone : null,
            email: showContact ? worker.email : null,
          },
        };
      }),
    };
  });

  app.post("/jobs/:id/applications", async (request, reply) => {
    const user = requireRole(request, "worker");
    const id = parseId(request);
    const input = parse(applicationInputSchema, request.body);

    const [profile] = await app.db
      .select({ userId: workerProfiles.userId })
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, user.id));
    if (!profile)
      throw new AppError(400, "worker_profile_required", "Complete your worker profile before applying");

    const [job] = await app.db.select({ status: jobs.status }).from(jobs).where(eq(jobs.id, id));
    if (!job) throw notFound("Job");
    if (job.status !== "open")
      throw new AppError(400, "job_closed", "This job is no longer accepting applications");

    // A worker who withdrew may apply again; any other existing application is a duplicate.
    const [application] = await app.db
      .insert(applications)
      .values({ jobId: id, workerId: user.id, coverNote: input.coverNote ?? null })
      .onConflictDoUpdate({
        target: [applications.jobId, applications.workerId],
        set: { status: "submitted", coverNote: input.coverNote ?? null, updatedAt: new Date() },
        setWhere: eq(applications.status, "withdrawn"),
      })
      .returning({ id: applications.id });
    if (!application) throw new AppError(409, "already_applied", "You have already applied for this job");

    await audit(request, {
      action: "application.submitted",
      entityType: "application",
      entityId: application.id,
    });
    return reply.status(201).send({ id: application.id });
  });

  app.post(
    "/jobs/:id/reports",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const user = requireUser(request);
      const id = parseId(request);
      const input = parse(reportInputSchema, request.body);

      const [job] = await app.db
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.id, id), isNotNull(jobs.publishedAt)));
      if (!job) throw notFound("Job");

      const [report] = await app.db
        .insert(reports)
        .values({ jobId: id, reporterId: user.id, reason: input.reason, details: input.details ?? null })
        .returning({ id: reports.id });

      await audit(request, { action: "report.created", entityType: "report", entityId: report!.id });
      return reply.status(201).send({ id: report!.id });
    },
  );
};
