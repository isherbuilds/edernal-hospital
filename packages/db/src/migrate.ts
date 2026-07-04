import { join } from "node:path";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createLogger } from "@tsu-stack/logger/server";

import { closeDb, db } from "#@/index";

const log = createLogger({ operation: "database_migration" });

try {
  await migrate(db, {
    migrationsFolder: join(import.meta.dirname, "../migrations")
  });
  log.emit({ event: "database_migration_completed" });
} catch (error) {
  log.error(error instanceof Error ? error : String(error), {
    event: "database_migration_failed"
  });
  throw error;
} finally {
  await closeDb();
}
