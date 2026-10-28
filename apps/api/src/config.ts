import { z } from "zod";

const booleanFromEnv = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    DATABASE_URL: z.url({ message: "DATABASE_URL must be a postgres:// connection string" }),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    /** Public origin of the web app, e.g. https://farmworkforce.ng. Used for CSRF checks and email links. */
    APP_ORIGIN: z.url().transform((value) => new URL(value).origin),
    /**
     * Number of reverse proxies in front of the API (nginx = 1; Caddy + nginx = 2), or true/false.
     * A hop count is safer than `true`: clients cannot spoof their IP via X-Forwarded-For.
     */
    TRUST_PROXY: z
      .string()
      .default("1")
      .transform((value, ctx) => {
        if (/^\d+$/.test(value)) return Number(value);
        if (value === "true" || value === "false") return value === "true";
        ctx.addIssue({ code: "custom", message: "TRUST_PROXY must be a hop count or true/false" });
        return z.NEVER;
      }),
    COOKIE_SECURE: booleanFromEnv.optional(),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(10).default(300),
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(10),
    MAIL_TRANSPORT: z.enum(["log", "smtp"]).default("log"),
    MAIL_FROM: z.string().default("Farm Workforce <no-reply@localhost>"),
    SMTP_URL: z.string().optional(),
    /** `log` prints messages (and shows sign-up codes on screen) for local development only. */
    SMS_TRANSPORT: z.enum(["log", "termii", "africastalking"]).default("log"),
    /** Registered alphanumeric sender ID, e.g. "FarmWork". */
    SMS_SENDER_ID: z.string().max(11).optional(),
    TERMII_API_KEY: z.string().optional(),
    TERMII_BASE_URL: z.url().default("https://api.ng.termii.com"),
    /** "dnd" reaches numbers on Do-Not-Disturb, which transactional messages need. */
    TERMII_CHANNEL: z.enum(["dnd", "generic", "whatsapp"]).default("dnd"),
    AT_USERNAME: z.string().optional(),
    AT_API_KEY: z.string().optional(),
    /** Error tracking. Leave unset to disable. */
    SENTRY_DSN: z.preprocess((v) => (v === "" ? undefined : v), z.url().optional()),
    SENTRY_ENVIRONMENT: z.string().default("production"),
    /** e.g. the git tag or commit, so errors can be tied to a deploy. */
    SENTRY_RELEASE: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  })
  .superRefine((env, ctx) => {
    if (env.MAIL_TRANSPORT === "smtp" && !env.SMTP_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_URL"],
        message: "SMTP_URL is required when MAIL_TRANSPORT=smtp",
      });
    }
    const needs = (key: keyof typeof env, when: string) => {
      if (!env[key])
        ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when ${when}` });
    };
    if (env.SMS_TRANSPORT === "termii") {
      needs("TERMII_API_KEY", "SMS_TRANSPORT=termii");
      needs("SMS_SENDER_ID", "SMS_TRANSPORT=termii");
    }
    if (env.SMS_TRANSPORT === "africastalking") {
      needs("AT_USERNAME", "SMS_TRANSPORT=africastalking");
      needs("AT_API_KEY", "SMS_TRANSPORT=africastalking");
    }
    if (
      env.SMS_TRANSPORT === "log" &&
      env.NODE_ENV === "production" &&
      env.APP_ORIGIN.startsWith("https://")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["SMS_TRANSPORT"],
        message:
          "Set SMS_TRANSPORT to termii or africastalking: the log transport shows sign-up codes on screen",
      });
    }
    if (
      env.NODE_ENV === "production" &&
      env.APP_ORIGIN.startsWith("http://") &&
      env.COOKIE_SECURE !== false
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_ORIGIN"],
        message:
          "APP_ORIGIN must use https in production (or set COOKIE_SECURE=false for a local production-mode run)",
      });
    }
  });

export type Config = z.infer<typeof envSchema> & { COOKIE_SECURE: boolean };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${problems.join("\n")}`);
  }
  const config = result.data;
  return {
    ...config,
    COOKIE_SECURE: config.COOKIE_SECURE ?? config.APP_ORIGIN.startsWith("https://"),
  };
}
