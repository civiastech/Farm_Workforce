import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync<{ pingDatabase: () => Promise<void> }> = async (
  app,
  { pingDatabase },
) => {
  const noRateLimit = { config: { rateLimit: false } } as const;

  // Liveness: the process is up and serving requests.
  app.get("/health", noRateLimit, async () => ({ status: "ok" }));

  // Readiness: dependencies are reachable, so the instance can take traffic.
  app.get("/ready", noRateLimit, async (request, reply) => {
    try {
      await pingDatabase();
      return { status: "ready" };
    } catch (error) {
      request.log.warn({ err: error }, "Readiness check failed");
      return reply.status(503).send({ status: "unavailable" });
    }
  });
};
