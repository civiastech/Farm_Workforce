import type { InjectOptions } from "fastify";
import { buildApp, type App } from "../src/app";
import { loadConfig } from "../src/config";
import { createDatabase } from "../src/db/client";
import { createMemoryMailer } from "../src/lib/mailer";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://fwp:fwp@localhost:5432/fwp_test";
export const ORIGIN = "http://localhost:5173";

export async function createTestContext(overrides: Record<string, string> = {}) {
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: TEST_DATABASE_URL,
    APP_ORIGIN: ORIGIN,
    LOG_LEVEL: "silent",
    RATE_LIMIT_PER_MINUTE: "10000",
    AUTH_RATE_LIMIT_PER_MINUTE: "10000",
    ...overrides,
  });
  const { db, sql } = createDatabase(TEST_DATABASE_URL, { max: 5 });
  const mailer = createMemoryMailer();
  const app = await buildApp({
    config,
    db,
    mailer,
    logger: false,
    pingDatabase: async () => {
      await sql`select 1`;
    },
  });
  await app.ready();

  return {
    app,
    db,
    sql,
    mailer,
    async reset() {
      await sql`truncate table audit_logs, reports, applications, jobs, password_reset_tokens, sessions,
        worker_profiles, employer_profiles, users restart identity cascade`;
      mailer.sent.length = 0;
    },
    async close() {
      await app.close();
      await sql.end({ timeout: 5 });
    },
  };
}

/** A browser-like client: keeps its session cookie and sends our Origin header. */
export class Client {
  private cookie: string | null = null;

  constructor(private readonly app: App) {}

  async request(method: InjectOptions["method"], url: string, payload?: unknown) {
    const response = await this.app.inject({
      method,
      url,
      payload: payload as InjectOptions["payload"],
      headers: {
        origin: ORIGIN,
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
    });
    const setCookie = response.headers["set-cookie"];
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    for (const c of cookies) {
      const pair = c.split(";")[0] ?? "";
      // A cleared cookie arrives with an empty value.
      this.cookie = pair.split("=")[1] ? pair : null;
    }
    return response;
  }

  get = (url: string) => this.request("GET", url);
  post = (url: string, body?: unknown) => this.request("POST", url, body ?? {});
  put = (url: string, body?: unknown) => this.request("PUT", url, body ?? {});
  patch = (url: string, body?: unknown) => this.request("PATCH", url, body ?? {});
  delete = (url: string, body?: unknown) => this.request("DELETE", url, body ?? {});
}

let counter = 0;
export function uniqueEmail(prefix = "user") {
  counter += 1;
  return `${prefix}${counter}-${Date.now()}@example.com`;
}

export const PASSWORD = "a-strong-password-1";

export async function registerWorker(app: App, { withProfile = true } = {}) {
  const client = new Client(app);
  const email = uniqueEmail("worker");
  const res = await client.post("/api/auth/register", {
    role: "worker",
    fullName: "Ade Okafor",
    email,
    phone: "08031234567",
    password: PASSWORD,
    acceptTerms: true,
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.body}`);
  if (withProfile) {
    const profile = await client.put("/api/me/profile", {
      state: "Oyo",
      primaryCategory: "irrigation",
      skills: ["Drip irrigation", "drip irrigation", "pumps"],
      yearsExperience: 4,
    });
    if (profile.statusCode !== 200) throw new Error(`profile failed: ${profile.body}`);
  }
  return { client, email, id: res.json().user.id as string };
}

export async function registerEmployer(
  app: App,
  { withProfile = true, organisationName = "GreenFields Produce" } = {},
) {
  const client = new Client(app);
  const email = uniqueEmail("employer");
  const res = await client.post("/api/auth/register", {
    role: "employer",
    fullName: "Tunde Bakare",
    email,
    phone: "+234 803 000 0000",
    password: PASSWORD,
    acceptTerms: true,
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.body}`);
  if (withProfile) {
    const profile = await client.put("/api/me/profile", { organisationName, state: "Oyo", town: "Iseyin" });
    if (profile.statusCode !== 200) throw new Error(`profile failed: ${profile.body}`);
  }
  return { client, email, id: res.json().user.id as string };
}

export const sampleJob = {
  title: "Drip irrigation technician",
  description: "Install, inspect and repair drip irrigation lines and pumps across 25 hectares.",
  category: "irrigation",
  employmentType: "full_time",
  state: "Ogun",
  town: "Abeokuta",
  payMin: 100000,
  payMax: 150000,
  payPeriod: "month",
  positions: 2,
};
