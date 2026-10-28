import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "../src/db/schema";
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

async function createAdmin() {
  const email = uniqueEmail("admin");
  const [admin] = await ctx.db
    .insert(users)
    .values({
      email,
      fullName: "Moderator",
      role: "admin",
      passwordHash: await hashPassword(PASSWORD),
      termsAcceptedAt: new Date(),
    })
    .returning({ id: users.id });
  const client = new Client(ctx.app);
  await client.post("/api/auth/login", { identifier: email, password: PASSWORD });
  return { client, id: admin!.id };
}

describe("admin access", () => {
  it("is refused to workers and employers", async () => {
    const { client } = await registerWorker(ctx.app);
    for (const path of ["/api/admin/overview", "/api/admin/users", "/api/admin/notifications"]) {
      expect((await client.get(path)).statusCode).toBe(403);
    }
  });
});

describe("overview", () => {
  it("counts the things a moderator needs to act on", async () => {
    const { client: admin } = await createAdmin();
    const { client: employer } = await registerEmployer(ctx.app);
    const { client: worker } = await registerWorker(ctx.app);
    const job = await employer.post("/api/jobs", sampleJob);
    await worker.post(`/api/jobs/${job.json().id}/applications`, {});
    await worker.post(`/api/jobs/${job.json().id}/reports`, { reason: "scam" });

    const overview = (await admin.get("/api/admin/overview")).json();
    expect(overview).toMatchObject({
      workers: 1,
      employers: 1,
      signupsLast7Days: 2,
      openJobs: 1,
      applicationsLast7Days: 1,
      openReports: 1,
      unverifiedEmployers: 1,
      failedMessages: 0,
    });
  });
});

describe("users", () => {
  it("finds a user by phone in any format, or by name", async () => {
    const { client: admin } = await createAdmin();
    const { phone } = await registerWorker(ctx.app);
    await registerEmployer(ctx.app);

    const byPhone = (
      await admin.get(`/api/admin/users?q=${encodeURIComponent(phone.replace("+234", "0"))}`)
    ).json();
    expect(byPhone.items).toHaveLength(1);
    expect(byPhone.items[0]).toMatchObject({ phone, role: "worker", phoneVerified: true, suspended: false });

    const byName = (await admin.get("/api/admin/users?q=tunde")).json();
    expect(byName.items.map((u: { role: string }) => u.role)).toEqual(["employer"]);
    expect((await admin.get("/api/admin/users?role=admin")).json().total).toBe(1);
  });

  it("suspends an employer: signs them out, blocks sign-in and takes their jobs offline", async () => {
    const { client: admin } = await createAdmin();
    const { client: employer, id, email } = await registerEmployer(ctx.app);
    const job = await employer.post("/api/jobs", sampleJob);

    const res = await admin.patch(`/api/admin/users/${id}/suspension`, {
      suspended: true,
      reason: "Asked applicants for a registration fee",
    });
    expect(res.json()).toMatchObject({ suspended: true, closedJobs: 1 });

    expect((await employer.get("/api/auth/me")).json().user).toBeNull();
    const login = await new Client(ctx.app).post("/api/auth/login", {
      identifier: email,
      password: PASSWORD,
    });
    expect(login.json().error.code).toBe("account_disabled");
    expect((await new Client(ctx.app).get("/api/jobs")).json().total).toBe(0);
    expect((await admin.get(`/api/jobs/${job.json().id}`)).json().status).toBe("closed");

    const [entry] = await ctx.sql`
      select metadata from audit_logs where action = 'moderation.user_suspended'`;
    expect(entry!.metadata).toMatchObject({ reason: "Asked applicants for a registration fee" });

    await admin.patch(`/api/admin/users/${id}/suspension`, { suspended: false });
    const again = await new Client(ctx.app).post("/api/auth/login", {
      identifier: email,
      password: PASSWORD,
    });
    expect(again.statusCode).toBe(200);
  });

  it("cannot suspend an admin or yourself", async () => {
    const { client: admin, id } = await createAdmin();
    expect((await admin.patch(`/api/admin/users/${id}/suspension`, { suspended: true })).statusCode).toBe(
      400,
    );
    const { id: otherAdminId } = await createAdmin();
    expect(
      (await admin.patch(`/api/admin/users/${otherAdminId}/suspension`, { suspended: true })).statusCode,
    ).toBe(404);
  });
});

describe("failed messages", () => {
  it("lists messages that gave up and can queue them again", async () => {
    const { client: admin } = await createAdmin();
    const { client: employer } = await registerEmployer(ctx.app);
    const { client: worker, phone } = await registerWorker(ctx.app);
    const job = await employer.post("/api/jobs", sampleJob);
    const application = await worker.post(`/api/jobs/${job.json().id}/applications`, {});
    await employer.patch(`/api/applications/${application.json().id}/status`, { status: "hired" });
    await ctx.sql`update notifications set status = 'failed', attempts = 6, last_error = 'Number unreachable'
      where channel = 'sms'`;

    const failed = (await admin.get("/api/admin/notifications")).json();
    expect(failed.items).toHaveLength(1);
    expect(failed.items[0]).toMatchObject({
      channel: "sms",
      recipient: phone,
      lastError: "Number unreachable",
      user: { fullName: "Ade Okafor" },
    });
    expect((await admin.get("/api/admin/overview")).json().failedMessages).toBe(1);

    expect((await admin.post(`/api/admin/notifications/${failed.items[0].id}/retry`)).statusCode).toBe(200);
    const before = ctx.sms.sent.length;
    await ctx.app.outbox.processDue();
    expect(ctx.sms.sent.length).toBe(before + 1);
    expect((await admin.get("/api/admin/notifications")).json().total).toBe(0);
  });
});
