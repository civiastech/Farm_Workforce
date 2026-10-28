import { JOB_LISTING_DAYS } from "@fwp/shared";
import { and, eq, inArray, lt, ne, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Database } from "../db/client";
import {
  auditLogs,
  jobs,
  notifications,
  passwordResetTokens,
  sessions,
  users,
  verificationCodes,
} from "../db/schema";
import { smsText } from "./messages";
import type { OutboxMessage } from "./outbox";

const DELIVERY_INTERVAL_MS = 5_000;
const EXPIRY_INTERVAL_MS = 60_000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Closes open jobs whose listing period has ended and tells each employer (email if they have
 * one, otherwise SMS), in the same transaction so the message can't be lost.
 */
export async function closeExpiredJobs(app: FastifyInstance): Promise<number> {
  return app.db.transaction(async (tx) => {
    const closed = await tx
      .update(jobs)
      .set({ status: "closed" })
      .where(and(eq(jobs.status, "open"), lt(jobs.expiresAt, sql`now()`)))
      .returning({ id: jobs.id, title: jobs.title, employerId: jobs.employerId });
    if (closed.length === 0) return 0;

    const employers = await tx
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        language: users.preferredLanguage,
      })
      .from(users)
      .where(inArray(users.id, [...new Set(closed.map((job) => job.employerId))]));
    const byId = new Map(employers.map((employer) => [employer.id, employer]));
    const url = `${app.config.APP_ORIGIN}/dashboard/jobs`;

    const messages: OutboxMessage[] = [];
    for (const job of closed) {
      const employer = byId.get(job.employerId);
      if (!employer) continue;
      if (employer.email) {
        messages.push({
          userId: employer.id,
          channel: "email",
          recipient: employer.email,
          subject: `Your job has closed: ${job.title}`,
          body: [
            `Hello ${employer.fullName},`,
            "",
            `Your job "${job.title}" closed automatically after ${JOB_LISTING_DAYS} days, so it no longer appears in search.`,
            "If you still need workers, reopen it for another 30 days from My jobs:",
            url,
          ].join("\n"),
        });
      } else if (employer.phone) {
        messages.push({
          userId: employer.id,
          channel: "sms",
          recipient: employer.phone,
          body: smsText(employer.language, "jobExpired", { job: job.title, days: JOB_LISTING_DAYS, url }),
        });
      }
    }
    await app.outbox.enqueue(messages, tx);
    await tx
      .insert(auditLogs)
      .values(closed.map((job) => ({ action: "job.expired", entityType: "job", entityId: job.id })));
    return closed.length;
  });
}

/** Deletes data that has no further use: expired sessions, links and codes, and old notifications. */
export async function runCleanup(db: Database) {
  const dayAgo = sql`now() - interval '1 day'`;
  const [expiredSessions, resetTokens, codes, oldNotifications] = await Promise.all([
    db
      .delete(sessions)
      .where(lt(sessions.expiresAt, sql`now()`))
      .returning({ id: sessions.id }),
    db
      .delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, dayAgo))
      .returning({ id: passwordResetTokens.id }),
    db
      .delete(verificationCodes)
      .where(lt(verificationCodes.expiresAt, dayAgo))
      .returning({ id: verificationCodes.id }),
    db
      .delete(notifications)
      .where(
        and(
          ne(notifications.status, "pending"),
          lt(notifications.createdAt, sql`now() - interval '90 days'`),
        ),
      )
      .returning({ id: notifications.id }),
  ]);
  return {
    sessions: expiredSessions.length,
    resetTokens: resetTokens.length,
    verificationCodes: codes.length,
    notifications: oldNotifications.length,
  };
}

/**
 * Runs notification delivery every few seconds and cleanup hourly, inside the API process.
 * Safe with several API instances: delivery claims rows with SKIP LOCKED, and cleanup is idempotent.
 */
export function startBackgroundJobs(app: FastifyInstance): () => void {
  let delivering = false;
  const deliver = async () => {
    if (delivering) return;
    delivering = true;
    try {
      while ((await app.outbox.processDue()) > 0) {
        // Keep going until the queue is drained.
      }
    } catch (error) {
      app.log.error({ err: error }, "Notification delivery run failed");
    } finally {
      delivering = false;
    }
  };
  const cleanup = async () => {
    try {
      const removed = await runCleanup(app.db);
      app.log.info({ removed }, "Cleanup finished");
    } catch (error) {
      app.log.error({ err: error }, "Cleanup failed");
    }
  };

  const expire = async () => {
    try {
      const closed = await closeExpiredJobs(app);
      if (closed) app.log.info({ closed }, "Closed expired jobs");
    } catch (error) {
      app.log.error({ err: error }, "Closing expired jobs failed");
    }
  };

  const timers = [
    setInterval(() => void deliver(), DELIVERY_INTERVAL_MS),
    setInterval(() => void expire(), EXPIRY_INTERVAL_MS),
    setInterval(() => void cleanup(), CLEANUP_INTERVAL_MS),
  ];
  void cleanup();
  void expire();
  return () => timers.forEach(clearInterval);
}
