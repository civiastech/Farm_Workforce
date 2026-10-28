import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "../src/db/schema";
import { closeExpiredJobs } from "../src/lib/background";
import { hashPassword } from "../src/lib/password";
import {
  Client,
  PASSWORD,
  createTestContext,
  registerEmployer,
  registerWorker,
  sampleJob,
  uniqueEmail,
} from "./helpers";

let ctx: Awaited<ReturnType<typeof createTestContext>>;

beforeAll(async () => {
  ctx = await createTestContext();
});
beforeEach(() => ctx.reset());
afterAll(() => ctx.close());

async function postJob(client: Client, overrides: Record<string, unknown> = {}) {
  const res = await client.post("/api/jobs", { ...sampleJob, ...overrides });
  if (res.statusCode !== 201) throw new Error(`job create failed: ${res.body}`);
  return res.json().id as string;
}

async function createAdmin() {
  const email = uniqueEmail("admin");
  await ctx.db.insert(users).values({
    email,
    fullName: "Moderator",
    role: "admin",
    passwordHash: await hashPassword(PASSWORD),
    termsAcceptedAt: new Date(),
  });
  const client = new Client(ctx.app);
  await client.post("/api/auth/login", { identifier: email, password: PASSWORD });
  return client;
}

describe("posting jobs", () => {
  it("requires an employer with an organisation profile", async () => {
    const { client: worker } = await registerWorker(ctx.app);
    expect((await worker.post("/api/jobs", sampleJob)).statusCode).toBe(403);

    const { client: employer } = await registerEmployer(ctx.app, { withProfile: false });
    const res = await employer.post("/api/jobs", sampleJob);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/organisation profile/);

    expect((await new Client(ctx.app).post("/api/jobs", sampleJob)).statusCode).toBe(401);
  });

  it("validates pay ranges", async () => {
    const { client } = await registerEmployer(ctx.app);
    const res = await client.post("/api/jobs", { ...sampleJob, payMin: 200000, payMax: 100000 });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.fields.payMax).toBeDefined();
  });

  it("lets only the owner edit a job", async () => {
    const { client: owner } = await registerEmployer(ctx.app);
    const { client: rival } = await registerEmployer(ctx.app, { organisationName: "Rival Farms" });
    const id = await postJob(owner);

    expect((await rival.patch(`/api/jobs/${id}`, { title: "Hijacked title" })).statusCode).toBe(404);
    expect((await owner.patch(`/api/jobs/${id}`, { status: "closed" })).statusCode).toBe(200);
    expect((await new Client(ctx.app).get(`/api/jobs/${id}`)).json().status).toBe("closed");
  });
});

describe("browsing jobs", () => {
  it("lists only open jobs, with search, filters and pagination", async () => {
    const { client } = await registerEmployer(ctx.app);
    await postJob(client);
    await postJob(client, {
      title: "Poultry attendant",
      category: "livestock",
      state: "Kaduna",
      town: "Zaria",
    });
    await postJob(client, { title: "Secret draft role", status: "draft" });

    const anon = new Client(ctx.app);
    const all = (await anon.get("/api/jobs")).json();
    expect(all.total).toBe(2);
    expect(all.items[0].employer).toEqual({ organisationName: "GreenFields Produce", verified: false });

    expect((await anon.get("/api/jobs?q=poultry")).json().total).toBe(1);
    expect((await anon.get("/api/jobs?q=greenfields")).json().total).toBe(2);
    expect((await anon.get("/api/jobs?state=Kaduna")).json().items[0].title).toBe("Poultry attendant");
    expect((await anon.get("/api/jobs?category=irrigation")).json().total).toBe(1);
    expect((await anon.get("/api/jobs?q=100%25")).json().total).toBe(0);

    const page = (await anon.get("/api/jobs?pageSize=1&page=2")).json();
    expect(page).toMatchObject({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
    expect(page.items).toHaveLength(1);

    expect((await anon.get("/api/jobs?state=Atlantis")).statusCode).toBe(422);
  });

  it("sorts by monthly-equivalent pay so daily and monthly jobs compare fairly", async () => {
    const { client } = await registerEmployer(ctx.app);
    await postJob(client, { title: "Monthly 150k", payMin: 100000, payMax: 150000, payPeriod: "month" });
    await postJob(client, { title: "Daily 8k", payMin: 6000, payMax: 8000, payPeriod: "day" }); // ≈176k/month
    await postJob(client, { title: "Monthly 60k", payMin: 45000, payMax: 60000, payPeriod: "month" });

    const titles = (await new Client(ctx.app).get("/api/jobs?sort=pay"))
      .json()
      .items.map((j: { title: string }) => j.title);
    expect(titles).toEqual(["Daily 8k", "Monthly 150k", "Monthly 60k"]);
    expect((await new Client(ctx.app).get("/api/jobs?sort=salary")).statusCode).toBe(422);
  });

  it("hides drafts from everyone except the owner", async () => {
    const { client: owner } = await registerEmployer(ctx.app);
    const id = await postJob(owner, { status: "draft" });
    expect((await new Client(ctx.app).get(`/api/jobs/${id}`)).statusCode).toBe(404);
    expect((await owner.get(`/api/jobs/${id}`)).json()).toMatchObject({ isOwner: true, status: "draft" });
  });

  it("returns 422 for malformed ids", async () => {
    expect((await new Client(ctx.app).get("/api/jobs/not-a-uuid")).statusCode).toBe(422);
  });

  it("publishes live platform stats", async () => {
    const { client } = await registerEmployer(ctx.app);
    await registerWorker(ctx.app);
    await postJob(client);
    expect((await new Client(ctx.app).get("/api/stats")).json()).toEqual({
      openJobs: 1,
      employers: 1,
      workers: 1,
    });
  });
});

describe("applications", () => {
  it("runs the full apply → shortlist → hire flow with privacy-preserving contact details", async () => {
    const { client: employer } = await registerEmployer(ctx.app);
    const { client: worker, email: workerEmail, phone: workerPhone } = await registerWorker(ctx.app);
    const jobId = await postJob(employer);

    const apply = await worker.post(`/api/jobs/${jobId}/applications`, {
      coverNote: "I have 4 years' experience.",
    });
    expect(apply.statusCode).toBe(201);
    const applicationId = apply.json().id;

    const duplicate = await worker.post(`/api/jobs/${jobId}/applications`, {});
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe("already_applied");
    expect((await worker.get(`/api/jobs/${jobId}`)).json().myApplication.status).toBe("submitted");

    let applicants = (await employer.get(`/api/employer/jobs/${jobId}/applications`)).json().items;
    expect(applicants).toHaveLength(1);
    expect(applicants[0].worker).toMatchObject({ fullName: "Ade Okafor", phone: null, email: null });
    expect(applicants[0].worker.skills).toEqual(["drip irrigation", "pumps"]);

    const shortlist = await employer.patch(`/api/applications/${applicationId}/status`, {
      status: "shortlisted",
    });
    expect(shortlist.statusCode).toBe(200);
    applicants = (await employer.get(`/api/employer/jobs/${jobId}/applications`)).json().items;
    expect(applicants[0].worker).toMatchObject({ phone: workerPhone, email: workerEmail });

    // The worker is told by SMS and email, delivered from the outbox.
    const smsBefore = ctx.sms.sent.length;
    expect(await ctx.app.outbox.processDue()).toBe(2);
    expect(ctx.mailer.sent.map((m) => m.to)).toContain(workerEmail);
    expect(ctx.sms.sent).toHaveLength(smsBefore + 1);
    expect(ctx.sms.sent.at(-1)).toMatchObject({ to: workerPhone });
    expect(ctx.sms.sent.at(-1)!.text).toMatch(
      /GreenFields Produce shortlisted you for "Drip irrigation technician"/,
    );

    const mine = (await worker.get("/api/me/applications")).json().items;
    expect(mine[0]).toMatchObject({
      status: "shortlisted",
      job: { id: jobId, organisationName: "GreenFields Produce" },
    });

    const jobs = (await employer.get("/api/employer/jobs")).json().items;
    expect(jobs[0].applicationCounts).toEqual({ shortlisted: 1 });
  });

  it("requires a worker profile and an open job", async () => {
    const { client: employer } = await registerEmployer(ctx.app);
    const jobId = await postJob(employer);

    const { client: noProfile } = await registerWorker(ctx.app, { withProfile: false });
    expect((await noProfile.post(`/api/jobs/${jobId}/applications`, {})).statusCode).toBe(400);

    await employer.patch(`/api/jobs/${jobId}`, { status: "closed" });
    const { client: worker } = await registerWorker(ctx.app);
    expect((await worker.post(`/api/jobs/${jobId}/applications`, {})).statusCode).toBe(400);
  });

  it("allows withdrawing and re-applying", async () => {
    const { client: employer } = await registerEmployer(ctx.app);
    const { client: worker } = await registerWorker(ctx.app);
    const jobId = await postJob(employer);
    const id = (await worker.post(`/api/jobs/${jobId}/applications`, {})).json().id;

    expect((await worker.post(`/api/applications/${id}/withdraw`)).statusCode).toBe(200);
    expect((await employer.get(`/api/employer/jobs/${jobId}/applications`)).json().items).toHaveLength(0);
    expect((await employer.patch(`/api/applications/${id}/status`, { status: "hired" })).statusCode).toBe(
      400,
    );

    const again = await worker.post(`/api/jobs/${jobId}/applications`, { coverNote: "Available again" });
    expect(again.statusCode).toBe(201);
    expect(again.json().id).toBe(id);
  });

  it("keeps applicants private from other employers and workers", async () => {
    const { client: owner } = await registerEmployer(ctx.app);
    const { client: rival } = await registerEmployer(ctx.app, { organisationName: "Rival" });
    const { client: worker } = await registerWorker(ctx.app);
    const { client: otherWorker } = await registerWorker(ctx.app);
    const jobId = await postJob(owner);
    const id = (await worker.post(`/api/jobs/${jobId}/applications`, {})).json().id;

    expect((await rival.get(`/api/employer/jobs/${jobId}/applications`)).statusCode).toBe(404);
    expect((await rival.patch(`/api/applications/${id}/status`, { status: "rejected" })).statusCode).toBe(
      404,
    );
    expect((await otherWorker.post(`/api/applications/${id}/withdraw`)).statusCode).toBe(404);
  });
});

describe("trust & safety", () => {
  it("lets users report jobs and moderators remove them", async () => {
    const { client: employer, id: employerId } = await registerEmployer(ctx.app);
    const { client: worker } = await registerWorker(ctx.app);
    const jobId = await postJob(employer);

    const report = await worker.post(`/api/jobs/${jobId}/reports`, {
      reason: "scam",
      details: "Asked me to pay a fee",
    });
    expect(report.statusCode).toBe(201);

    expect((await worker.get("/api/admin/reports")).statusCode).toBe(403);
    const admin = await createAdmin();
    const list = (await admin.get("/api/admin/reports?status=open")).json();
    expect(list.items[0]).toMatchObject({
      reason: "scam",
      job: { id: jobId },
      reporter: { fullName: "Ade Okafor" },
    });

    const resolve = await admin.patch(`/api/admin/reports/${list.items[0].id}`, {
      status: "resolved",
      removeJob: true,
    });
    expect(resolve.statusCode).toBe(200);
    expect((await new Client(ctx.app).get(`/api/jobs/${jobId}`)).statusCode).toBe(404);
    expect((await employer.patch(`/api/jobs/${jobId}`, { status: "open" })).statusCode).toBe(403);

    const verify = await admin.patch(`/api/admin/employers/${employerId}/verification`, { verified: true });
    expect(verify.statusCode).toBe(200);
    const employers = (await admin.get("/api/admin/employers")).json();
    expect(employers.items[0]).toMatchObject({ userId: employerId, verified: true });

    const [auditRow] =
      await ctx.sql`select count(*)::int as n from audit_logs where action like 'moderation.%'`;
    expect(auditRow!.n).toBe(3);
  });
});

describe("account data rights", () => {
  it("exports personal data and deletes the account on request", async () => {
    const { client: employer } = await registerEmployer(ctx.app);
    const { client: worker, email } = await registerWorker(ctx.app);
    const jobId = await postJob(employer);
    await worker.post(`/api/jobs/${jobId}/applications`, {});

    const exported = await worker.get("/api/me/export");
    expect(exported.headers["content-disposition"]).toMatch(/attachment/);
    expect(exported.json()).toMatchObject({ account: { email }, applications: [{ jobId }] });
    expect(exported.body).not.toMatch(/password/i);

    expect((await worker.delete("/api/me", { password: "wrong-password" })).statusCode).toBe(400);
    expect((await worker.delete("/api/me", { password: PASSWORD })).statusCode).toBe(204);

    expect((await worker.get("/api/auth/me")).json().user).toBeNull();
    expect(
      (await new Client(ctx.app).post("/api/auth/login", { identifier: email, password: PASSWORD }))
        .statusCode,
    ).toBe(401);
    expect((await employer.get(`/api/employer/jobs/${jobId}/applications`)).json().items).toHaveLength(0);
  });
});

describe("listing expiry", () => {
  it("closes a job after its listing period, tells the employer, and lets them reopen it", async () => {
    const { client: employer, email: employerEmail } = await registerEmployer(ctx.app);
    const { client: worker } = await registerWorker(ctx.app);
    const jobId = await postJob(employer);

    const job = (await employer.get(`/api/jobs/${jobId}`)).json();
    const days = (new Date(job.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);

    // Nothing to close yet.
    expect(await closeExpiredJobs(ctx.app)).toBe(0);

    await ctx.sql`update jobs set expires_at = now() - interval '1 minute' where id = ${jobId}`;
    expect(await closeExpiredJobs(ctx.app)).toBe(1);

    expect((await worker.get(`/api/jobs/${jobId}`)).json().status).toBe("closed");
    expect((await worker.get("/api/jobs")).json().total).toBe(0);
    const apply = await worker.post(`/api/jobs/${jobId}/applications`, {});
    expect(apply.json().error.code).toBe("job_closed");

    await ctx.app.outbox.processDue();
    const notice = ctx.mailer.sent.find((m) => m.to === employerEmail);
    expect(notice?.subject).toBe(`Your job has closed: ${sampleJob.title}`);
    const [audit] =
      await ctx.sql`select action from audit_logs where entity_id = ${jobId} order by id desc limit 1`;
    expect(audit!.action).toBe("job.expired");

    const reopen = await employer.patch(`/api/jobs/${jobId}`, { status: "open" });
    expect(reopen.statusCode).toBe(200);
    const reopened = (await employer.get(`/api/jobs/${jobId}`)).json();
    expect(reopened.status).toBe("open");
    expect(new Date(reopened.expiresAt).getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
  });

  it("does not set an expiry on drafts", async () => {
    const { client: employer } = await registerEmployer(ctx.app);
    const jobId = await postJob(employer, { status: "draft" });
    expect((await employer.get(`/api/jobs/${jobId}`)).json().expiresAt).toBeNull();
  });
});

describe("link previews and sitemap", () => {
  it("gives preview bots the job's title, pay and place, safely escaped", async () => {
    const { client: employer } = await registerEmployer(ctx.app);
    const jobId = await postJob(employer, {
      title: 'Poultry hand <script>alert("x")</script>',
      accommodationProvided: true,
    });

    const res = await ctx.app.inject(`/api/share/jobs/${jobId}`);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.headers["cache-control"]).toBe("public, max-age=300");
    expect(res.body).not.toContain("<script>");
    expect(res.body).toContain("Poultry hand &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(res.body).toMatch(/<meta property="og:title" content="[^"]*₦100,000 – ₦150,000 \/ month">/);
    expect(res.body).toContain(
      "GreenFields Produce is hiring in Abeokuta, Ogun. Full-time · Accommodation provided",
    );
    expect(res.body).toContain('<meta property="og:image" content="http://localhost:5173/og-image.png">');
    expect(res.body).toContain(`<meta property="og:url" content="http://localhost:5173/jobs/${jobId}">`);
  });

  it("does not reveal drafts or unknown jobs", async () => {
    const { client: employer } = await registerEmployer(ctx.app);
    const draftId = await postJob(employer, { status: "draft", title: "Secret draft job" });
    for (const id of [draftId, "not-a-uuid", "00000000-0000-0000-0000-000000000000"]) {
      const res = await ctx.app.inject(`/api/share/jobs/${id}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).not.toContain("Secret draft job");
      expect(res.body).toContain("<title>Farm Workforce</title>");
    }
  });

  it("lists open jobs in the sitemap and points robots.txt at it", async () => {
    const { client: employer } = await registerEmployer(ctx.app);
    const openId = await postJob(employer);
    const draftId = await postJob(employer, { status: "draft" });

    const sitemap = await ctx.app.inject("/api/sitemap.xml");
    expect(sitemap.headers["content-type"]).toMatch(/application\/xml/);
    expect(sitemap.body).toContain(`<loc>http://localhost:5173/jobs/${openId}</loc>`);
    expect(sitemap.body).not.toContain(draftId);

    const robots = await ctx.app.inject("/api/robots.txt");
    expect(robots.body).toContain("Sitemap: http://localhost:5173/sitemap.xml");
    expect(robots.body).toContain("Disallow: /dashboard");
  });

  it("keeps ordinary API responses uncached", async () => {
    expect((await ctx.app.inject("/api/jobs")).headers["cache-control"]).toBe("no-store");
  });
});
