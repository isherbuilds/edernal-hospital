import { join } from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { ENV_SERVER } from "@tsu-stack/env/server/env";
import { createLogger } from "@tsu-stack/logger/server";

import { databaseRelations } from "#@/schema/index";

const MIGRATION_MAX_ATTEMPTS = 3;
const MIGRATION_RETRY_DELAY_MS = 3_000;
const MIGRATION_RETRYABLE_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "08000",
  "08001",
  "08003",
  "08006",
  "08007",
  "53300",
  "57P01",
  "57P02",
  "57P03"
]);

function getRetryableErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }

  if (error && typeof error === "object" && "cause" in error) {
    return getRetryableErrorCode(error.cause);
  }

  return undefined;
}

function isRetryableMigrationError(error: unknown) {
  const code = getRetryableErrorCode(error);
  return !!code && (code.startsWith("08") || MIGRATION_RETRYABLE_ERROR_CODES.has(code));
}

export async function runDatabaseMigrations(): Promise<void> {
  for (let attempt = 1; attempt <= MIGRATION_MAX_ATTEMPTS; attempt++) {
    const log = createLogger({ attempt, operation: "database_migration" });
    const migrationClient = postgres(ENV_SERVER.DATABASE_URL, { max: 1 });
    const migrationDb = drizzle({
      client: migrationClient,
      relations: databaseRelations
    });

    try {
      await migrate(migrationDb, {
        migrationsFolder: join(import.meta.dirname, "../migrations")
      });
      log.emit({ event: "database_migration_completed" });
      return;
    } catch (error) {
      const isFinalAttempt = attempt === MIGRATION_MAX_ATTEMPTS;
      const isRetryable = isRetryableMigrationError(error);
      const shouldRetry = isRetryable && !isFinalAttempt;

      log.error(error instanceof Error ? error : String(error), {
        event: shouldRetry ? "database_migration_retrying" : "database_migration_failed",
        maxAttempts: MIGRATION_MAX_ATTEMPTS,
        retryable: isRetryable,
        ...(shouldRetry ? { retryDelayMs: MIGRATION_RETRY_DELAY_MS } : {})
      });

      if (!shouldRetry) {
        throw error;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, MIGRATION_RETRY_DELAY_MS);
      });
    } finally {
      await migrationClient.end();
    }
  }
}
