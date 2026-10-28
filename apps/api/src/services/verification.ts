import { CODE_LENGTH, CODE_RESEND_SECONDS, type Language, type VerificationPurpose } from "@fwp/shared";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { verificationCodes } from "../db/schema";
import { AppError } from "../lib/errors";
import { smsText } from "../lib/messages";

export const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

function hashCode(id: string, code: string) {
  return createHash("sha256").update(`${id}:${code}`).digest();
}

export type IssueResult = { sent: true; code: string } | { sent: false; retryAfterSeconds: number };

/**
 * Sends a one-time code by SMS. Enforces a resend cooldown and an hourly cap per number,
 * which also limits SMS-pumping fraud. Any earlier unused code for the same purpose stops working.
 */
export async function issueCode(
  app: FastifyInstance,
  { phone, purpose, language }: { phone: string; purpose: VerificationPurpose; language: Language },
): Promise<IssueResult> {
  const recent = await app.db
    .select({ createdAt: verificationCodes.createdAt })
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.phone, phone),
        eq(verificationCodes.purpose, purpose),
        gt(verificationCodes.createdAt, new Date(Date.now() - HOUR_MS)),
      ),
    )
    .orderBy(desc(verificationCodes.createdAt));

  const now = Date.now();
  const latest = recent[0]?.createdAt.getTime();
  if (latest && now - latest < CODE_RESEND_SECONDS * 1000) {
    return { sent: false, retryAfterSeconds: Math.ceil((latest + CODE_RESEND_SECONDS * 1000 - now) / 1000) };
  }
  if (recent.length >= MAX_CODES_PER_HOUR) {
    const oldest = recent[recent.length - 1]!.createdAt.getTime();
    return { sent: false, retryAfterSeconds: Math.ceil((oldest + HOUR_MS - now) / 1000) };
  }

  await app.db
    .update(verificationCodes)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(verificationCodes.phone, phone),
        eq(verificationCodes.purpose, purpose),
        isNull(verificationCodes.consumedAt),
      ),
    );

  const id = randomUUID();
  const code = randomInt(0, 10 ** CODE_LENGTH)
    .toString()
    .padStart(CODE_LENGTH, "0");
  await app.db.insert(verificationCodes).values({
    id,
    phone,
    purpose,
    codeHash: hashCode(id, code).toString("hex"),
    expiresAt: new Date(now + CODE_TTL_MINUTES * 60 * 1000),
  });

  // The last line lets Android Chrome offer to fill the code in automatically (WebOTP).
  const host = new URL(app.config.APP_ORIGIN).host;
  const text = `${smsText(language, "code", { code, minutes: CODE_TTL_MINUTES })}\n\n@${host} #${code}`;
  try {
    await app.sms.send(phone, text);
  } catch (error) {
    app.log.error({ err: error, purpose }, "Failed to send verification SMS");
    await app.db.delete(verificationCodes).where(eq(verificationCodes.id, id));
    throw new AppError(
      502,
      "sms_failed",
      "We couldn't send the SMS just now. Check the number and try again.",
    );
  }
  return { sent: true, code };
}

const invalidCode = () =>
  new AppError(400, "invalid_code", "That code is wrong or has expired.", {
    code: "That code is wrong or has expired.",
  });

/** Checks a code and marks it used. Throws `invalid_code` or `code_attempts` on failure. */
export async function consumeCode(
  app: FastifyInstance,
  { phone, purpose, code }: { phone: string; purpose: VerificationPurpose; code: string },
): Promise<void> {
  const [row] = await app.db
    .select()
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.phone, phone),
        eq(verificationCodes.purpose, purpose),
        isNull(verificationCodes.consumedAt),
        gt(verificationCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(verificationCodes.createdAt))
    .limit(1);
  if (!row) throw invalidCode();

  if (row.attempts >= MAX_ATTEMPTS) {
    throw new AppError(400, "code_attempts", "Too many wrong tries. Ask for a new code.", {
      code: "Too many wrong tries. Ask for a new code.",
    });
  }

  if (!timingSafeEqual(hashCode(row.id, code), Buffer.from(row.codeHash, "hex"))) {
    await app.db
      .update(verificationCodes)
      .set({ attempts: sql`${verificationCodes.attempts} + 1` })
      .where(eq(verificationCodes.id, row.id));
    throw invalidCode();
  }

  // Guards against the same code being used twice by concurrent requests.
  const [used] = await app.db
    .update(verificationCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(verificationCodes.id, row.id), isNull(verificationCodes.consumedAt)))
    .returning({ id: verificationCodes.id });
  if (!used) throw invalidCode();
}
