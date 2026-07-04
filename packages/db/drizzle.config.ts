import { type Config } from "drizzle-kit";

import { ENV_SERVER } from "@tsu-stack/env/server/env";

if (ENV_SERVER.NODE_ENV === "production" && !ENV_SERVER.DATABASE_MIGRATION_URL) {
  throw new Error("DATABASE_MIGRATION_URL is required for production migration commands.");
}

if (
  ENV_SERVER.NODE_ENV === "production" &&
  ENV_SERVER.DATABASE_MIGRATION_URL === ENV_SERVER.DATABASE_URL
) {
  throw new Error("DATABASE_MIGRATION_URL must use a distinct owner role in production.");
}

const migrationDatabaseUrl = ENV_SERVER.DATABASE_MIGRATION_URL ?? ENV_SERVER.DATABASE_URL;

export default {
  breakpoints: true,
  introspect: {
    casing: "preserve"
  },
  dbCredentials: {
    url: migrationDatabaseUrl
  },
  dialect: "postgresql",
  out: "./migrations",
  schema: "./src/schema/index.ts",

  strict: true,
  verbose: true
} satisfies Config;
