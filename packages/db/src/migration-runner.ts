import { join } from "node:path";

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { ENV_SERVER } from "@tsu-stack/env/server/env";
import { createLogger } from "@tsu-stack/logger/server";

import { relations as authRelations } from "#@/schema/auth.schema";
import { relations } from "#@/schema/relations";

const APP_DML_TABLES = [
  "account",
  "facilities",
  "invitation",
  "member",
  "organization",
  "practitioners",
  "session",
  "user",
  "verification"
] as const;

const AUDIT_EVENTS_TABLE = "audit_events";
const MIGRATION_MAX_ATTEMPTS = 3;
const MIGRATION_RETRY_DELAY_MS = 3_000;

const databaseRelations = { ...relations, ...authRelations };

type PostgresClient = ReturnType<typeof postgres>;

export function getRuntimeDatabaseRole(databaseUrl: string): string {
  const username = new URL(databaseUrl).username;
  if (!username) {
    throw new Error("DATABASE_URL must include a runtime database username.");
  }

  return decodeURIComponent(username);
}

export function quotePostgresIdentifier(identifier: string): string {
  if (!identifier || identifier.includes("\0")) {
    throw new Error("PostgreSQL identifiers must be non-empty and cannot contain null bytes.");
  }

  return `"${identifier.replaceAll('"', '""')}"`;
}

function getMigrationDatabaseUrl() {
  if (ENV_SERVER.NODE_ENV === "production" && !ENV_SERVER.DATABASE_MIGRATION_URL) {
    throw new Error("DATABASE_MIGRATION_URL is required for production migrations.");
  }

  if (
    ENV_SERVER.NODE_ENV === "production" &&
    ENV_SERVER.DATABASE_MIGRATION_URL === ENV_SERVER.DATABASE_URL
  ) {
    throw new Error("DATABASE_MIGRATION_URL must use a distinct owner role in production.");
  }

  return ENV_SERVER.DATABASE_MIGRATION_URL ?? ENV_SERVER.DATABASE_URL;
}

function qualifiedTableIdentifier(tableName: string) {
  return `public.${quotePostgresIdentifier(tableName)}`;
}

async function applyRuntimePrivileges(client: PostgresClient, runtimeRole: string) {
  const quotedRuntimeRole = quotePostgresIdentifier(runtimeRole);
  const appTables = APP_DML_TABLES.map(qualifiedTableIdentifier).join(", ");
  const auditEventsTable = qualifiedTableIdentifier(AUDIT_EVENTS_TABLE);

  await client.unsafe(`GRANT USAGE ON SCHEMA public TO ${quotedRuntimeRole}`);
  await client.unsafe(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${appTables} TO ${quotedRuntimeRole}`
  );
  await client.unsafe(`GRANT SELECT, INSERT ON TABLE ${auditEventsTable} TO ${quotedRuntimeRole}`);
  await client.unsafe(`REVOKE ALL PRIVILEGES ON TABLE ${auditEventsTable} FROM PUBLIC`);
  await client.unsafe(
    `REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE ${auditEventsTable} FROM ${quotedRuntimeRole}`
  );
}

async function assertProductionAuditPrivileges(client: PostgresClient, runtimeRole: string) {
  if (ENV_SERVER.NODE_ENV !== "production") {
    return;
  }

  const [auditOwner] = await client<
    {
      tableowner: string;
    }[]
  >`
    SELECT tableowner
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = ${AUDIT_EVENTS_TABLE}
    LIMIT 1
  `;

  if (auditOwner?.tableowner === runtimeRole) {
    throw new Error("Runtime database role must not own public.audit_events in production.");
  }

  const [auditPrivileges] = await client<
    {
      canDelete: boolean;
      canInsert: boolean;
      canSelect: boolean;
      canTruncate: boolean;
      canUpdate: boolean;
    }[]
  >`
    SELECT
      has_table_privilege(${runtimeRole}, 'public.audit_events', 'SELECT') AS "canSelect",
      has_table_privilege(${runtimeRole}, 'public.audit_events', 'INSERT') AS "canInsert",
      has_table_privilege(${runtimeRole}, 'public.audit_events', 'UPDATE') AS "canUpdate",
      has_table_privilege(${runtimeRole}, 'public.audit_events', 'DELETE') AS "canDelete",
      has_table_privilege(${runtimeRole}, 'public.audit_events', 'TRUNCATE') AS "canTruncate"
  `;

  if (!auditPrivileges?.canSelect || !auditPrivileges.canInsert) {
    throw new Error("Runtime database role must have SELECT and INSERT on public.audit_events.");
  }

  if (auditPrivileges.canUpdate || auditPrivileges.canDelete || auditPrivileges.canTruncate) {
    throw new Error(
      "Runtime database role must not have UPDATE, DELETE, or TRUNCATE on public.audit_events."
    );
  }
}

export async function runDatabaseMigrations(): Promise<void> {
  const migrationDatabaseUrl = getMigrationDatabaseUrl();
  const runtimeRole = getRuntimeDatabaseRole(ENV_SERVER.DATABASE_URL);

  for (let attempt = 1; attempt <= MIGRATION_MAX_ATTEMPTS; attempt++) {
    const log = createLogger({ attempt, operation: "database_migration" });
    const migrationClient = postgres(migrationDatabaseUrl, { max: 1 });
    const migrationDb = drizzle({
      client: migrationClient,
      relations: databaseRelations
    });

    try {
      await migrate(migrationDb, {
        migrationsFolder: join(import.meta.dirname, "../migrations")
      });
      await applyRuntimePrivileges(migrationClient, runtimeRole);
      await assertProductionAuditPrivileges(migrationClient, runtimeRole);
      log.emit({ event: "database_migration_completed" });
      return;
    } catch (error) {
      const isFinalAttempt = attempt === MIGRATION_MAX_ATTEMPTS;

      log.error(error instanceof Error ? error : String(error), {
        event: isFinalAttempt ? "database_migration_failed" : "database_migration_retrying",
        maxAttempts: MIGRATION_MAX_ATTEMPTS,
        ...(isFinalAttempt ? {} : { retryDelayMs: MIGRATION_RETRY_DELAY_MS })
      });

      if (isFinalAttempt) {
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
