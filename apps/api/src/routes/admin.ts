import {
  adminUserListSchema,
  employerVerificationSchema,
  normaliseNigerianPhone,
  notificationListSchema,
  paginationSchema,
  reportListSchema,
  reportResolutionSchema,
  userSuspensionSchema,
  uuidSchema,
  type AdminEmployer,
  type AdminNotification,
  type AdminOverview,
  type AdminReport,
  type AdminUser,
  type Paginated,
} from "@fwp/shared";
import { and, count, desc, eq, gt, ilike, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  applications,
  employerProfiles,
  jobs,
  notifications,
  reports,
  sessions,
  users,
  workerProfiles,
} from "../db/schema";
import { audit } from "../lib/audit";
import { badRequest, notFound } from "../lib/errors";
import { likePattern } from "../services/jobs";
import { parse } from "../lib/validation";
import { requireRole } from "../plugins/auth";

export const adminRoutes: FastifyPluginAsync = async (app) => {
  const parseId = (request: FastifyRequest) => parse(uuidSchema, (request.params as { id?: string }).id);
  const reporter = alias(users, "reporter");

  const daysAgo = (days: number) => sql`now() - make_interval(days => ${days})`;
  const countOf = async (query: Promise<{ n: number }[]>) => (await query)[0]?.n ?? 0;

  app.get("/admin/overview", async (request): Promise<AdminOverview> => {
    requireRole(request, "admin");
    const [
      workers,
      employers,
      signupsLast7Days,
      openJobs,
      applicationsLast7Days,
      hiresLast30Days,
      openReports,
      unverifiedEmployers,
      failedMessages,
      pendingMessages,
    ] = await Promise.all([
      countOf(app.db.select({ n: count() }).from(workerProfiles)),
      countOf(app.db.select({ n: count() }).from(employerProfiles)),
      countOf(
        app.db
          .select({ n: count() })
          .from(users)
          .where(and(ne(users.role, "admin"), gt(users.createdAt, daysAgo(7)))),
      ),
      countOf(app.db.select({ n: count() }).from(jobs).where(eq(jobs.status, "open"))),
      countOf(
        app.db
          .select({ n: count() })
          .from(applications)
          .where(gt(applications.createdAt, daysAgo(7))),
      ),
      countOf(
        app.db
          .select({ n: count() })
          .from(applications)
          .where(and(eq(applications.status, "hired"), gt(applications.updatedAt, daysAgo(30)))),
      ),
      countOf(app.db.select({ n: count() }).from(reports).where(eq(reports.status, "open"))),
      countOf(
        app.db.select({ n: count() }).from(employerProfiles).where(isNull(employerProfiles.verifiedAt)),
      ),
      countOf(app.db.select({ n: count() }).from(notifications).where(eq(notifications.status, "failed"))),
      countOf(
        app.db
          .select({ n: count() })
          .from(notifications)
          .where(and(eq(notifications.status, "pending"), gt(notifications.attempts, 0))),
      ),
    ]);
    return {
      workers,
      employers,
      signupsLast7Days,
      openJobs,
      applicationsLast7Days,
      hiresLast30Days,
      openReports,
      unverifiedEmployers,
      failedMessages,
      pendingMessages,
    };
  });

  app.get("/admin/users", async (request): Promise<Paginated<AdminUser>> => {
    requireRole(request, "admin");
    const query = parse(adminUserListSchema, request.query);
    const filters: SQL[] = [];
    if (query.role) filters.push(eq(users.role, query.role));
    if (query.q) {
      const phone = normaliseNigerianPhone(query.q);
      const pattern = likePattern(query.q);
      filters.push(
        or(
          ilike(users.fullName, pattern),
          ilike(users.email, pattern),
          ...(phone ? [eq(users.phone, phone)] : [ilike(users.phone, pattern)]),
        )!,
      );
    }
    const where = filters.length ? and(...filters) : undefined;

    const [rows, total] = await Promise.all([
      app.db
        .select()
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      countOf(app.db.select({ n: count() }).from(users).where(where)),
    ]);
    return {
      items: rows.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        role: u.role,
        email: u.email,
        phone: u.phone,
        phoneVerified: u.phoneVerifiedAt !== null,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        suspended: u.disabledAt !== null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  });

  /**
   * Suspending signs the user out everywhere, blocks sign-in, and takes an employer's open jobs
   * out of search (as closed, so they can reopen them if the suspension is lifted).
   */
  app.patch("/admin/users/:id/suspension", async (request) => {
    const admin = requireRole(request, "admin");
    const id = parseId(request);
    const { suspended, reason } = parse(userSuspensionSchema, request.body);
    if (id === admin.id) throw badRequest("You can't suspend your own account");

    const closedJobs = await app.db.transaction(async (tx) => {
      const [user] = await tx
        .update(users)
        .set({ disabledAt: suspended ? new Date() : null })
        .where(and(eq(users.id, id), ne(users.role, "admin")))
        .returning({ id: users.id });
      if (!user) throw notFound("User");
      if (!suspended) return 0;
      await tx.delete(sessions).where(eq(sessions.userId, id));
      const closed = await tx
        .update(jobs)
        .set({ status: "closed" })
        .where(and(eq(jobs.employerId, id), eq(jobs.status, "open")))
        .returning({ id: jobs.id });
      return closed.length;
    });

    await audit(request, {
      action: suspended ? "moderation.user_suspended" : "moderation.user_restored",
      entityType: "user",
      entityId: id,
      metadata: { reason: reason ?? null, closedJobs },
    });
    return { id, suspended, closedJobs };
  });

  app.get("/admin/notifications", async (request): Promise<Paginated<AdminNotification>> => {
    requireRole(request, "admin");
    const query = parse(notificationListSchema, request.query);
    // "pending" here means retrying: pending messages that have already failed at least once.
    const where =
      query.status === "pending"
        ? and(eq(notifications.status, "pending"), gt(notifications.attempts, 0))
        : eq(notifications.status, query.status);

    const [rows, total] = await Promise.all([
      app.db
        .select({ notification: notifications, user: { id: users.id, fullName: users.fullName } })
        .from(notifications)
        .leftJoin(users, eq(users.id, notifications.userId))
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      countOf(app.db.select({ n: count() }).from(notifications).where(where)),
    ]);
    return {
      items: rows.map(({ notification: n, user }) => ({
        id: n.id,
        channel: n.channel,
        recipient: n.recipient,
        subject: n.subject,
        body: n.body,
        status: n.status,
        attempts: n.attempts,
        lastError: n.lastError,
        createdAt: n.createdAt.toISOString(),
        sentAt: n.sentAt?.toISOString() ?? null,
        user: user?.id ? { id: user.id, fullName: user.fullName } : null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  });

  /** Puts a failed message back in the queue for another round of attempts. */
  app.post("/admin/notifications/:id/retry", async (request) => {
    requireRole(request, "admin");
    const id = parseId(request);
    const [updated] = await app.db
      .update(notifications)
      .set({ status: "pending", attempts: 0, nextAttemptAt: new Date(), lastError: null })
      .where(and(eq(notifications.id, id), ne(notifications.status, "sent")))
      .returning({ id: notifications.id });
    if (!updated) throw notFound("Failed message");
    await audit(request, {
      action: "moderation.notification_retried",
      entityType: "notification",
      entityId: id,
    });
    return { id, status: "pending" };
  });

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
