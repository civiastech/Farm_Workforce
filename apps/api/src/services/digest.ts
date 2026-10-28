import { and, count, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { applications, employerProfiles, jobs, users } from "../db/schema";
import { smsText } from "../lib/messages";
import type { OutboxMessage } from "../lib/outbox";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Messages go out between 07:00 and 20:00 in Nigeria (WAT, UTC+1, no daylight saving). */
const SEND_FROM_HOUR = 7;
const SEND_UNTIL_HOUR = 20;

export function isDaytimeInNigeria(now: Date): boolean {
  const hour = (now.getUTCHours() + 1) % 24;
  return hour >= SEND_FROM_HOUR && hour < SEND_UNTIL_HOUR;
}

/**
 * Tells employers about new applicants: right away for the first ones, then at most once a day.
 * Email if they have one, otherwise SMS in their language. Returns how many employers were told.
 */
export async function sendApplicantDigests(app: FastifyInstance, now = new Date()): Promise<number> {
  if (!isDaytimeInNigeria(now)) return 0;
  const dayAgo = new Date(now.getTime() - DAY_MS);

  // New, still-pending applications per job, for employers who haven't had a summary in 24 hours.
  const since = sql`coalesce(${employerProfiles.applicantDigestAt}, '-infinity'::timestamptz)`;
  const rows = await app.db
    .select({ employerId: jobs.employerId, jobTitle: jobs.title, n: count() })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(employerProfiles, eq(employerProfiles.userId, jobs.employerId))
    .where(
      and(
        eq(applications.status, "submitted"),
        gt(applications.createdAt, since),
        or(isNull(employerProfiles.applicantDigestAt), lte(employerProfiles.applicantDigestAt, dayAgo)),
      ),
    )
    .groupBy(jobs.employerId, jobs.id, jobs.title);
  if (rows.length === 0) return 0;

  const byEmployer = new Map<string, { title: string; n: number }[]>();
  for (const row of rows) {
    byEmployer.set(row.employerId, [
      ...(byEmployer.get(row.employerId) ?? []),
      { title: row.jobTitle, n: row.n },
    ]);
  }
  const employers = await app.db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      language: users.preferredLanguage,
    })
    .from(users)
    .where(and(inArray(users.id, [...byEmployer.keys()]), isNull(users.disabledAt)));

  const url = `${app.config.APP_ORIGIN}/dashboard/jobs`;
  let told = 0;
  for (const employer of employers) {
    const perJob = byEmployer.get(employer.id)!;
    const total = perJob.reduce((sum, job) => sum + job.n, 0);

    let message: OutboxMessage | null = null;
    if (employer.email) {
      message = {
        userId: employer.id,
        channel: "email",
        recipient: employer.email,
        subject: `${total} new applicant${total === 1 ? "" : "s"} on Farm Workforce`,
        body: [
          `Hello ${employer.fullName},`,
          "",
          `You have ${total} new applicant${total === 1 ? "" : "s"} waiting for a reply:`,
          ...perJob.map((job) => `  • ${job.title}: ${job.n}`),
          "",
          "Good workers get other offers quickly. Review and shortlist them here:",
          url,
          "",
          "You get at most one of these summaries a day.",
        ].join("\n"),
      };
    } else if (employer.phone) {
      message = {
        userId: employer.id,
        channel: "sms",
        recipient: employer.phone,
        body: smsText(employer.language, "newApplicants", { n: total, url }),
      };
    }
    if (!message) continue;

    // Claim the digest atomically, so two API instances never both send it.
    const sent = await app.db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(employerProfiles)
        .set({ applicantDigestAt: now })
        .where(
          and(
            eq(employerProfiles.userId, employer.id),
            or(isNull(employerProfiles.applicantDigestAt), lte(employerProfiles.applicantDigestAt, dayAgo)),
          ),
        )
        .returning({ userId: employerProfiles.userId });
      if (!claimed) return false;
      await app.outbox.enqueue([message], tx);
      return true;
    });
    if (sent) told++;
  }
  return told;
}
