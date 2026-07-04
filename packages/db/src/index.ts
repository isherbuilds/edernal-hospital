import "@tanstack/react-start/server-only";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { ENV_SERVER } from "@tsu-stack/env/server/env";

import { databaseRelations } from "#@/schema/index";

export * from "drizzle-orm/sql";
export { and, asc, desc, eq, ilike, inArray, ne, or } from "drizzle-orm";

const client = postgres(ENV_SERVER.DATABASE_URL);

export const db = drizzle({
  client,
  // `defineRelationsPart()` must be merged after the main `defineRelations()` config.
  // https://orm.drizzle.team/docs/relations-v2#relations-parts
  relations: databaseRelations
});

export async function closeDb(): Promise<void> {
  await client.end();
}

export async function checkIsDbReady(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}
