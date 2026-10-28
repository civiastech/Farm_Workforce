import { and, eq, inArray, lte, sql } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import type { Database } from "../db/client";
import { notifications } from "../db/schema";
import type { Mailer } from "./mailer";
import type { SmsSender } from "./sms";

export interface OutboxMessage {
  userId?: string | null;
  channel: "sms" | "email";
  recipient: string;
  subject?: string;
  body: string;
}

/** Anything with `insert`, so messages can be queued inside the caller's transaction. */
type Executor = Pick<Database, "insert">;

const MAX_ATTEMPTS = 6;
/** How long a claimed message is hidden from other workers while it is being sent. */
const LEASE = sql`now() + interval '5 minutes'`;
/** 30 s, 2 min, 8 min, 32 min, ~2 h between attempts. */
const backoffSeconds = (attempt: number) => 30 * 4 ** (attempt - 1);

export interface Outbox {
  enqueue(messages: OutboxMessage[], executor?: Executor): Promise<void>;
  /** Sends messages that are due. Returns how many were attempted. */
  processDue(limit?: number): Promise<number>;
}

export function createOutbox(
  db: Database,
  { sms, mailer, logger }: { sms: SmsSender; mailer: Mailer; logger: FastifyBaseLogger },
): Outbox {
  async function deliver(message: typeof notifications.$inferSelect) {
    if (message.channel === "sms") await sms.send(message.recipient, message.body);
    else await mailer.send({ to: message.recipient, subject: message.subject ?? "", text: message.body });
  }

  return {
    async enqueue(messages, executor = db) {
      if (messages.length) await executor.insert(notifications).values(messages);
    },

    async processDue(limit = 20) {
      // Claim a batch atomically; SKIP LOCKED lets several API instances share the work.
      const due = db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(eq(notifications.status, "pending"), lte(notifications.nextAttemptAt, sql`now()`)))
        .orderBy(notifications.nextAttemptAt)
        .limit(limit)
        .for("update", { skipLocked: true });
      const claimed = await db
        .update(notifications)
        .set({ attempts: sql`${notifications.attempts} + 1`, nextAttemptAt: LEASE })
        .where(inArray(notifications.id, due))
        .returning();

      for (const message of claimed) {
        try {
          await deliver(message);
          await db
            .update(notifications)
            .set({ status: "sent", sentAt: new Date(), lastError: null })
            .where(eq(notifications.id, message.id));
        } catch (error) {
          const giveUp = message.attempts >= MAX_ATTEMPTS;
          logger.warn(
            { err: error, notificationId: message.id, attempt: message.attempts, giveUp },
            "Notification delivery failed",
          );
          await db
            .update(notifications)
            .set({
              status: giveUp ? "failed" : "pending",
              lastError: String(error instanceof Error ? error.message : error).slice(0, 500),
              nextAttemptAt: new Date(Date.now() + backoffSeconds(message.attempts) * 1000),
            })
            .where(eq(notifications.id, message.id));
        }
      }
      return claimed.length;
    },
  };
}
