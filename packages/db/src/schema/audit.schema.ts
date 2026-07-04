import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { type AuditDetails } from "@tsu-stack/core/audit";

import { organization } from "#@/schema/auth.schema";

export const auditEvents = pgTable(
  "audit_events",
  {
    action: text("action").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    details: jsonb("details").$type<AuditDetails>().default({}).notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    requestId: text("request_id"),
    resourceId: text("resource_id"),
    resourceType: text("resource_type").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" })
  },
  (table) => [
    index("audit_events_tenant_id_occurred_at_idx").on(table.tenantId, table.occurredAt),
    index("audit_events_tenant_id_resource_idx").on(
      table.tenantId,
      table.resourceType,
      table.resourceId
    ),
    index("audit_events_tenant_id_actor_user_id_occurred_at_idx").on(
      table.tenantId,
      table.actorUserId,
      table.occurredAt
    )
  ]
);
