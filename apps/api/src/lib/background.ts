import { and, lt, ne, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Database } from "../db/client";
import { notifications, passwordResetTokens, sessions, verificationCodes } from "../db/schema";

const DELIVERY_INTERVAL_MS = 5_000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

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

  const timers = [
    setInterval(() => void deliver(), DELIVERY_INTERVAL_MS),
    setInterval(() => void cleanup(), CLEANUP_INTERVAL_MS),
  ];
  void cleanup();
  return () => timers.forEach(clearInterval);
}
