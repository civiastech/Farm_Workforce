import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { isDaytimeInNigeria, sendApplicantDigests } from "../src/services/digest";
import {
  Client,
  createTestContext,
  registerEmployer,
  registerWorker,
  sampleJob,
  signUp,
  uniquePhone,
} from "./helpers";

let ctx: Awaited<ReturnType<typeof createTestContext>>;

beforeAll(async () => {
  ctx = await createTestContext();
});
beforeEach(() => ctx.reset());
afterAll(() => ctx.close());

/** 10:00 in Lagos (09:00 UTC) on a given day offset. */
const lagosMorning = (dayOffset = 0) => new Date(Date.UTC(2030, 0, 10 + dayOffset, 9, 0));

async function apply(jobId: string) {
  const { client } = await registerWorker(ctx.app);
  const res = await client.post(`/api/jobs/${jobId}/applications`, {});
  expect(res.statusCode).toBe(201);
}

describe("new-applicant summaries for employers", () => {
  it("tells a new employer straight away, then at most once a day", async () => {
    const { client: employer, email } = await registerEmployer(ctx.app);
    const jobId = (await employer.post("/api/jobs", sampleJob)).json().id;

    // First applicant: told at the next check.
    await apply(jobId);
    expect(await sendApplicantDigests(ctx.app, lagosMorning())).toBe(1);
    await ctx.app.outbox.processDue();
    const first = ctx.mailer.sent.find((m) => m.to === email)!;
    expect(first.subject).toBe("1 new applicant on Farm Workforce");
    expect(first.text).toContain(`• ${sampleJob.title}: 1`);

    // Two more arrive later that day: nothing more until 24 hours have passed.
    await apply(jobId);
    await apply(jobId);
    const later = new Date(lagosMorning().getTime() + 2 * 3600_000).toISOString();
    await ctx.sql`update applications set created_at = ${later}::timestamptz
      where id not in (select id from applications order by created_at limit 1)`;
    expect(await sendApplicantDigests(ctx.app, new Date(lagosMorning().getTime() + 3 * 3600_000))).toBe(0);

    // Next morning: one summary covering only the two newer applicants.
    expect(await sendApplicantDigests(ctx.app, lagosMorning(1))).toBe(1);
    await ctx.app.outbox.processDue();
    const second = ctx.mailer.sent.filter((m) => m.to === email).at(-1)!;
    expect(second.subject).toBe("2 new applicants on Farm Workforce");
  });

  it("stays quiet at night in Nigeria", async () => {
    const { client: employer } = await registerEmployer(ctx.app);
    await apply((await employer.post("/api/jobs", sampleJob)).json().id);
    const threeAmLagos = new Date(Date.UTC(2030, 0, 10, 2, 0));
    expect(isDaytimeInNigeria(threeAmLagos)).toBe(false);
    expect(await sendApplicantDigests(ctx.app, threeAmLagos)).toBe(0);
  });

  it("ignores applications already handled", async () => {
    const { client: employer } = await registerEmployer(ctx.app);
    const jobId = (await employer.post("/api/jobs", sampleJob)).json().id;
    await apply(jobId);
    await ctx.sql`update applications set status = 'shortlisted'`;
    expect(await sendApplicantDigests(ctx.app, lagosMorning())).toBe(0);
  });

  it("texts an employer who has no email, in their language", async () => {
    const employer = new Client(ctx.app);
    const phone = uniquePhone();
    const res = await signUp(employer, {
      role: "employer",
      fullName: "Bola Ade",
      phone,
      password: "a-strong-password-1",
      preferredLanguage: "pcm",
      acceptTerms: true,
    });
    expect(res.statusCode).toBe(201);
    await employer.put("/api/me/profile", { organisationName: "Ade Farms", state: "Kwara" });
    await apply((await employer.post("/api/jobs", sampleJob)).json().id);

    expect(await sendApplicantDigests(ctx.app, lagosMorning())).toBe(1);
    await ctx.app.outbox.processDue();
    expect(ctx.sms.sent.at(-1)).toMatchObject({
      to: phone,
      text: expect.stringContaining("new people don apply for your jobs (1)"),
    });
  });
});
