import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import {
  dataClassification,
  jsonbObj,
  migrationRunStatus,
  requestTraceColumns,
  syncStatus,
  tenantScopeColumns,
  timestampColumns,
} from "./_shared";
import { facilities, tenants } from "./iam";

/**
 * Onboarding and migration tables.
 * Supports PRD R10: import patients/tariffs/doctors with dry-run validation,
 * sampled fidelity checks and rollback-friendly manifests.
 */
export const migrationSources = pgTable(
  "migration_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "cascade" }),
    sourceName: text("source_name").notNull(),
    sourceType: varchar("source_type", { length: 96 }).notNull(), // csv, legacy_hims_db, excel, api
    vendorName: text("vendor_name"),
    containsPhi: boolean("contains_phi").notNull().default(true),
    dataClassification: dataClassification("data_classification").notNull().default("phi"),
    connectionConfigRef: text("connection_config_ref"),
    fieldInventory: jsonbObj("field_inventory"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [index("migration_sources_tenant_idx").on(t.tenantId, t.sourceType)],
);

export const migrationMappings = pgTable(
  "migration_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => migrationSources.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 96 }).notNull(), // patient, tariff, doctor, appointment, invoice
    mappingVersion: integer("mapping_version").notNull().default(1),
    mappingSpec: jsonbObj("mapping_spec").notNull(),
    validationRules: jsonb("validation_rules").$type<Array<Record<string, unknown>>>().notNull().default(sql`'[]'::jsonb`),
    status: varchar("status", { length: 48 }).notNull().default("draft"),
    approvedByUserId: text("approved_by_user_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("migration_mapping_version_uq").on(t.tenantId, t.sourceId, t.entityType, t.mappingVersion)],
);

export const migrationRuns = pgTable(
  "migration_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenantScopeColumns,
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => migrationSources.id, { onDelete: "restrict" }),
    mappingId: uuid("mapping_id")
      .notNull()
      .references(() => migrationMappings.id, { onDelete: "restrict" }),
    runType: varchar("run_type", { length: 48 }).notNull().default("dry_run"), // dry_run, import, rollback
    status: migrationRunStatus("status").notNull().default("draft"),
    inputObjectId: uuid("input_object_id"),
    inputChecksumSha256: text("input_checksum_sha256"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    totalRows: integer("total_rows").notNull().default(0),
    validRows: integer("valid_rows").notNull().default(0),
    warningRows: integer("warning_rows").notNull().default(0),
    errorRows: integer("error_rows").notNull().default(0),
    importedRows: integer("imported_rows").notNull().default(0),
    rollbackRunId: uuid("rollback_run_id"),
    fidelitySampleRate: text("fidelity_sample_rate").notNull().default("0.005"),
    fidelityScore: text("fidelity_score"),
    manifest: jsonbObj("manifest"),
    errorSummary: jsonbObj("error_summary"),
    ...requestTraceColumns,
    ...timestampColumns,
  },
  (t) => [
    index("migration_runs_tenant_status_idx").on(t.tenantId, t.status, t.runType),
    index("migration_runs_source_idx").on(t.sourceId, t.createdAt),
  ],
);

export const migrationRunRows = pgTable(
  "migration_run_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => migrationRuns.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    sourceExternalId: text("source_external_id"),
    entityType: varchar("entity_type", { length: 96 }).notNull(),
    rowHashSha256: text("row_hash_sha256").notNull(),
    rawRowRef: text("raw_row_ref"),
    normalizedPayload: jsonbObj("normalized_payload"),
    targetResourceType: varchar("target_resource_type", { length: 64 }),
    targetResourceId: uuid("target_resource_id"),
    targetProjectionId: uuid("target_projection_id"),
    status: syncStatus("status").notNull().default("pending"),
    warnings: jsonb("warnings").$type<Array<Record<string, unknown>>>().notNull().default(sql`'[]'::jsonb`),
    errors: jsonb("errors").$type<Array<Record<string, unknown>>>().notNull().default(sql`'[]'::jsonb`),
    duplicateCandidateIds: jsonb("duplicate_candidate_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    importedAt: timestamp("imported_at", { withTimezone: true }),
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("migration_run_row_number_uq").on(t.runId, t.rowNumber),
    index("migration_rows_status_idx").on(t.tenantId, t.runId, t.status),
    index("migration_rows_target_idx").on(t.tenantId, t.targetResourceType, t.targetResourceId),
    index("migration_rows_payload_gin_idx").using("gin", sql`${t.normalizedPayload}`),
  ],
);

export const onboardingChecklists = pgTable(
  "onboarding_checklists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "cascade" }),
    checklistType: varchar("checklist_type", { length: 96 }).notNull(),
    status: varchar("status", { length: 48 }).notNull().default("open"),
    items: jsonb("items").$type<Array<Record<string, unknown>>>().notNull().default(sql`'[]'::jsonb`),
    ownerUserId: text("owner_user_id"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [index("onboarding_tenant_status_idx").on(t.tenantId, t.status, t.checklistType)],
);
