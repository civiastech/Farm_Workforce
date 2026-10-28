import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { ApiErrorBody } from "@fwp/shared";
import Fastify, { type FastifyError, type FastifyServerOptions } from "fastify";
import type { Config } from "./config";
import type { Database } from "./db/client";
import { AppError, forbidden } from "./lib/errors";
import { startBackgroundJobs } from "./lib/background";
import { createMailer, type Mailer } from "./lib/mailer";
import { createOutbox } from "./lib/outbox";
import { createSmsSender, type SmsSender } from "./lib/sms";
import { registerAuth } from "./plugins/auth";
import { adminRoutes } from "./routes/admin";
import { applicationRoutes } from "./routes/applications";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { jobRoutes } from "./routes/jobs";
import { meRoutes } from "./routes/me";

export interface AppDependencies {
  config: Config;
  db: Database;
  /** Checks database connectivity for the readiness probe. */
  pingDatabase: () => Promise<void>;
  mailer?: Mailer;
  sms?: SmsSender;
  logger?: FastifyServerOptions["logger"];
  /** Deliver queued notifications and run cleanup in this process. The server enables it; tests don't. */
  backgroundJobs?: boolean;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function buildApp({
  config,
  db,
  pingDatabase,
  mailer,
  sms,
  logger,
  backgroundJobs = false,
}: AppDependencies) {
  const app = Fastify({
    logger: logger ?? {
      level: config.LOG_LEVEL,
      redact: ["req.headers.cookie", "req.headers.authorization", 'res.headers["set-cookie"]'],
      ...(config.NODE_ENV === "development" ? { transport: { target: "pino-pretty" } } : {}),
    },
    // A hop count is applied as a function: Fastify's numeric form does not count hops reliably.
    trustProxy:
      typeof config.TRUST_PROXY === "number"
        ? (_address: string, hop: number) => hop < (config.TRUST_PROXY as number)
        : config.TRUST_PROXY,
    bodyLimit: 64 * 1024,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  app.decorate("config", config);
  app.decorate("db", db);
  app.decorate("mailer", mailer ?? createMailer(config, app.log));
  app.decorate("sms", sms ?? createSmsSender(config, app.log));
  app.decorate("outbox", createOutbox(db, { sms: app.sms, mailer: app.mailer, logger: app.log }));

  if (backgroundJobs) {
    let stop: (() => void) | undefined;
    app.addHook("onReady", async () => {
      stop = startBackgroundJobs(app);
    });
    app.addHook("onClose", async () => stop?.());
  }

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-origin" },
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_PER_MINUTE,
    timeWindow: "1 minute",
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: {
        code: "rate_limited",
        message: `Too many requests. Please try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
      },
    }),
  });

  // CSRF defence: session cookies are SameSite=Lax, and every state-changing request
  // must come from our own origin (browsers always send Origin on these requests).
  app.addHook("onRequest", async (request) => {
    if (SAFE_METHODS.has(request.method)) return;
    const origin = request.headers.origin;
    if (origin !== config.APP_ORIGIN) {
      throw forbidden("Cross-site request blocked");
    }
  });

  registerAuth(app);

  app.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  app.setErrorHandler<FastifyError | AppError>((error, request, reply) => {
    if (error instanceof AppError) {
      const body: ApiErrorBody = {
        error: { code: error.code, message: error.message, fields: error.fields },
      };
      return reply.status(error.statusCode).send(body);
    }

    const status = error.statusCode ?? 500;
    if (status === 429) return reply.status(429).send(error);
    if (status < 500) {
      const body: ApiErrorBody = { error: { code: error.code ?? "bad_request", message: error.message } };
      return reply.status(status).send(body);
    }

    request.log.error({ err: error }, "Unhandled error");
    const body: ApiErrorBody = {
      error: { code: "internal_error", message: "Something went wrong on our side. Please try again." },
    };
    return reply.status(500).send(body);
  });

  app.setNotFoundHandler((request, reply) => {
    const body: ApiErrorBody = {
      error: { code: "not_found", message: `No route for ${request.method} ${request.url}` },
    };
    return reply.status(404).send(body);
  });

  await app.register(
    async (api) => {
      await api.register(healthRoutes, { pingDatabase });
      await api.register(authRoutes);
      await api.register(meRoutes);
      await api.register(jobRoutes);
      await api.register(applicationRoutes);
      await api.register(adminRoutes);
    },
    { prefix: "/api" },
  );

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
