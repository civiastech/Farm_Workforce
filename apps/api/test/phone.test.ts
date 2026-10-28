import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runCleanup } from "../src/lib/background";
import { SMS_TEMPLATES, smsText } from "../src/lib/messages";
import { toGsm7 } from "../src/lib/sms";
import {
  Client,
  PASSWORD,
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

const lastCode = () => ctx.sms.sent.at(-1)!.text.match(/^(\d{6})/)![1]!;

const worker = (phone: string) => ({
  role: "worker",
  fullName: "Hauwa Bello",
  phone,
  password: PASSWORD,
  acceptTerms: true,
});

describe("phone sign-up", () => {
  it("sends a code by SMS, then creates a phone-only account with it", async () => {
    const client = new Client(ctx.app);
    const sent = await client.post("/api/auth/phone/code", {
      phone: "0803 555 0101",
      purpose: "register",
      language: "ha",
    });
    expect(sent.statusCode).toBe(202);
    expect(sent.json().resendInSeconds).toBe(60);

    const sms = ctx.sms.sent.at(-1)!;
    expect(sms.to).toBe("+2348035550101");
    expect(sms.text).toMatch(/^\d{6} ita ce lambar Farm Workforce/);
    // Android Chrome reads the last line to fill the code in automatically.
    expect(sms.text).toMatch(/\n@localhost:5173 #\d{6}$/);

    const res = await client.post("/api/auth/register", { ...worker("08035550101"), code: lastCode() });
    expect(res.statusCode).toBe(201);
    expect(res.json().user).toMatchObject({ email: null, phone: "+2348035550101" });

    const [row] = await ctx.sql`select phone_verified_at is not null as verified from users`;
    expect(row!.verified).toBe(true);
  });

  it("refuses a wrong code and locks the code after five wrong tries", async () => {
    const client = new Client(ctx.app);
    const phone = uniquePhone();
    await client.post("/api/auth/phone/code", { phone, purpose: "register" });
    const right = lastCode();
    const wrong = right === "000000" ? "111111" : "000000";

    for (let i = 0; i < 5; i++) {
      const res = await client.post("/api/auth/register", { ...worker(phone), code: wrong });
      expect(res.json().error.code).toBe("invalid_code");
    }
    const locked = await client.post("/api/auth/register", { ...worker(phone), code: right });
    expect(locked.statusCode).toBe(400);
    expect(locked.json().error.code).toBe("code_attempts");
  });

  it("does not accept a code twice", async () => {
    const client = new Client(ctx.app);
    const phone = uniquePhone();
    await client.post("/api/auth/phone/code", { phone, purpose: "register" });
    const code = lastCode();
    expect((await client.post("/api/auth/register", { ...worker(phone), code })).statusCode).toBe(201);
    const again = await new Client(ctx.app).post("/api/auth/register", {
      ...worker(phone),
      fullName: "Someone Else",
      code,
    });
    expect(again.statusCode).toBe(409);
  });

  it("enforces a resend cooldown", async () => {
    const client = new Client(ctx.app);
    const phone = uniquePhone();
    expect((await client.post("/api/auth/phone/code", { phone, purpose: "register" })).statusCode).toBe(202);
    const again = await client.post("/api/auth/phone/code", { phone, purpose: "register" });
    expect(again.statusCode).toBe(429);
    expect(again.json().error.code).toBe("code_cooldown");
    expect(ctx.sms.sent).toHaveLength(1);
  });

  it("tells the user straight away if the number already has an account", async () => {
    const { phone } = await registerWorker(ctx.app, { withProfile: false });
    const res = await new Client(ctx.app).post("/api/auth/phone/code", { phone, purpose: "register" });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("phone_taken");
  });

  it("reports an SMS provider failure and lets the user retry at once", async () => {
    const client = new Client(ctx.app);
    const phone = uniquePhone();
    ctx.sms.failNext = 1;
    const failed = await client.post("/api/auth/phone/code", { phone, purpose: "register" });
    expect(failed.statusCode).toBe(502);
    expect(failed.json().error.code).toBe("sms_failed");
    expect((await client.post("/api/auth/phone/code", { phone, purpose: "register" })).statusCode).toBe(202);
  });

  it("only accepts Nigerian mobile numbers", async () => {
    const res = await new Client(ctx.app).post("/api/auth/phone/code", {
      phone: "+44 7700 900123",
      purpose: "register",
    });
    expect(res.statusCode).toBe(422);
    expect(ctx.sms.sent).toHaveLength(0);
  });
});

describe("signing in with a phone number", () => {
  it("accepts the number in any common format", async () => {
    const res = await signUp(new Client(ctx.app), worker("+2348035550199"));
    expect(res.statusCode).toBe(201);

    for (const identifier of ["08035550199", "0803 555 0199", "+234 803 555 0199"]) {
      const login = await new Client(ctx.app).post("/api/auth/login", { identifier, password: PASSWORD });
      expect(login.statusCode).toBe(200);
    }
    const wrong = await new Client(ctx.app).post("/api/auth/login", {
      identifier: "08035550199",
      password: "wrong-password-1",
    });
    expect(wrong.json().error.code).toBe("invalid_credentials");
  });
});

describe("password reset by SMS", () => {
  it("resets with a code and signs out other sessions", async () => {
    const { phone, client: oldSession } = await registerWorker(ctx.app);
    const anon = new Client(ctx.app);

    const res = await anon.post("/api/auth/password/forgot", { identifier: phone.replace("+234", "0") });
    expect(res.statusCode).toBe(202);
    expect(res.json().channel).toBe("sms");
    expect(ctx.sms.sent.at(-1)!.to).toBe(phone);
    expect(ctx.mailer.sent).toHaveLength(0);

    const password = "brand-new-password-42";
    const wrong = await anon.post("/api/auth/password/reset-code", { phone, code: "999999", password });
    expect(wrong.statusCode).toBe(400);
    const ok = await anon.post("/api/auth/password/reset-code", { phone, code: lastCode(), password });
    expect(ok.statusCode).toBe(204);

    expect((await oldSession.get("/api/auth/me")).json().user).toBeNull();
    expect((await anon.post("/api/auth/login", { identifier: phone, password })).statusCode).toBe(200);
  });

  it("does not reveal whether a number is registered", async () => {
    const anon = new Client(ctx.app);
    const res = await anon.post("/api/auth/password/forgot", { identifier: uniquePhone() });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ ok: true, channel: "sms" });
    expect(ctx.sms.sent).toHaveLength(0);
  });
});

describe("account contact details", () => {
  it("changes the mobile number only with a code sent to the new number", async () => {
    const { client } = await registerWorker(ctx.app);
    const newPhone = uniquePhone();

    const noCode = await client.put("/api/me/phone", { phone: newPhone, code: "123456" });
    expect(noCode.json().error.code).toBe("invalid_code");

    expect(
      (await client.post("/api/auth/phone/code", { phone: newPhone, purpose: "change_phone" })).statusCode,
    ).toBe(202);
    expect(ctx.sms.sent.at(-1)!.to).toBe(newPhone);
    const changed = await client.put("/api/me/phone", { phone: newPhone, code: lastCode() });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().user.phone).toBe(newPhone);
  });

  it("requires a signed-in user to request a change-number code", async () => {
    const res = await new Client(ctx.app).post("/api/auth/phone/code", {
      phone: uniquePhone(),
      purpose: "change_phone",
    });
    expect(res.statusCode).toBe(401);
  });

  it("lets a user remove their email while they have a phone, and refuses someone else's", async () => {
    const { client } = await registerWorker(ctx.app);
    const { email: otherEmail } = await registerEmployer(ctx.app, { withProfile: false });

    const taken = await client.put("/api/me/account", {
      fullName: "Ade Okafor",
      email: otherEmail,
      preferredLanguage: "en",
    });
    expect(taken.json().error.code).toBe("email_taken");

    const removed = await client.put("/api/me/account", {
      fullName: "Ade Okafor",
      email: "",
      preferredLanguage: "yo",
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().user).toMatchObject({ email: null, preferredLanguage: "yo" });
  });
});

describe("notification outbox", () => {
  it("retries a failed SMS later instead of losing it", async () => {
    const { client: employer } = await registerEmployer(ctx.app);
    const { client: workerClient, phone } = await registerWorker(ctx.app);
    const job = await employer.post("/api/jobs", sampleJob);
    const application = await workerClient.post(`/api/jobs/${job.json().id}/applications`, {});
    await employer.patch(`/api/applications/${application.json().id}/status`, { status: "hired" });

    ctx.sms.failNext = 1;
    const before = ctx.sms.sent.length;
    await ctx.app.outbox.processDue();
    const [pending] = await ctx.sql`
      select status, attempts, last_error from notifications where channel = 'sms'`;
    expect(pending).toMatchObject({ status: "pending", attempts: 1, last_error: "Simulated SMS failure" });

    // Nothing is due until the back-off has passed.
    expect(await ctx.app.outbox.processDue()).toBe(0);
    await ctx.sql`update notifications set next_attempt_at = now() where status = 'pending'`;
    await ctx.app.outbox.processDue();

    const [sent] = await ctx.sql`select status, attempts from notifications where channel = 'sms'`;
    expect(sent).toMatchObject({ status: "sent", attempts: 2 });
    expect(ctx.sms.sent.slice(before)).toEqual([
      { to: phone, text: expect.stringContaining("Congratulations! GreenFields Produce hired you") },
    ]);
  });

  it("sends status SMS in the worker's language", async () => {
    const { client: employer } = await registerEmployer(ctx.app);
    const { client: workerClient } = await registerWorker(ctx.app);
    await workerClient.put("/api/me/account", { fullName: "Ade Okafor", preferredLanguage: "pcm" });
    const job = await employer.post("/api/jobs", sampleJob);
    const application = await workerClient.post(`/api/jobs/${job.json().id}/applications`, {});
    await employer.patch(`/api/applications/${application.json().id}/status`, { status: "shortlisted" });
    await ctx.app.outbox.processDue();
    expect(ctx.sms.sent.at(-1)!.text).toMatch(/don shortlist you/);
  });
});

describe("cleanup", () => {
  it("removes expired sessions and old codes", async () => {
    await registerWorker(ctx.app);
    await ctx.sql`update sessions set expires_at = now() - interval '1 minute'`;
    await ctx.sql`update verification_codes set expires_at = now() - interval '2 days'`;
    const removed = await runCleanup(ctx.db);
    expect(removed).toMatchObject({ sessions: 1, verificationCodes: 1 });
  });
});

describe("SMS text", () => {
  it("keeps every placeholder in every language", () => {
    for (const [lang, templates] of Object.entries(SMS_TEMPLATES)) {
      for (const [key, text] of Object.entries(templates)) {
        const names = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        const english = [...SMS_TEMPLATES.en[key as keyof typeof templates].matchAll(/\{(\w+)\}/g)]
          .map((m) => m[1])
          .sort();
        expect({ lang, key, names }).toEqual({ lang, key, names: english });
      }
    }
  });

  it("fits a status message in one SMS for a typical job", () => {
    for (const lang of Object.keys(SMS_TEMPLATES) as (keyof typeof SMS_TEMPLATES)[]) {
      const text = toGsm7(
        smsText(lang, "shortlisted", { employer: "GreenFields Produce", job: "Poultry attendant" }),
      );
      expect(text.length, lang).toBeLessThanOrEqual(160);
    }
  });

  it("converts to the GSM alphabet so messages stay cheap", () => {
    expect(toGsm7("Ẹ kú oríire — ₦60,000 “ƙasa”")).toBe('E ku oriire - N60,000 "kasa"');
  });
});
