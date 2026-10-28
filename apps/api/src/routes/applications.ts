import { applicationStatusUpdateSchema, uuidSchema } from "@fwp/shared";
import { and, eq, inArray } from "drizzle-orm";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { applications, employerProfiles, jobs, users } from "../db/schema";
import { audit } from "../lib/audit";
import { badRequest, notFound } from "../lib/errors";
import { smsText } from "../lib/messages";
import type { OutboxMessage } from "../lib/outbox";
import { parse } from "../lib/validation";
import { requireRole } from "../plugins/auth";

const NOTIFIED_STATUSES = ["shortlisted", "hired", "rejected"] as const;
type NotifiedStatus = (typeof NOTIFIED_STATUSES)[number];
const isNotified = (status: string): status is NotifiedStatus =>
  (NOTIFIED_STATUSES as readonly string[]).includes(status);

const STATUS_EMAIL: Record<NotifiedStatus, (job: string, employer: string) => string> = {
  shortlisted: (job, employer) =>
    `Good news — ${employer} has shortlisted you for "${job}". They can now see your phone number and may contact you directly.`,
  hired: (job, employer) => `Congratulations — ${employer} has marked you as hired for "${job}".`,
  rejected: (job, employer) =>
    `${employer} has decided not to take your application for "${job}" further. Keep going — new jobs are posted regularly.`,
};

export const applicationRoutes: FastifyPluginAsync = async (app) => {
  const parseId = (request: FastifyRequest) => parse(uuidSchema, (request.params as { id?: string }).id);

  app.patch("/applications/:id/status", async (request) => {
    const user = requireRole(request, "employer");
    const id = parseId(request);
    const { status } = parse(applicationStatusUpdateSchema, request.body);

    const [row] = await app.db
      .select({
        application: applications,
        jobTitle: jobs.title,
        employerId: jobs.employerId,
        workerEmail: users.email,
        workerPhone: users.phone,
        workerLanguage: users.preferredLanguage,
        workerName: users.fullName,
        organisationName: employerProfiles.organisationName,
      })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .innerJoin(users, eq(users.id, applications.workerId))
      .innerJoin(employerProfiles, eq(employerProfiles.userId, jobs.employerId))
      .where(eq(applications.id, id));

    if (!row || row.employerId !== user.id) throw notFound("Application");
    if (row.application.status === "withdrawn")
      throw badRequest("The applicant has withdrawn this application");
    if (row.application.status === status) return { id, status };

    // Queue the worker's SMS and email in the same transaction as the change, so neither is lost.
    const messages: OutboxMessage[] = [];
    if (isNotified(status)) {
      const workerId = row.application.workerId;
      if (row.workerPhone) {
        messages.push({
          userId: workerId,
          channel: "sms",
          recipient: row.workerPhone,
          body: smsText(row.workerLanguage, status, {
            employer: row.organisationName,
            job: row.jobTitle,
            url: `${app.config.APP_ORIGIN}/jobs`,
          }),
        });
      }
      if (row.workerEmail) {
        messages.push({
          userId: workerId,
          channel: "email",
          recipient: row.workerEmail,
          subject: `Update on your application: ${row.jobTitle}`,
          body: `Hello ${row.workerName},

${STATUS_EMAIL[status](row.jobTitle, row.organisationName)}

View your applications: ${app.config.APP_ORIGIN}/dashboard/applications`,
        });
      }
    }
    await app.db.transaction(async (tx) => {
      await tx.update(applications).set({ status }).where(eq(applications.id, id));
      await app.outbox.enqueue(messages, tx);
    });
    await audit(request, {
      action: "application.status_changed",
      entityType: "application",
      entityId: id,
      metadata: { from: row.application.status, to: status },
    });

    return { id, status };
  });

  app.post("/applications/:id/withdraw", async (request) => {
    const user = requireRole(request, "worker");
    const id = parseId(request);

    const [updated] = await app.db
      .update(applications)
      .set({ status: "withdrawn" })
      .where(
        and(
          eq(applications.id, id),
          eq(applications.workerId, user.id),
          inArray(applications.status, ["submitted", "shortlisted"]),
        ),
      )
      .returning({ id: applications.id });
    if (!updated) throw notFound("Active application");

    await audit(request, { action: "application.withdrawn", entityType: "application", entityId: id });
    return { id, status: "withdrawn" };
  });
};
