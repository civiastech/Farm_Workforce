import {
  accountUpdateSchema,
  changePhoneSchema,
  deleteAccountSchema,
  employerProfileSchema,
  workerProfileSchema,
  type ProfileResponse,
  type WorkerApplication,
} from "@fwp/shared";
import { and, desc, eq, ne } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { applications, employerProfiles, jobs, reports, sessions, users, workerProfiles } from "../db/schema";
import { audit } from "../lib/audit";
import { AppError, badRequest } from "../lib/errors";
import { verifyPassword } from "../lib/password";
import { parse } from "../lib/validation";
import { endSession, requireRole, requireUser } from "../plugins/auth";
import { toEmployerProfile, toWorkerProfile } from "../services/profiles";
import { getCurrentUser } from "../services/users";
import { consumeCode } from "../services/verification";
import { emailTaken, phoneTaken } from "./auth";

export const meRoutes: FastifyPluginAsync = async (app) => {
  async function loadProfile(userId: string): Promise<ProfileResponse> {
    const [user, [worker], [employer]] = await Promise.all([
      getCurrentUser(app.db, userId),
      app.db.select().from(workerProfiles).where(eq(workerProfiles.userId, userId)),
      app.db.select().from(employerProfiles).where(eq(employerProfiles.userId, userId)),
    ]);
    return {
      user,
      worker: worker ? toWorkerProfile(worker) : null,
      employer: employer ? toEmployerProfile(employer) : null,
    };
  }

  app.get("/me/profile", async (request) => loadProfile(requireUser(request).id));

  app.put("/me/account", async (request) => {
    const user = requireUser(request);
    const input = parse(accountUpdateSchema, request.body);
    const email = input.email ?? null;

    if (email) {
      const [owner] = await app.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email), ne(users.id, user.id)));
      if (owner) throw emailTaken();
    } else {
      // Every account needs a way to sign in: an email, a phone number, or both.
      const [row] = await app.db.select({ phone: users.phone }).from(users).where(eq(users.id, user.id));
      if (!row?.phone) {
        throw new AppError(400, "email_required", "Add an email address so you can still sign in.", {
          email: "Add an email address so you can still sign in.",
        });
      }
    }

    await app.db
      .update(users)
      .set({ fullName: input.fullName, email, preferredLanguage: input.preferredLanguage })
      .where(eq(users.id, user.id));
    if (email !== user.email) {
      await audit(request, { action: "account.email_changed", entityType: "user", entityId: user.id });
    }
    return loadProfile(user.id);
  });

  // Changing the mobile number needs the code sent to the new number by /auth/phone/code.
  app.put("/me/phone", async (request) => {
    const user = requireUser(request);
    const input = parse(changePhoneSchema, request.body);

    const [owner] = await app.db.select({ id: users.id }).from(users).where(eq(users.phone, input.phone));
    if (owner) throw phoneTaken();
    await consumeCode(app, { phone: input.phone, purpose: "change_phone", code: input.code });

    await app.db
      .update(users)
      .set({ phone: input.phone, phoneVerifiedAt: new Date() })
      .where(eq(users.id, user.id));
    await audit(request, { action: "account.phone_changed", entityType: "user", entityId: user.id });
    return loadProfile(user.id);
  });

  app.put("/me/profile", async (request) => {
    const user = requireRole(request, "worker", "employer");

    if (user.role === "worker") {
      const input = parse(workerProfileSchema, request.body);
      const skills = [...new Set(input.skills.map((s) => s.toLowerCase()))];
      const values = { ...input, skills, town: input.town ?? null, bio: input.bio ?? null };
      await app.db
        .insert(workerProfiles)
        .values({ userId: user.id, ...values })
        .onConflictDoUpdate({ target: workerProfiles.userId, set: { ...values, updatedAt: new Date() } });
    } else {
      const input = parse(employerProfileSchema, request.body);
      const values = { ...input, town: input.town ?? null, description: input.description ?? null };
      await app.db
        .insert(employerProfiles)
        .values({ userId: user.id, ...values })
        .onConflictDoUpdate({ target: employerProfiles.userId, set: { ...values, updatedAt: new Date() } });
    }

    await audit(request, { action: "profile.updated", entityType: "user", entityId: user.id });
    return loadProfile(user.id);
  });

  app.get("/me/applications", async (request): Promise<{ items: WorkerApplication[] }> => {
    const user = requireRole(request, "worker");
    const rows = await app.db
      .select({
        application: applications,
        job: {
          id: jobs.id,
          title: jobs.title,
          state: jobs.state,
          town: jobs.town,
          status: jobs.status,
          payMin: jobs.payMin,
          payMax: jobs.payMax,
          payPeriod: jobs.payPeriod,
        },
        organisationName: employerProfiles.organisationName,
      })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .leftJoin(employerProfiles, eq(employerProfiles.userId, jobs.employerId))
      .where(eq(applications.workerId, user.id))
      .orderBy(desc(applications.createdAt));

    return {
      items: rows.map(({ application, job, organisationName }) => ({
        id: application.id,
        status: application.status,
        coverNote: application.coverNote,
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
        job: { ...job, organisationName: organisationName ?? "Employer" },
      })),
    };
  });

  // Data portability: everything we hold about the account, as JSON.
  app.get("/me/export", async (request, reply) => {
    const user = requireUser(request);
    const [account] = await app.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        fullName: users.fullName,
        phone: users.phone,
        phoneVerifiedAt: users.phoneVerifiedAt,
        preferredLanguage: users.preferredLanguage,
        termsAcceptedAt: users.termsAcceptedAt,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, user.id));

    const [workerProfile, employerProfile, myApplications, myJobs, myReports, mySessions] = await Promise.all(
      [
        app.db.select().from(workerProfiles).where(eq(workerProfiles.userId, user.id)),
        app.db.select().from(employerProfiles).where(eq(employerProfiles.userId, user.id)),
        app.db.select().from(applications).where(eq(applications.workerId, user.id)),
        app.db.select().from(jobs).where(eq(jobs.employerId, user.id)),
        app.db.select().from(reports).where(eq(reports.reporterId, user.id)),
        app.db
          .select({
            createdAt: sessions.createdAt,
            lastSeenAt: sessions.lastSeenAt,
            userAgent: sessions.userAgent,
          })
          .from(sessions)
          .where(eq(sessions.userId, user.id)),
      ],
    );

    await audit(request, { action: "account.exported" });
    reply.header("Content-Disposition", 'attachment; filename="farm-workforce-data.json"');
    return {
      exportedAt: new Date().toISOString(),
      account,
      workerProfile: workerProfile[0] ?? null,
      employerProfile: employerProfile[0] ?? null,
      applications: myApplications,
      jobs: myJobs,
      reports: myReports,
      sessions: mySessions,
    };
  });

  app.delete("/me", async (request, reply) => {
    const user = requireUser(request);
    if (user.role === "admin") throw badRequest("Admin accounts must be removed by another administrator");
    const { password } = parse(deleteAccountSchema, request.body);

    const [row] = await app.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.id));
    if (!row || !(await verifyPassword(password, row.passwordHash))) {
      throw new AppError(400, "wrong_password", "Password is incorrect", {
        password: "Password is incorrect",
      });
    }

    await endSession(request, reply);
    // Cascades remove profile, sessions, jobs and applications; reports keep a null reporter.
    await app.db.delete(users).where(eq(users.id, user.id));
    await audit(request, { action: "account.deleted", actorId: null, entityType: "user", entityId: user.id });
    return reply.status(204).send();
  });
};
