// Applies pending database migrations, then exits. Run before starting new API versions.
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createDatabase } from "./db/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

// Works both from src/ (tsx) and dist/ (bundled): migrations live next to the package root.
const candidates = ["../drizzle", "../../drizzle"].map((p) => fileURLToPath(new URL(p, import.meta.url)));
const migrationsFolder = candidates.find((dir) => existsSync(dir));
if (!migrationsFolder) {
  console.error("Could not find the drizzle migrations folder");
  process.exit(1);
}

const { db, sql } = createDatabase(databaseUrl, { max: 1 });
try {
  await migrate(db, { migrationsFolder });
  console.log("Database migrations applied");
} catch (error) {
  console.error("Migration failed", error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
