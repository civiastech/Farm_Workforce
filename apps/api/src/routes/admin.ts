import {
  employerVerificationSchema,
  paginationSchema,
  reportListSchema,
  reportResolutionSchema,
  uuidSchema,
  type AdminEmployer,
  type AdminReport,
  type Paginated,
} from "@fwp/shared";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { employerProfiles, jobs, reports, users } from "../db/schema";
import { audit } from "../lib/audit";
import { badRequest, notFound } from "../lib/errors";
import { parse } from "../lib/validation";
import { requireRole } from "../plugins/auth";

export const adminRoutes: FastifyPluginAsync = async (app) => {
  const parseId = (request: FastifyRequest) => parse(uuidSchema, (request.params as { id?: string }).id);
  const reporter = alias(users, "reporter");

  app.get("/admin/reports", async (request): Promise<Paginated<AdminReport>> => {
    requireRole(request, "admin");
    const query = parse(reportListSchema, request.query);
    const where = query.status ? eq(reports.status, query.status) : undefined;

    const [rows, [total]] = await Promise.all([
      app.db
        .select({
          report: reports,
          reporter: { id: reporter.id, fullName: reporter.fullName },
          job: jobs,
          organisationName: employerProfiles.organisationName,
        })
        .from(reports)
        .leftJoin(reporter, eq(reporter.id, reports.reporterId))
        .leftJoin(jobs, eq(jobs.id, reports.jobId))
        .leftJoin(employerProfiles, eq(employerProfiles.userId, jobs.employerId))
        .where(where)
        .orderBy(desc(reports.createdAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      app.db.select({ n: count() }).from(reports).where(where),
    ]);

    const totalCount = total?.n ?? 0;
    return {
      items: rows.map(({ report, reporter: r, job, organisationName }) => ({
        id: report.id,
        reason: report.reason,
        details: report.details,
        status: report.status,
        resolutionNote: report.resolutionNote,
        createdAt: report.createdAt.toISOString(),
        resolvedAt: report.resolvedAt?.toISOString() ?? null,
        reporter: r?.id ? { id: r.id, fullName: r.fullName } : null,
        job: job
          ? {
              id: job.id,
              title: job.title,
              status: job.status,
              employerId: job.employerId,
              organisationName: organisationName ?? "Employer",
            }
          : null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total: totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / query.pageSize)),
    };
  });

  app.patch("/admin/reports/:id", async (request) => {
    const admin = requireRole(request, "admin");
    const id = parseId(request);
    const input = parse(reportResolutionSchema, request.body);

    return app.db.transaction(async (tx) => {
      const [report] = await tx
        .update(reports)
        .set({
          status: input.status,
          resolutionNote: input.note ?? null,
          resolvedBy: admin.id,
          resolvedAt: new Date(),
        })
        .where(eq(reports.id, id))
        .returning({ id: reports.id, jobId: reports.jobId });
      if (!report) throw notFound("Report");

      if (input.removeJob) {
        if (!report.jobId) throw badRequest("This report is not linked to a job");
        await tx.update(jobs).set({ status: "removed" }).where(eq(jobs.id, report.jobId));
        await audit(request, { action: "moderation.job_removed", entityType: "job", entityId: report.jobId });
      }
      await audit(request, {
        action: "moderation.report_resolved",
        entityType: "report",
        entityId: id,
        metadata: { status: input.status, removeJob: input.removeJob },
      });
      return { id, status: input.status };
    });
  });

  app.get("/admin/employers", async (request): Promise<Paginated<AdminEmployer>> => {
    requireRole(request, "admin");
    const query = parse(paginationSchema, request.query);

    const openJobs = sql<number>`(select count(*)::int from ${jobs} where ${jobs.employerId} = ${users.id} and ${jobs.status} = 'open')`;
    const [rows, [total]] = await Promise.all([
      app.db
        .select({
          userId: users.id,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
          organisationName: employerProfiles.organisationName,
          state: employerProfiles.state,
          verifiedAt: employerProfiles.verifiedAt,
          createdAt: users.createdAt,
          openJobs,
        })
        .from(employerProfiles)
        .innerJoin(users, eq(users.id, employerProfiles.userId))
        .orderBy(sql`${employerProfiles.verifiedAt} is not null`, desc(users.createdAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      app.db.select({ n: count() }).from(employerProfiles),
    ]);

    const totalCount = total?.n ?? 0;
    return {
      items: rows.map(({ verifiedAt, createdAt, ...row }) => ({
        ...row,
        verified: verifiedAt !== null,
        createdAt: createdAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total: totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / query.pageSize)),
    };
  });

  app.patch("/admin/employers/:id/verification", async (request) => {
    requireRole(request, "admin");
    const id = parseId(request);
    const { verified } = parse(employerVerificationSchema, request.body);

    const [updated] = await app.db
      .update(employerProfiles)
      .set({ verifiedAt: verified ? new Date() : null })
      .where(and(eq(employerProfiles.userId, id)))
      .returning({ userId: employerProfiles.userId });
    if (!updated) throw notFound("Employer");

    await audit(request, {
      action: verified ? "moderation.employer_verified" : "moderation.employer_unverified",
      entityType: "user",
      entityId: id,
    });
    return { userId: id, verified };
  });
};
