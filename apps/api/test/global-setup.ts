import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { createDatabase } from "../src/db/client";
import { TEST_DATABASE_URL } from "./helpers";

export default async function setup() {
  const { db, sql } = createDatabase(TEST_DATABASE_URL, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  } catch (error) {
    throw new Error(
      `Could not prepare the test database at ${TEST_DATABASE_URL}. Is it running? Try \`npm run db:up\`.`,
      { cause: error },
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
