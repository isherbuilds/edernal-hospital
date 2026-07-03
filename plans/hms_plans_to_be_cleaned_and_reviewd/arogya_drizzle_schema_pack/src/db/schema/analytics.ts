import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { dataClassification, jsonbObj, purposeOfUse, tenantScopeColumns, timestampColumns } from "./_shared";
import { facilities, tenants } from "./iam";

/**
 * PHI-safe product analytics and operational metrics.
 * Event payloads must be allowlisted and must not include patient names, phones, ABHA IDs,
 * transcript text, diagnoses, prescription text or document contents.
 */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenantScopeColumns,
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "cascade" }),
    eventName: varchar("event_name", { length: 192 }).notNull(),
    eventVersion: integer("event_version").notNull().default(1),
    actorUserId: text("actor_user_id"),
    actorRole: text("actor_role"),
    patientIdHash: text("patient_id_hash"),
    encounterIdHash: text("encounter_id_hash"),
    purposeOfUse: purposeOfUse("purpose_of_use").notNull().default("healthcare_operations"),
    dataClassification: dataClassification("data_classification").notNull().default("internal"),
    containsPhi: boolean("contains_phi").notNull().default(false),
    payload: jsonbObj("payload").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    requestId: text("request_id"),
    traceId: text("trace_id"),
    ...timestampColumns,
  },
  (t) => [
    index("analytics_events_tenant_name_idx").on(t.tenantId, t.eventName, t.occurredAt),
    index("analytics_payload_gin_idx").using("gin", sql`${t.payload}`),
  ],
);

export const metricDefinitions = pgTable(
  "metric_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    ownerPod: text("owner_pod"),
    queryName: text("query_name"),
    aggregation: text("aggregation").notNull(),
    unit: text("unit"),
    isPhiSafe: boolean("is_phi_safe").notNull().default(true),
    dimensions: jsonb("dimensions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("metric_definitions_code_uq").on(t.code)],
);

export const metricSnapshots = pgTable(
  "metric_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "cascade" }),
    metricCode: varchar("metric_code", { length: 128 }).notNull(),
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    bucketEnd: timestamp("bucket_end", { withTimezone: true }).notNull(),
    dimensionValues: jsonbObj("dimension_values"),
    value: text("value").notNull(),
    sampleSize: integer("sample_size"),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("metric_snapshot_uq").on(t.tenantId, t.facilityId, t.metricCode, t.bucketStart, t.bucketEnd)],
);
