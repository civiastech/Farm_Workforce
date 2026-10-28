import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client, PASSWORD, createTestContext, registerWorker, uniqueEmail } from "./helpers";

let ctx: Awaited<ReturnType<typeof createTestContext>>;

beforeAll(async () => {
  ctx = await createTestContext();
});
beforeEach(() => ctx.reset());
afterAll(() => ctx.close());

describe("health", () => {
  it("reports liveness and readiness", async () => {
    expect((await ctx.app.inject("/api/health")).json()).toEqual({ status: "ok" });
    expect((await ctx.app.inject("/api/ready")).json()).toEqual({ status: "ready" });
  });

  it("returns JSON 404s for unknown routes", async () => {
    const res = await ctx.app.inject("/api/nope");
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("not_found");
  });
});

describe("registration and sessions", () => {
  it("registers, signs in automatically and returns the current user", async () => {
    const client = new Client(ctx.app);
    const email = uniqueEmail();
    const res = await client.post("/api/auth/register", {
      role: "worker",
      fullName: "Zainab Musa",
      email: email.toUpperCase(),
      phone: "0803 123 4567",
      password: PASSWORD,
      acceptTerms: true,
    });

    expect(res.statusCode).toBe(201);
    expect(res.headers["set-cookie"]).toMatch(/fwp_session=.+; .*HttpOnly/);
    expect(res.json().user).toMatchObject({
      email,
      role: "worker",
      phone: "+2348031234567",
      hasProfile: false,
    });

    const me = await client.get("/api/auth/me");
    expect(me.json().user.email).toBe(email);
  });

  it("never returns the password hash", async () => {
    const { client } = await registerWorker(ctx.app);
    const body = (await client.get("/api/me/profile")).body;
    expect(body).not.toMatch(/scrypt|passwordHash|password_hash/);
  });

  it("rejects duplicate emails", async () => {
    const { email } = await registerWorker(ctx.app);
    const res = await new Client(ctx.app).post("/api/auth/register", {
      role: "employer",
      fullName: "Someone Else",
      email,
      phone: "08031234567",
      password: PASSWORD,
      acceptTerms: true,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("email_taken");
  });

  it("returns field-level validation errors", async () => {
    const res = await new Client(ctx.app).post("/api/auth/register", {
      role: "admin",
      fullName: "X",
      email: "not-an-email",
      phone: "123",
      password: "short",
    });
    expect(res.statusCode).toBe(422);
    expect(Object.keys(res.json().error.fields)).toEqual(
      expect.arrayContaining(["role", "fullName", "email", "phone", "password", "acceptTerms"]),
    );
  });

  it("logs in with correct credentials only", async () => {
    const { email } = await registerWorker(ctx.app);
    const client = new Client(ctx.app);

    const bad = await client.post("/api/auth/login", { email, password: "wrong-password-123" });
    expect(bad.statusCode).toBe(401);
    expect(bad.json().error.code).toBe("invalid_credentials");
    const unknown = await client.post("/api/auth/login", { email: "nobody@example.com", password: PASSWORD });
    expect(unknown.statusCode).toBe(401);
    expect(unknown.json().error.message).toBe(bad.json().error.message);

    const good = await client.post("/api/auth/login", { email, password: PASSWORD });
    expect(good.statusCode).toBe(200);
    expect((await client.get("/api/auth/me")).json().user.email).toBe(email);
  });

  it("logs out and invalidates the session server-side", async () => {
    const { client } = await registerWorker(ctx.app);
    const sessionsBefore = await ctx.sql`select count(*)::int as n from sessions`;
    expect(sessionsBefore[0]!.n).toBe(1);

    expect((await client.post("/api/auth/logout")).statusCode).toBe(204);
    expect((await client.get("/api/auth/me")).json().user).toBeNull();
    const sessionsAfter = await ctx.sql`select count(*)::int as n from sessions`;
    expect(sessionsAfter[0]!.n).toBe(0);
  });

  it("stores only a hash of the session token", async () => {
    const { client } = await registerWorker(ctx.app);
    const res = await client.get("/api/auth/me");
    expect(res.statusCode).toBe(200);
    const [row] = await ctx.sql`select id from sessions`;
    expect(row!.id).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("CSRF protection", () => {
  it("blocks state-changing requests from other origins", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: "https://evil.example" },
      payload: { email: "a@b.com", password: "x" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("blocks state-changing requests without an Origin header", async () => {
    const res = await ctx.app.inject({ method: "POST", url: "/api/auth/logout" });
    expect(res.statusCode).toBe(403);
  });
});

describe("password reset", () => {
  it("emails a single-use link that signs out other sessions", async () => {
    const { email, client: oldSession } = await registerWorker(ctx.app);
    const anon = new Client(ctx.app);

    const res = await anon.post("/api/auth/password/forgot", { email });
    expect(res.statusCode).toBe(202);
    expect(ctx.mailer.sent).toHaveLength(1);
    const token = new URL(ctx.mailer.sent[0]!.text.match(/https?:\/\/\S+/)![0]).searchParams.get("token")!;

    const newPassword = "brand-new-password-42";
    expect((await anon.post("/api/auth/password/reset", { token, password: newPassword })).statusCode).toBe(
      204,
    );
    expect((await anon.post("/api/auth/password/reset", { token, password: newPassword })).statusCode).toBe(
      400,
    );

    expect((await oldSession.get("/api/auth/me")).json().user).toBeNull();
    expect((await anon.post("/api/auth/login", { email, password: newPassword })).statusCode).toBe(200);
  });

  it("does not reveal whether an email is registered", async () => {
    const res = await new Client(ctx.app).post("/api/auth/password/forgot", { email: "nobody@example.com" });
    expect(res.statusCode).toBe(202);
    expect(ctx.mailer.sent).toHaveLength(0);
  });
});

describe("change password", () => {
  it("requires the current password and keeps only the current session", async () => {
    const { client, email } = await registerWorker(ctx.app);
    const other = new Client(ctx.app);
    await other.post("/api/auth/login", { email, password: PASSWORD });

    const wrong = await client.post("/api/auth/password/change", {
      currentPassword: "nope-nope-nope",
      newPassword: "another-password-9",
    });
    expect(wrong.statusCode).toBe(400);

    const ok = await client.post("/api/auth/password/change", {
      currentPassword: PASSWORD,
      newPassword: "another-password-9",
    });
    expect(ok.statusCode).toBe(204);
    expect((await client.get("/api/auth/me")).json().user).not.toBeNull();
    expect((await other.get("/api/auth/me")).json().user).toBeNull();
  });
});

describe("client IP behind proxies", () => {
  it("uses the address seen by the outermost trusted proxy and ignores spoofed headers", async () => {
    const proxied = await createTestContext({ TRUST_PROXY: "2" });
    try {
      await proxied.app.inject({
        method: "POST",
        url: "/api/auth/login",
        remoteAddress: "172.21.0.4",
        headers: { origin: "http://localhost:5173", "x-forwarded-for": "6.6.6.6, 41.58.0.9, 172.21.0.1" },
        payload: { email: "nobody@example.com", password: "whatever" },
      });
      const [row] = await proxied.sql`select host(ip) as ip from audit_logs order by id desc limit 1`;
      expect(row!.ip).toBe("41.58.0.9");
    } finally {
      await proxied.close();
    }
  });
});

describe("rate limiting", () => {
  it("throttles repeated login attempts", async () => {
    const limited = await createTestContext({ AUTH_RATE_LIMIT_PER_MINUTE: "3" });
    try {
      const client = new Client(limited.app);
      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) {
        statuses.push(
          (await client.post("/api/auth/login", { email: "x@example.com", password: "whatever" })).statusCode,
        );
      }
      expect(statuses).toEqual([401, 401, 401, 429]);
    } finally {
      await limited.close();
    }
  });
});
