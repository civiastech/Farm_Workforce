import type { FastifyPluginAsync } from "fastify";

/**
 * Browser error reports reach Sentry through this endpoint (the SDK's "tunnel"), so the site's
 * Content-Security-Policy stays 'self'-only and ad blockers don't drop reports. Only envelopes for
 * our own project are forwarded, so it can't be used as an open relay.
 */
const MAX_ENVELOPE_BYTES = 256 * 1024;

export const monitoringRoutes: FastifyPluginAsync = async (app) => {
  const dsn = app.config.SENTRY_DSN ? new URL(app.config.SENTRY_DSN) : null;
  const projectId = dsn?.pathname.replace(/^\//, "");

  app.get("/client-config", async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=300");
    return {
      sentryDsn: app.config.SENTRY_DSN ?? null,
      environment: app.config.SENTRY_ENVIRONMENT,
      release: app.config.SENTRY_RELEASE ?? null,
    };
  });

  if (!dsn || !projectId) return;

  // The browser SDK posts envelopes as text/plain.
  app.addContentTypeParser(
    ["text/plain", "application/x-sentry-envelope"],
    { parseAs: "string", bodyLimit: MAX_ENVELOPE_BYTES },
    (_request, body, done) => done(null, body),
  );

  app.post(
    "/monitoring",
    { bodyLimit: MAX_ENVELOPE_BYTES, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const envelope = typeof request.body === "string" ? request.body : "";
      let header: { dsn?: string };
      try {
        header = JSON.parse(envelope.slice(0, envelope.indexOf("\n")));
      } catch {
        return reply.status(400).send({ error: { code: "bad_request", message: "Invalid envelope" } });
      }
      const target = header.dsn ? new URL(header.dsn) : null;
      if (!target || target.host !== dsn.host || target.pathname.replace(/^\//, "") !== projectId) {
        return reply.status(403).send({ error: { code: "forbidden", message: "Unknown project" } });
      }

      try {
        const response = await fetch(`https://${dsn.host}/api/${projectId}/envelope/`, {
          method: "POST",
          headers: { "content-type": "application/x-sentry-envelope" },
          body: envelope,
          signal: AbortSignal.timeout(5000),
        });
        return reply.status(response.ok ? 200 : 502).send({});
      } catch (error) {
        request.log.warn({ err: error }, "Could not forward error report to Sentry");
        return reply.status(502).send({});
      }
    },
  );
};
