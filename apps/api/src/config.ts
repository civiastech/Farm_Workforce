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
  })
  .superRefine((env, ctx) => {
    if (env.MAIL_TRANSPORT === "smtp" && !env.SMTP_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_URL"],
        message: "SMTP_URL is required when MAIL_TRANSPORT=smtp",
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
