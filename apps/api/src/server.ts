import { buildApp } from "./app";
import { loadConfig } from "./config";
import { createDatabase } from "./db/client";

const config = loadConfig();
const { db, sql } = createDatabase(config.DATABASE_URL, { max: config.DATABASE_POOL_MAX });

const app = await buildApp({
  config,
  db,
  backgroundJobs: true,
  pingDatabase: async () => {
    await sql`select 1`;
  },
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "Shutting down gracefully");
  const forceExit = setTimeout(() => process.exit(1), 15_000);
  forceExit.unref();
  try {
    await app.close();
    await sql.end({ timeout: 5 });
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, "Error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.fatal({ err: error }, "Failed to start server");
  await sql.end({ timeout: 5 });
  process.exit(1);
}
