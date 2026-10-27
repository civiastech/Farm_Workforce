import { applicationStatusUpdateSchema, uuidSchema } from "@fwp/shared";
import { and, eq, inArray } from "drizzle-orm";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { applications, employerProfiles, jobs, users } from "../db/schema";
import { audit } from "../lib/audit";
import { badRequest, notFound } from "../lib/errors";
import { parse } from "../lib/validation";
import { requireRole } from "../plugins/auth";

const STATUS_EMAIL: Partial<Record<string, (job: string, employer: string) => string>> = {
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

    await app.db.update(applications).set({ status }).where(eq(applications.id, id));
    await audit(request, {
      action: "application.status_changed",
      entityType: "application",
      entityId: id,
      metadata: { from: row.application.status, to: status },
    });

    const message = STATUS_EMAIL[status]?.(row.jobTitle, row.organisationName);
    if (message) {
      app.mailer
        .send({
          to: row.workerEmail,
          subject: `Update on your application: ${row.jobTitle}`,
          text: `Hello ${row.workerName},\n\n${message}\n\nView your applications: ${app.config.APP_ORIGIN}/dashboard/applications`,
        })
        .catch((error) => request.log.error({ err: error }, "Failed to send application status email"));
    }

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
