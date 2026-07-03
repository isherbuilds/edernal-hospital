# Schema menu (reference, not adoption target)

Distilled 2026-07-03 from the 125-table `arogya_drizzle_schema_pack` (full original pack: git history, commit `177c068`). Per [ADR-0002](../adr/0002-relational-first-fhir-at-the-seam.md) this is a **menu to pull from per roadmap phase, simplified** — not a schema to adopt wholesale. The real schema lives in `packages/db` and grows one phase at a time ([ROADMAP.md](../ROADMAP.md)).

What was deliberately dropped from the pack: the FHIR-canonical JSONB store as source of truth, Better Auth generated tables (regenerated in `packages/db`), Drizzle `relations` boilerplate, and the pack's project scaffolding.

---

## RLS pattern (load-bearing for Phase 0)

The session-GUC + policy-loop pattern referenced by [ADR-0003](../adr/0003-single-vps-single-postgres-rls.md) and the Phase 0 checklist. Adapt, don't paste blindly — table list and role names will differ.

### 001_extensions.sql

```sql
-- Arogya OS manual SQL bootstrap.
-- Run before Drizzle-generated migrations in every environment.

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists btree_gin;
create extension if not exists pg_trgm;

-- Optional, enable if your managed Postgres permits it.
-- create extension if not exists pgaudit;
```

### 002_rls_context.sql

```sql
-- Request-scoped database context for Postgres RLS.
-- The API/BFF must call app.set_request_context(...) at transaction start.

create schema if not exists app;

create or replace function app.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

create or replace function app.current_facility_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.facility_id', true), '')::uuid
$$;

create or replace function app.current_user_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')
$$;

create or replace function app.current_purpose_of_use()
returns text
language sql
stable
as $$
  select nullif(current_setting('app.purpose_of_use', true), '')
$$;

create or replace function app.rls_bypass_enabled()
returns boolean
language sql
stable
as $$
  select coalesce(nullif(current_setting('app.bypass_rls', true), '')::boolean, false)
$$;

create or replace function app.set_request_context(
  p_tenant_id uuid,
  p_facility_id uuid default null,
  p_user_id text default null,
  p_purpose_of_use text default null,
  p_bypass_rls boolean default false
)
returns void
language plpgsql
as $$
begin
  perform set_config('app.tenant_id', coalesce(p_tenant_id::text, ''), true);
  perform set_config('app.facility_id', coalesce(p_facility_id::text, ''), true);
  perform set_config('app.user_id', coalesce(p_user_id, ''), true);
  perform set_config('app.purpose_of_use', coalesce(p_purpose_of_use, ''), true);
  perform set_config('app.bypass_rls', coalesce(p_bypass_rls, false)::text, true);
end;
$$;
```

### 003_rls_policies.sql

```sql
-- Baseline tenant isolation policies.
-- Do not enable this file against Better Auth's own tables until Better Auth session creation
-- and organization/team flows are adapted to set app.tenant_id.
--
-- Domain tables must include tenant_id. Tables without tenant_id should be protected by
-- application-level service APIs or separate policies.

create or replace function app.enforce_tenant(p_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select app.rls_bypass_enabled() or p_tenant_id is null or p_tenant_id = app.current_tenant_id()
$$;

-- Template used below:
--   alter table <table> enable row level security;
--   alter table <table> force row level security;
--   create policy <table>_tenant_isolation on <table>
--     using (app.enforce_tenant(tenant_id))
--     with check (app.enforce_tenant(tenant_id));

alter table tenants enable row level security;
alter table tenants force row level security;
drop policy if exists tenants_isolation on tenants;
create policy tenants_isolation on tenants
  using (app.rls_bypass_enabled() or id = app.current_tenant_id())
  with check (app.rls_bypass_enabled() or id = app.current_tenant_id());

-- RLS for standard tenant-scoped domain tables.
do $$
declare
  r record;
begin
  for r in
    select unnest(array[
      'tenant_key_versions',
      'facilities',
      'departments',
      'practitioners',
      'practitioner_roles',
      'user_tenant_profiles',
      'role_definitions',
      'user_role_assignments',
      'access_policy_rules',
      'break_glass_sessions',
      'support_access_grants',
      'fhir_resource_versions',
      'fhir_resource_current',
      'patient_projections',
      'patient_identifiers',
      'patient_merge_candidates',
      'patient_merges',
      'encounter_projections',
      'document_references',
      'object_blobs',
      'patient_consents',
      'tenant_config_pack_assignments',
      'payer_catalogs',
      'appointment_books',
      'appointments',
      'queue_boards',
      'queue_tokens',
      'encounter_lifecycle_events',
      'clinical_tasks',
      'prescription_drafts',
      'prescription_lines',
      'medication_safety_checks',
      'clinical_note_signatures',
      'service_catalogs',
      'tariff_plans',
      'tariff_items',
      'billable_order_projections',
      'invoices',
      'invoice_lines',
      'discount_requests',
      'payments',
      'refunds',
      'gst_ledger_entries',
      'claims',
      'claim_documents',
      'claim_pre_scrub_findings',
      'revenue_leakage_items',
      'day_close_runs',
      'scribe_sessions',
      'scribe_audio_chunks',
      'transcripts',
      'ai_generations',
      'ai_artifact_reviews',
      'ai_signoff_guards',
      'ocr_jobs',
      'ai_evaluation_datasets',
      'ai_evaluation_runs',
      'audit_events',
      'audit_immutable_batches',
      'fhir_provenance_records',
      'security_incidents',
      'tenant_export_jobs',
      'integration_connections',
      'integration_messages',
      'webhook_subscriptions',
      'webhook_deliveries',
      'abdm_patient_links',
      'abdm_consent_artifacts',
      'abdm_health_information_links',
      'whatsapp_messages',
      'hl7v2_messages',
      'edge_devices',
      'edge_sync_cursors',
      'edge_command_queue',
      'offline_queues',
      'bill_number_reservations',
      'idempotency_keys',
      'outbox_events',
      'inbox_processed_messages',
      'background_jobs',
      'migration_sources',
      'migration_mappings',
      'migration_runs',
      'migration_run_rows',
      'onboarding_checklists',
      'analytics_events',
      'metric_snapshots'
    ]) as table_name
  loop
    execute format('alter table %I enable row level security', r.table_name);
    execute format('alter table %I force row level security', r.table_name);
    execute format('drop policy if exists %I on %I', r.table_name || '_tenant_isolation', r.table_name);
    execute format(
      'create policy %I on %I using (app.enforce_tenant(tenant_id)) with check (app.enforce_tenant(tenant_id))',
      r.table_name || '_tenant_isolation',
      r.table_name
    );
  end loop;
end $$;
```

---

## \_shared.ts

Column groups (tenant scope, timestamps, soft delete, audit actor) and shared enums. The idea to reuse; trim the groups the pilot doesn't need (encryption/sync columns).

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  inet,
  integer,
  jsonb,
  numeric,
  pgEnum,
  text,
  timestamp,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

/**
 * Shared schema primitives for Arogya OS.
 *
 * Conventions:
 * - All PHI-bearing domain tables carry tenantId/facilityId where applicable.
 * - Domain primary keys are UUIDs generated by Postgres.
 * - Better Auth tables retain string IDs because Better Auth owns those models.
 * - Canonical clinical data lives in fhirResourceVersions; projections are derived/hot-path read models.
 * - Money is numeric(14,2) as string in Drizzle to avoid JS float drift.
 * - Timestamps are timestamptz.
 */

export const lifecycleStatus = pgEnum("lifecycle_status", [
  "draft",
  "active",
  "inactive",
  "archived",
  "deleted"
]);

export const dataClassification = pgEnum("data_classification", [
  "public",
  "internal",
  "pii",
  "phi",
  "financial",
  "security"
]);

export const tenantDeploymentModel = pgEnum("tenant_deployment_model", [
  "shared_saas",
  "dedicated_tenant",
  "dedicated_cluster",
  "customer_managed"
]);

export const tenantLifecycleStatus = pgEnum("tenant_lifecycle_status", [
  "prospect",
  "design_partner",
  "sandbox",
  "onboarding",
  "live",
  "suspended",
  "offboarding",
  "terminated"
]);

export const actorType = pgEnum("actor_type", [
  "user",
  "patient",
  "service",
  "api_key",
  "edge_device",
  "external_system",
  "ai_model"
]);

export const policyDecision = pgEnum("policy_decision", ["allow", "deny", "break_glass_allow"]);

export const purposeOfUse = pgEnum("purpose_of_use", [
  "treatment",
  "payment",
  "healthcare_operations",
  "patient_request",
  "audit",
  "support",
  "emergency",
  "research_deidentified",
  "integration"
]);

export const fhirResourceStatus = pgEnum("fhir_resource_status", [
  "preliminary",
  "final",
  "amended",
  "entered_in_error",
  "superseded"
]);

export const syncStatus = pgEnum("sync_status", [
  "pending",
  "in_progress",
  "succeeded",
  "failed",
  "dead_lettered",
  "cancelled"
]);

export const eventPublishStatus = pgEnum("event_publish_status", [
  "pending",
  "published",
  "failed",
  "dead_lettered",
  "replayed"
]);

export const consentStatus = pgEnum("consent_status", [
  "draft",
  "requested",
  "granted",
  "denied",
  "active",
  "revoked",
  "expired",
  "superseded"
]);

export const encounterClass = pgEnum("encounter_class", [
  "opd",
  "ipd",
  "er",
  "telehealth",
  "home_visit"
]);

export const encounterStatus = pgEnum("encounter_status", [
  "planned",
  "arrived",
  "triaged",
  "in_progress",
  "on_hold",
  "finished",
  "cancelled",
  "entered_in_error"
]);

export const appointmentStatus = pgEnum("appointment_status", [
  "proposed",
  "pending",
  "booked",
  "arrived",
  "fulfilled",
  "cancelled",
  "noshow",
  "waitlist"
]);

export const queueTokenStatus = pgEnum("queue_token_status", [
  "issued",
  "checked_in",
  "called",
  "in_consult",
  "skipped",
  "completed",
  "cancelled"
]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "authorized",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
  "voided",
  "reconciled"
]);

export const invoiceStatus = pgEnum("invoice_status", [
  "draft",
  "finalized",
  "partially_paid",
  "paid",
  "voided",
  "refunded",
  "written_off"
]);

export const claimStatus = pgEnum("claim_status", [
  "draft",
  "preauth_requested",
  "preauth_approved",
  "preauth_rejected",
  "assembled",
  "submitted",
  "queried",
  "approved",
  "partially_approved",
  "rejected",
  "settled",
  "cancelled"
]);

export const aiArtifactStatus = pgEnum("ai_artifact_status", [
  "captured",
  "processing",
  "draft",
  "needs_review",
  "accepted",
  "rejected",
  "deleted",
  "failed"
]);

export const aiReviewOutcome = pgEnum("ai_review_outcome", [
  "accepted_no_edits",
  "accepted_minor_edits",
  "accepted_major_edits",
  "rejected",
  "not_reviewed"
]);

export const safetySeverity = pgEnum("safety_severity", [
  "info",
  "low",
  "moderate",
  "high",
  "severe_blocking"
]);

export const objectStorageProvider = pgEnum("object_storage_provider", [
  "s3",
  "gcs",
  "azure_blob",
  "local_minio"
]);

export const integrationKind = pgEnum("integration_kind", [
  "abdm",
  "nhcx",
  "whatsapp_bsp",
  "sms",
  "payment_gateway",
  "stt_vendor",
  "llm_vendor",
  "lis_hl7v2",
  "pharmacy_hl7v2",
  "pacs_dicom",
  "email"
]);

export const integrationEnvironment = pgEnum("integration_environment", [
  "mock",
  "sandbox",
  "staging",
  "production"
]);

export const integrationMessageDirection = pgEnum("integration_message_direction", [
  "inbound",
  "outbound"
]);

export const migrationRunStatus = pgEnum("migration_run_status", [
  "draft",
  "validating",
  "validated",
  "importing",
  "succeeded",
  "succeeded_with_warnings",
  "failed",
  "rolled_back"
]);

export const supportAccessStatus = pgEnum("support_access_status", [
  "requested",
  "approved",
  "active",
  "expired",
  "revoked",
  "denied"
]);

export const edgeDeviceStatus = pgEnum("edge_device_status", [
  "provisioned",
  "active",
  "degraded",
  "offline",
  "quarantined",
  "revoked"
]);

export const jobPriority = pgEnum("job_priority", ["low", "normal", "high", "critical"]);

export const exportStatus = pgEnum("export_status", [
  "requested",
  "approved",
  "running",
  "succeeded",
  "failed",
  "expired",
  "cancelled"
]);

export const timestampColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const softDeleteColumns = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedByUserId: text("deleted_by_user_id"),
  deletionReason: text("deletion_reason")
};

export const auditActorColumns = {
  createdByUserId: text("created_by_user_id"),
  updatedByUserId: text("updated_by_user_id")
};

export const tenantScopeColumns = {
  tenantId: uuid("tenant_id").notNull()
};

export const facilityScopeColumns = {
  facilityId: uuid("facility_id")
};

export const encryptionColumns = {
  encryptionKeyId: text("encryption_key_id"),
  encryptionKeyVersion: integer("encryption_key_version"),
  encryptedDek: text("encrypted_dek")
};

export const requestTraceColumns = {
  requestId: text("request_id"),
  traceId: text("trace_id"),
  spanId: text("span_id")
};

export const networkColumns = {
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  deviceId: text("device_id")
};

export const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
export const quantity = (name: string) => numeric(name, { precision: 14, scale: 4 });
export const percent = (name: string) => numeric(name, { precision: 7, scale: 4 });

export const jsonbObj = <T extends Record<string, unknown> = Record<string, unknown>>(
  name: string
) => jsonb(name).$type<T>();

export const jsonbArray = <T = unknown>(name: string) => jsonb(name).$type<T[]>();

export const dateOnly = (name: string) => date(name, { mode: "string" });

export const activeCheck = (column: { deletedAt?: unknown }) => sql`deleted_at is null`;

export type JsonRecord = Record<string, unknown>;
```

## iam.ts

Tenants, facilities, staff/practitioner profiles, role assignments. Feeds ROADMAP Phase 0.

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import {
  auditActorColumns,
  dataClassification,
  facilityScopeColumns,
  jsonbObj,
  lifecycleStatus,
  supportAccessStatus,
  tenantDeploymentModel,
  tenantLifecycleStatus,
  tenantScopeColumns,
  timestampColumns
} from "./_shared";
import { user } from "./auth.generated";

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legalName: text("legal_name").notNull(),
    displayName: text("display_name").notNull(),
    slug: varchar("slug", { length: 128 }).notNull(),
    lifecycleStatus: tenantLifecycleStatus("lifecycle_status").notNull().default("prospect"),
    deploymentModel: tenantDeploymentModel("deployment_model")
      .notNull()
      .default("dedicated_tenant"),
    authOrganizationId: text("auth_organization_id"),
    countryCode: varchar("country_code", { length: 2 }).notNull().default("IN"),
    defaultLocale: varchar("default_locale", { length: 32 }).notNull().default("en-IN"),
    defaultTimezone: varchar("default_timezone", { length: 64 }).notNull().default("Asia/Kolkata"),
    dataResidencyRegion: varchar("data_residency_region", { length: 64 })
      .notNull()
      .default("in-west"),
    configPackId: uuid("config_pack_id"),
    kmsKeyId: text("kms_key_id"),
    kmsKeyVersion: integer("kms_key_version").notNull().default(1),
    phiEnabledAt: timestamp("phi_enabled_at", { withTimezone: true }),
    goLiveAt: timestamp("go_live_at", { withTimezone: true }),
    offboardedAt: timestamp("offboarded_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("tenants_slug_uq").on(t.slug),
    uniqueIndex("tenants_auth_org_uq").on(t.authOrganizationId),
    index("tenants_lifecycle_idx").on(t.lifecycleStatus)
  ]
);

export const tenantKeyVersions = pgTable(
  "tenant_key_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    keyVersion: integer("key_version").notNull(),
    kmsKeyId: text("kms_key_id").notNull(),
    purpose: text("purpose").notNull().default("envelope_encryption"),
    status: lifecycleStatus("status").notNull().default("active"),
    activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("tenant_key_version_uq").on(t.tenantId, t.keyVersion),
    index("tenant_key_active_idx").on(t.tenantId, t.status)
  ]
);

export const facilities = pgTable(
  "facilities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: text("name").notNull(),
    facilityType: text("facility_type").notNull().default("hospital"),
    abdmFacilityId: text("abdm_facility_id"),
    gstin: varchar("gstin", { length: 32 }),
    address: jsonbObj("address"),
    contact: jsonbObj("contact"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Kolkata"),
    status: lifecycleStatus("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("facilities_tenant_code_uq").on(t.tenantId, t.code),
    uniqueIndex("facilities_abdm_id_uq").on(t.abdmFacilityId),
    index("facilities_tenant_idx").on(t.tenantId)
  ]
);

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: text("name").notNull(),
    specialtyCode: text("specialty_code"),
    status: lifecycleStatus("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("departments_tenant_facility_code_uq").on(t.tenantId, t.facilityId, t.code),
    index("departments_tenant_idx").on(t.tenantId)
  ]
);

export const practitioners = pgTable(
  "practitioners",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    fhirPractitionerId: uuid("fhir_practitioner_id"),
    displayName: text("display_name").notNull(),
    registrationCouncil: text("registration_council"),
    registrationNumber: text("registration_number"),
    qualifications: jsonb("qualifications").$type<Array<Record<string, unknown>>>(),
    specialties: jsonb("specialties").$type<string[]>(),
    defaultDepartmentId: uuid("default_department_id").references(() => departments.id, {
      onDelete: "set null"
    }),
    status: lifecycleStatus("status").notNull().default("active"),
    signatureObjectId: uuid("signature_object_id"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("practitioner_user_tenant_uq").on(t.tenantId, t.userId),
    uniqueIndex("practitioner_registration_uq").on(
      t.tenantId,
      t.registrationCouncil,
      t.registrationNumber
    ),
    index("practitioner_tenant_idx").on(t.tenantId)
  ]
);

export const practitionerRoles = pgTable(
  "practitioner_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    practitionerId: uuid("practitioner_id")
      .notNull()
      .references(() => practitioners.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    roleCode: text("role_code").notNull(),
    specialtyCode: text("specialty_code"),
    activeFrom: timestamp("active_from", { withTimezone: true }).notNull().defaultNow(),
    activeTo: timestamp("active_to", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    index("practitioner_roles_lookup_idx").on(t.tenantId, t.facilityId, t.departmentId, t.roleCode)
  ]
);

export const userTenantProfiles = pgTable(
  "user_tenant_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    employeeCode: varchar("employee_code", { length: 64 }),
    homeFacilityId: uuid("home_facility_id").references(() => facilities.id, {
      onDelete: "set null"
    }),
    practitionerId: uuid("practitioner_id").references(() => practitioners.id, {
      onDelete: "set null"
    }),
    status: lifecycleStatus("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("user_tenant_profiles_uq").on(t.tenantId, t.userId),
    index("user_profiles_tenant_idx").on(t.tenantId)
  ]
);

export const permissionCatalog = pgTable(
  "permission_catalog",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    resource: text("resource").notNull(),
    action: text("action").notNull(),
    dataClassification: dataClassification("data_classification").notNull().default("internal"),
    isClinical: boolean("is_clinical").notNull().default(false),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("permission_catalog_code_uq").on(t.code),
    index("permission_catalog_resource_idx").on(t.resource, t.action)
  ]
);

export const roleDefinitions = pgTable(
  "role_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isSystemRole: boolean("is_system_role").notNull().default(false),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [uniqueIndex("role_definitions_tenant_code_uq").on(t.tenantId, t.code)]
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roleDefinitions.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissionCatalog.id, { onDelete: "cascade" }),
    constraints: jsonbObj("constraints"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })]
);

export const userRoleAssignments = pgTable(
  "user_role_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roleDefinitions.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    reason: text("reason"),
    ...auditActorColumns,
    ...timestampColumns
  },
  (t) => [
    index("user_role_assignments_user_idx").on(t.tenantId, t.userId),
    index("user_role_assignments_role_idx").on(t.roleId)
  ]
);

export const accessPolicyRules = pgTable(
  "access_policy_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    effect: text("effect").notNull(), // allow | deny | require_break_glass
    priority: integer("priority").notNull().default(1000),
    resourceType: text("resource_type").notNull(),
    action: text("action").notNull(),
    purposeOfUse: text("purpose_of_use"),
    condition: jsonbObj("condition"),
    status: lifecycleStatus("status").notNull().default("active"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("access_policy_rules_code_uq").on(t.tenantId, t.code),
    index("access_policy_rules_lookup_idx").on(t.tenantId, t.resourceType, t.action)
  ]
);

export const breakGlassSessions = pgTable(
  "break_glass_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id").notNull(),
    encounterId: uuid("encounter_id"),
    reasonCode: text("reason_code").notNull(),
    reasonText: text("reason_text").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    approvedByUserId: text("approved_by_user_id").references(() => user.id, {
      onDelete: "set null"
    }),
    auditEventId: uuid("audit_event_id"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [index("break_glass_active_idx").on(t.tenantId, t.userId, t.patientId, t.expiresAt)]
);

export const supportAccessGrants = pgTable(
  "support_access_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    requestedByUserId: text("requested_by_user_id").notNull(),
    approvedByUserId: text("approved_by_user_id"),
    supportUserId: text("support_user_id").notNull(),
    status: supportAccessStatus("status").notNull().default("requested"),
    scope: jsonbObj("scope").notNull(),
    reason: text("reason").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    approvalTicketUrl: text("approval_ticket_url"),
    ...timestampColumns
  },
  (t) => [index("support_access_tenant_status_idx").on(t.tenantId, t.status, t.expiresAt)]
);
```

## audit.ts

Append-only audit events. Feeds Phase 0 (Trust Envelope control #4, ADR-0004).

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import {
  actorType,
  dataClassification,
  exportStatus,
  jsonbArray,
  jsonbObj,
  networkColumns,
  policyDecision,
  purposeOfUse,
  requestTraceColumns,
  timestampColumns
} from "./_shared";
import { tenants, facilities } from "./iam";

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    actorType: actorType("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    actorUserId: text("actor_user_id"),
    actorRole: text("actor_role"),
    patientLogicalId: uuid("patient_logical_id"),
    encounterLogicalId: uuid("encounter_logical_id"),
    resourceType: text("resource_type"),
    resourceLogicalId: uuid("resource_logical_id"),
    resourceVersion: integer("resource_version"),
    action: text("action").notNull(),
    purposeOfUse: purposeOfUse("purpose_of_use").notNull(),
    decision: policyDecision("decision").notNull(),
    policyRuleId: uuid("policy_rule_id"),
    dataClassification: dataClassification("data_classification").notNull().default("internal"),
    reasonCode: text("reason_code"),
    reasonText: text("reason_text"),
    clientApp: text("client_app"),
    endpoint: text("endpoint"),
    httpMethod: text("http_method"),
    httpStatus: integer("http_status"),
    oldValueHash: text("old_value_hash"),
    newValueHash: text("new_value_hash"),
    metadata: jsonbObj("metadata"),
    previousHash: text("previous_hash"),
    eventHash: text("event_hash").notNull(),
    immutableBatchId: uuid("immutable_batch_id"),
    ...networkColumns,
    ...requestTraceColumns
  },
  (t) => [
    index("audit_patient_timeline_idx").on(t.tenantId, t.patientLogicalId, t.occurredAt),
    index("audit_actor_timeline_idx").on(t.tenantId, t.actorUserId, t.occurredAt),
    index("audit_resource_idx").on(t.tenantId, t.resourceType, t.resourceLogicalId, t.occurredAt),
    index("audit_decision_idx").on(t.tenantId, t.decision, t.occurredAt),
    index("audit_trace_idx").on(t.traceId)
  ]
);

export const auditImmutableBatches = pgTable(
  "audit_immutable_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sequenceStartAt: timestamp("sequence_start_at", { withTimezone: true }).notNull(),
    sequenceEndAt: timestamp("sequence_end_at", { withTimezone: true }).notNull(),
    firstEventId: uuid("first_event_id").notNull(),
    lastEventId: uuid("last_event_id").notNull(),
    eventCount: integer("event_count").notNull(),
    merkleRootHash: text("merkle_root_hash").notNull(),
    storageProvider: text("storage_provider").notNull(),
    storageUri: text("storage_uri").notNull(),
    storageObjectHash: text("storage_object_hash").notNull(),
    sealedAt: timestamp("sealed_at", { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [index("audit_batch_tenant_time_idx").on(t.tenantId, t.sequenceStartAt, t.sequenceEndAt)]
);

export const fhirProvenanceRecords = pgTable(
  "fhir_provenance_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    patientLogicalId: uuid("patient_logical_id"),
    targetResourceType: text("target_resource_type").notNull(),
    targetLogicalId: uuid("target_logical_id").notNull(),
    targetVersionId: uuid("target_version_id").notNull(),
    provenanceLogicalId: uuid("provenance_logical_id"),
    activityCode: text("activity_code").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    agentType: text("agent_type").notNull(), // user | ai_model | device | organization
    agentId: text("agent_id").notNull(),
    agentRole: text("agent_role"),
    entityRefs: jsonbArray<Record<string, unknown>>("entity_refs"),
    signature: jsonbObj("signature"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    index("provenance_target_idx").on(
      t.tenantId,
      t.targetResourceType,
      t.targetLogicalId,
      t.targetVersionId
    ),
    index("provenance_patient_idx").on(t.tenantId, t.patientLogicalId, t.occurredAt)
  ]
);

export const securityIncidents = pgTable(
  "security_incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    severity: text("severity").notNull(),
    status: text("status").notNull().default("open"),
    title: text("title").notNull(),
    description: text("description"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    containedAt: timestamp("contained_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    affectedPatientsCount: integer("affected_patients_count"),
    affectedResources: jsonbObj("affected_resources"),
    regulatoryNotificationRequired: boolean("regulatory_notification_required")
      .notNull()
      .default(false),
    customerNotificationRequired: boolean("customer_notification_required")
      .notNull()
      .default(false),
    ownerUserId: text("owner_user_id"),
    rootCause: text("root_cause"),
    correctiveActions: jsonbArray<Record<string, unknown>>("corrective_actions"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    index("security_incident_status_idx").on(t.status, t.severity, t.detectedAt),
    index("security_incident_tenant_idx").on(t.tenantId)
  ]
);

export const tenantExportJobs = pgTable(
  "tenant_export_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    requestedByUserId: text("requested_by_user_id").notNull(),
    approvedByUserId: text("approved_by_user_id"),
    status: exportStatus("status").notNull().default("requested"),
    exportType: text("export_type").notNull(), // fhir_bundle | csv | audit | full_offboarding
    scope: jsonbObj("scope").notNull(),
    includesPhi: boolean("includes_phi").notNull().default(true),
    reason: text("reason").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    objectId: uuid("object_id"),
    manifest: jsonbObj("manifest"),
    checksumSha256: text("checksum_sha256"),
    failureReason: text("failure_reason"),
    ...timestampColumns
  },
  (t) => [index("tenant_export_status_idx").on(t.tenantId, t.status, t.createdAt)]
);

export const operationalLogRedactionRules = pgTable(
  "operational_log_redaction_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    description: text("description"),
    pattern: text("pattern").notNull(),
    replacement: text("replacement").notNull().default("[REDACTED]"),
    enabled: boolean("enabled").notNull().default(true),
    severity: text("severity").notNull().default("medium"),
    ...timestampColumns
  },
  (t) => [uniqueIndex("log_redaction_code_uq").on(t.code)]
);
```

## clinical.ts

Patients, encounters, notes, prescriptions, orders. Feeds Phases 1–3 — simplify heavily; the pack's shapes assume the full PRD suite.

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import {
  appointmentStatus,
  auditActorColumns,
  encounterClass,
  encounterStatus,
  jsonbArray,
  jsonbObj,
  queueTokenStatus,
  safetySeverity,
  timestampColumns
} from "./_shared";
import { tenants, facilities, departments, practitioners } from "./iam";
import { patientProjections, encounterProjections, fhirResourceCurrent } from "./fhir";
import { drugInteractionRules, drugProducts } from "./config";

export const appointmentBooks = pgTable(
  "appointment_books",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    practitionerId: uuid("practitioner_id").references(() => practitioners.id, {
      onDelete: "cascade"
    }),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    visitType: text("visit_type").notNull().default("opd_consult"),
    slotDurationMinutes: integer("slot_duration_minutes").notNull().default(10),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    status: text("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    index("appointment_books_lookup_idx").on(
      t.tenantId,
      t.facilityId,
      t.practitionerId,
      t.departmentId
    )
  ]
);

export const appointmentBookSchedules = pgTable(
  "appointment_book_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appointmentBookId: uuid("appointment_book_id")
      .notNull()
      .references(() => appointmentBooks.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(), // 0=Sun
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    maxSlots: integer("max_slots"),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    effectiveTo: date("effective_to", { mode: "string" }),
    exceptions: jsonbArray("exceptions"),
    ...timestampColumns
  },
  (t) => [
    index("appointment_book_schedule_idx").on(t.appointmentBookId, t.dayOfWeek, t.effectiveFrom)
  ]
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    appointmentBookId: uuid("appointment_book_id").references(() => appointmentBooks.id, {
      onDelete: "set null"
    }),
    fhirAppointmentId: uuid("fhir_appointment_id").references(() => fhirResourceCurrent.id, {
      onDelete: "set null"
    }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    practitionerId: uuid("practitioner_id").references(() => practitioners.id, {
      onDelete: "set null"
    }),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    status: appointmentStatus("status").notNull().default("booked"),
    appointmentType: text("appointment_type").notNull().default("opd_consult"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
    bookedByUserId: text("booked_by_user_id"),
    cancelledByUserId: text("cancelled_by_user_id"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    source: text("source").notNull().default("front_desk"),
    idempotencyKey: text("idempotency_key"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("appointments_idempotency_uq").on(t.tenantId, t.idempotencyKey),
    index("appointments_slot_lookup_idx").on(t.tenantId, t.practitionerId, t.startsAt, t.status),
    index("appointments_patient_idx").on(t.tenantId, t.patientLogicalId, t.startsAt)
  ]
);

export const queueBoards = pgTable(
  "queue_boards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    practitionerId: uuid("practitioner_id").references(() => practitioners.id, {
      onDelete: "cascade"
    }),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    boardDate: date("board_date", { mode: "string" }).notNull(),
    status: text("status").notNull().default("open"),
    currentTokenNumber: integer("current_token_number"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("queue_board_unique_uq").on(
      t.tenantId,
      t.facilityId,
      t.practitionerId,
      t.departmentId,
      t.boardDate
    )
  ]
);

export const queueTokens = pgTable(
  "queue_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    queueBoardId: uuid("queue_board_id")
      .notNull()
      .references(() => queueBoards.id, { onDelete: "cascade" }),
    tokenNumber: integer("token_number").notNull(),
    tokenLabel: varchar("token_label", { length: 32 }).notNull(),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "set null"
    }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    encounterLogicalId: uuid("encounter_logical_id"),
    status: queueTokenStatus("status").notNull().default("issued"),
    priority: integer("priority").notNull().default(0),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    calledAt: timestamp("called_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    estimatedWaitMinutes: integer("estimated_wait_minutes"),
    idempotencyKey: text("idempotency_key"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("queue_token_number_uq").on(t.queueBoardId, t.tokenNumber),
    uniqueIndex("queue_token_idempotency_uq").on(t.tenantId, t.idempotencyKey),
    index("queue_token_board_status_idx").on(t.queueBoardId, t.status, t.priority, t.tokenNumber)
  ]
);

export const encounterLifecycleEvents = pgTable(
  "encounter_lifecycle_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    encounterLogicalId: uuid("encounter_logical_id").notNull(),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    eventType: text("event_type").notNull(),
    fromStatus: encounterStatus("from_status"),
    toStatus: encounterStatus("to_status"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    actorUserId: text("actor_user_id"),
    reason: text("reason"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [index("encounter_lifecycle_idx").on(t.tenantId, t.encounterLogicalId, t.occurredAt)]
);

export const clinicalTasks = pgTable(
  "clinical_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "cascade" }),
    patientLogicalId: uuid("patient_logical_id"),
    encounterLogicalId: uuid("encounter_logical_id"),
    assignedToUserId: text("assigned_to_user_id"),
    assignedToPractitionerId: uuid("assigned_to_practitioner_id").references(
      () => practitioners.id,
      { onDelete: "set null" }
    ),
    taskType: text("task_type").notNull(),
    status: text("status").notNull().default("requested"),
    priority: text("priority").notNull().default("routine"),
    title: text("title").notNull(),
    description: text("description"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    fhirTaskId: uuid("fhir_task_id"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    index("clinical_task_assignee_idx").on(t.tenantId, t.assignedToUserId, t.status, t.dueAt),
    index("clinical_task_patient_idx").on(t.tenantId, t.patientLogicalId)
  ]
);

export const prescriptionDrafts = pgTable(
  "prescription_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    encounterLogicalId: uuid("encounter_logical_id").notNull(),
    practitionerId: uuid("practitioner_id").references(() => practitioners.id, {
      onDelete: "set null"
    }),
    source: text("source").notNull().default("manual"), // manual | ai_scribe | imported
    status: text("status").notNull().default("draft"),
    fhirMedicationRequestIds: uuid("fhir_medication_request_ids").array(),
    mandatoryReviewFields: jsonbArray("mandatory_review_fields"),
    signedByUserId: text("signed_by_user_id"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [index("prescription_draft_encounter_idx").on(t.tenantId, t.encounterLogicalId, t.status)]
);

export const prescriptionLines = pgTable(
  "prescription_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    prescriptionDraftId: uuid("prescription_draft_id")
      .notNull()
      .references(() => prescriptionDrafts.id, { onDelete: "cascade" }),
    drugProductId: uuid("drug_product_id").references(() => drugProducts.id, {
      onDelete: "set null"
    }),
    medicationText: text("medication_text").notNull(),
    genericName: text("generic_name"),
    dose: text("dose"),
    route: text("route"),
    frequency: text("frequency"),
    duration: text("duration"),
    instructions: text("instructions"),
    quantity: text("quantity"),
    sequence: integer("sequence").notNull(),
    sourceConfidence: integer("source_confidence"),
    requiresMandatoryReview: boolean("requires_mandatory_review").notNull().default(true),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: text("reviewed_by_user_id"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [index("prescription_line_draft_idx").on(t.prescriptionDraftId, t.sequence)]
);

export const medicationSafetyChecks = pgTable(
  "medication_safety_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    prescriptionDraftId: uuid("prescription_draft_id")
      .notNull()
      .references(() => prescriptionDrafts.id, { onDelete: "cascade" }),
    checkType: text("check_type").notNull(), // interaction | allergy | duplicate_therapy | dose_range | pregnancy | pediatric
    severity: safetySeverity("severity").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    recommendation: text("recommendation"),
    isBlocking: boolean("is_blocking").notNull().default(false),
    ruleId: uuid("rule_id").references(() => drugInteractionRules.id, { onDelete: "set null" }),
    involvedLineIds: uuid("involved_line_ids").array(),
    status: text("status").notNull().default("active"),
    overriddenByUserId: text("overridden_by_user_id"),
    overriddenAt: timestamp("overridden_at", { withTimezone: true }),
    overrideReasonCode: text("override_reason_code"),
    overrideReasonText: text("override_reason_text"),
    fhirDetectedIssueId: uuid("fhir_detected_issue_id"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [index("med_safety_draft_idx").on(t.tenantId, t.prescriptionDraftId, t.severity, t.status)]
);

export const clinicalNoteSignatures = pgTable(
  "clinical_note_signatures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    encounterLogicalId: uuid("encounter_logical_id").notNull(),
    compositionLogicalId: uuid("composition_logical_id").notNull(),
    compositionVersionId: uuid("composition_version_id").notNull(),
    signedByUserId: text("signed_by_user_id").notNull(),
    signedByPractitionerId: uuid("signed_by_practitioner_id").references(() => practitioners.id, {
      onDelete: "set null"
    }),
    signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
    signatureHash: text("signature_hash").notNull(),
    attestationText: text("attestation_text").notNull(),
    source: text("source").notNull().default("doctor_tablet"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("clinical_note_signature_uq").on(
      t.tenantId,
      t.compositionLogicalId,
      t.compositionVersionId
    )
  ]
);
```

## revenue.ts

Charges, invoices, payments, credit notes, service catalog. Feeds Phase 3.

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import {
  auditActorColumns,
  claimStatus,
  invoiceStatus,
  jsonbArray,
  jsonbObj,
  money,
  paymentStatus,
  percent,
  quantity,
  timestampColumns
} from "./_shared";
import { tenants, facilities, departments } from "./iam";
import { payerCatalogs, taxRules } from "./config";

export const serviceCatalogs = pgTable(
  "service_catalogs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    serviceType: text("service_type").notNull(),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    defaultChargeCode: text("default_charge_code"),
    isBillable: boolean("is_billable").notNull().default(true),
    isClinicalOrderable: boolean("is_clinical_orderable").notNull().default(true),
    taxRuleId: uuid("tax_rule_id").references(() => taxRules.id, { onDelete: "set null" }),
    status: text("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("service_catalog_tenant_code_uq").on(t.tenantId, t.code),
    index("service_catalog_type_idx").on(t.tenantId, t.serviceType)
  ]
);

export const tariffPlans = pgTable(
  "tariff_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "cascade" }),
    payerId: uuid("payer_id").references(() => payerCatalogs.id, { onDelete: "set null" }),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    status: text("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("tariff_plan_tenant_code_uq").on(t.tenantId, t.code, t.effectiveFrom),
    index("tariff_plan_payer_idx").on(t.tenantId, t.payerId)
  ]
);

export const tariffItems = pgTable(
  "tariff_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    tariffPlanId: uuid("tariff_plan_id")
      .notNull()
      .references(() => tariffPlans.id, { onDelete: "cascade" }),
    serviceCatalogId: uuid("service_catalog_id")
      .notNull()
      .references(() => serviceCatalogs.id, { onDelete: "cascade" }),
    chargeCode: text("charge_code"),
    unitPrice: money("unit_price").notNull(),
    minPrice: money("min_price"),
    maxPrice: money("max_price"),
    taxRuleId: uuid("tax_rule_id").references(() => taxRules.id, { onDelete: "set null" }),
    packageRules: jsonbObj("package_rules"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [uniqueIndex("tariff_item_service_uq").on(t.tariffPlanId, t.serviceCatalogId)]
);

export const billableOrderProjections = pgTable(
  "billable_order_projections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    encounterLogicalId: uuid("encounter_logical_id").notNull(),
    serviceRequestLogicalId: uuid("service_request_logical_id"),
    serviceCatalogId: uuid("service_catalog_id").references(() => serviceCatalogs.id, {
      onDelete: "set null"
    }),
    sourceResourceType: text("source_resource_type").notNull(),
    sourceLogicalId: uuid("source_logical_id").notNull(),
    description: text("description").notNull(),
    quantity: quantity("quantity").notNull().default("1"),
    status: text("status").notNull().default("ordered"),
    orderedAt: timestamp("ordered_at", { withTimezone: true }).notNull(),
    billedAt: timestamp("billed_at", { withTimezone: true }),
    invoiceLineId: uuid("invoice_line_id"),
    leakageDetectedAt: timestamp("leakage_detected_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("billable_order_source_uq").on(t.tenantId, t.sourceResourceType, t.sourceLogicalId),
    index("billable_order_unbilled_idx").on(t.tenantId, t.encounterLogicalId, t.status, t.orderedAt)
  ]
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    fhirInvoiceLogicalId: uuid("fhir_invoice_logical_id"),
    invoiceNumber: text("invoice_number").notNull(),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    encounterLogicalId: uuid("encounter_logical_id"),
    payerId: uuid("payer_id").references(() => payerCatalogs.id, { onDelete: "set null" }),
    tariffPlanId: uuid("tariff_plan_id").references(() => tariffPlans.id, { onDelete: "set null" }),
    status: invoiceStatus("status").notNull().default("draft"),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    subtotalAmount: money("subtotal_amount").notNull().default("0"),
    discountAmount: money("discount_amount").notNull().default("0"),
    taxAmount: money("tax_amount").notNull().default("0"),
    totalAmount: money("total_amount").notNull().default("0"),
    paidAmount: money("paid_amount").notNull().default("0"),
    balanceAmount: money("balance_amount").notNull().default("0"),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    finalizedByUserId: text("finalized_by_user_id"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    gstInvoiceHash: text("gst_invoice_hash"),
    metadata: jsonbObj("metadata"),
    ...auditActorColumns,
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("invoice_number_facility_uq").on(t.tenantId, t.facilityId, t.invoiceNumber),
    index("invoice_patient_idx").on(t.tenantId, t.patientLogicalId, t.createdAt),
    index("invoice_status_idx").on(t.tenantId, t.status, t.finalizedAt)
  ]
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    serviceCatalogId: uuid("service_catalog_id").references(() => serviceCatalogs.id, {
      onDelete: "set null"
    }),
    billableOrderId: uuid("billable_order_id").references(() => billableOrderProjections.id, {
      onDelete: "set null"
    }),
    description: text("description").notNull(),
    quantity: quantity("quantity").notNull().default("1"),
    unitPrice: money("unit_price").notNull(),
    grossAmount: money("gross_amount").notNull(),
    discountAmount: money("discount_amount").notNull().default("0"),
    taxAmount: money("tax_amount").notNull().default("0"),
    netAmount: money("net_amount").notNull(),
    taxBreakup: jsonbArray<Record<string, unknown>>("tax_breakup"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("invoice_line_sequence_uq").on(t.invoiceId, t.sequence),
    index("invoice_line_order_idx").on(t.billableOrderId)
  ]
);

export const discountRequests = pgTable(
  "discount_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    requestedByUserId: text("requested_by_user_id").notNull(),
    approvedByUserId: text("approved_by_user_id"),
    status: text("status").notNull().default("requested"),
    discountType: text("discount_type").notNull(),
    discountPercent: percent("discount_percent"),
    discountAmount: money("discount_amount"),
    reasonCode: text("reason_code").notNull(),
    reasonText: text("reason_text"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [index("discount_request_status_idx").on(t.tenantId, t.status, t.requestedAt)]
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    patientLogicalId: uuid("patient_logical_id"),
    paymentNumber: text("payment_number").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    method: text("method").notNull(),
    amount: money("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    gatewayProvider: text("gateway_provider"),
    gatewayOrderId: text("gateway_order_id"),
    gatewayPaymentId: text("gateway_payment_id"),
    gatewaySettlementId: text("gateway_settlement_id"),
    collectedByUserId: text("collected_by_user_id"),
    collectedAt: timestamp("collected_at", { withTimezone: true }),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("payment_number_uq").on(t.tenantId, t.paymentNumber),
    index("payment_invoice_idx").on(t.invoiceId),
    index("payment_gateway_idx").on(t.gatewayProvider, t.gatewayPaymentId)
  ]
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    refundNumber: text("refund_number").notNull(),
    amount: money("amount").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    reasonCode: text("reason_code").notNull(),
    reasonText: text("reason_text"),
    gatewayRefundId: text("gateway_refund_id"),
    requestedByUserId: text("requested_by_user_id"),
    approvedByUserId: text("approved_by_user_id"),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("refund_number_uq").on(t.tenantId, t.refundNumber),
    index("refund_payment_idx").on(t.paymentId)
  ]
);

export const gstLedgerEntries = pgTable(
  "gst_ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "restrict" }),
    entryNumber: text("entry_number").notNull(),
    entryType: text("entry_type").notNull(), // invoice | credit_note | debit_note | refund
    gstin: text("gstin"),
    hsnSacCode: text("hsn_sac_code"),
    taxableAmount: money("taxable_amount").notNull(),
    cgstAmount: money("cgst_amount").notNull().default("0"),
    sgstAmount: money("sgst_amount").notNull().default("0"),
    igstAmount: money("igst_amount").notNull().default("0"),
    totalTaxAmount: money("total_tax_amount").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("gst_ledger_entry_number_uq").on(t.tenantId, t.facilityId, t.entryNumber),
    index("gst_ledger_invoice_idx").on(t.invoiceId)
  ]
);

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    encounterLogicalId: uuid("encounter_logical_id").notNull(),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    payerId: uuid("payer_id").references(() => payerCatalogs.id, { onDelete: "set null" }),
    fhirClaimLogicalId: uuid("fhir_claim_logical_id"),
    claimNumber: text("claim_number").notNull(),
    status: claimStatus("status").notNull().default("draft"),
    claimType: text("claim_type").notNull().default("cashless"),
    requestedAmount: money("requested_amount"),
    approvedAmount: money("approved_amount"),
    settledAmount: money("settled_amount"),
    completenessScore: integer("completeness_score"),
    missingItems: jsonbArray<Record<string, unknown>>("missing_items"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    decisionAt: timestamp("decision_at", { withTimezone: true }),
    settlementAt: timestamp("settlement_at", { withTimezone: true }),
    externalClaimId: text("external_claim_id"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("claim_number_uq").on(t.tenantId, t.claimNumber),
    index("claim_status_idx").on(t.tenantId, t.status, t.submittedAt),
    index("claim_patient_idx").on(t.tenantId, t.patientLogicalId)
  ]
);

export const claimDocuments = pgTable(
  "claim_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => claims.id, { onDelete: "cascade" }),
    documentReferenceId: uuid("document_reference_id").notNull(),
    checklistCode: text("checklist_code"),
    status: text("status").notNull().default("attached"),
    verifiedByUserId: text("verified_by_user_id"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [uniqueIndex("claim_document_uq").on(t.claimId, t.documentReferenceId)]
);

export const claimPreScrubFindings = pgTable(
  "claim_pre_scrub_findings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => claims.id, { onDelete: "cascade" }),
    severity: text("severity").notNull(),
    findingCode: text("finding_code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    recommendation: text("recommendation"),
    status: text("status").notNull().default("open"),
    resolvedByUserId: text("resolved_by_user_id"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [index("claim_prescrub_open_idx").on(t.tenantId, t.claimId, t.status, t.severity)]
);

export const revenueLeakageItems = pgTable(
  "revenue_leakage_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    patientLogicalId: uuid("patient_logical_id"),
    encounterLogicalId: uuid("encounter_logical_id"),
    leakageType: text("leakage_type").notNull(),
    sourceId: uuid("source_id"),
    estimatedAmount: money("estimated_amount"),
    severity: text("severity").notNull().default("medium"),
    status: text("status").notNull().default("open"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: text("resolved_by_user_id"),
    resolution: text("resolution"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [index("revenue_leakage_open_idx").on(t.tenantId, t.facilityId, t.status, t.detectedAt)]
);

export const dayCloseRuns = pgTable(
  "day_close_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    businessDate: text("business_date").notNull(),
    status: text("status").notNull().default("running"),
    cashTotal: money("cash_total").notNull().default("0"),
    cardTotal: money("card_total").notNull().default("0"),
    upiTotal: money("upi_total").notNull().default("0"),
    gatewaySettlementTotal: money("gateway_settlement_total").notNull().default("0"),
    varianceAmount: money("variance_amount").notNull().default("0"),
    closedByUserId: text("closed_by_user_id"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    report: jsonbObj("report"),
    ...timestampColumns
  },
  (t) => [uniqueIndex("day_close_facility_date_uq").on(t.tenantId, t.facilityId, t.businessDate)]
);
```

## config.ts

Config-as-tables (tariffs, terminology, identifiers). Backs the standing rule that geography specifics live in tables, not code (baseline ADR-5).

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { jsonbArray, jsonbObj, lifecycleStatus, timestampColumns } from "./_shared";
import { tenants } from "./iam";

export const configPacks = pgTable(
  "config_packs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    geographyCode: varchar("geography_code", { length: 32 }).notNull(),
    version: varchar("version", { length: 64 }).notNull(),
    status: lifecycleStatus("status").notNull().default("draft"),
    basePackId: uuid("base_pack_id"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    manifest: jsonbObj("manifest").notNull(),
    checksumSha256: text("checksum_sha256"),
    createdByUserId: text("created_by_user_id"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("config_pack_code_version_uq").on(t.code, t.version),
    index("config_pack_geo_idx").on(t.geographyCode, t.status)
  ]
);

export const tenantConfigPackAssignments = pgTable(
  "tenant_config_pack_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    configPackId: uuid("config_pack_id")
      .notNull()
      .references(() => configPacks.id, { onDelete: "restrict" }),
    purpose: text("purpose").notNull().default("primary"),
    activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    ...timestampColumns
  },
  (t) => [uniqueIndex("tenant_config_pack_active_uq").on(t.tenantId, t.configPackId, t.purpose)]
);

export const identifierSystems = pgTable(
  "identifier_systems",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configPackId: uuid("config_pack_id")
      .notNull()
      .references(() => configPacks.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    systemUri: text("system_uri").notNull(),
    displayName: text("display_name").notNull(),
    entityType: text("entity_type").notNull(),
    validationRegex: text("validation_regex"),
    maskingPattern: text("masking_pattern"),
    requiresVerification: boolean("requires_verification").notNull().default(false),
    isSensitive: boolean("is_sensitive").notNull().default(true),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("identifier_system_pack_code_uq").on(t.configPackId, t.code),
    uniqueIndex("identifier_system_uri_uq").on(t.systemUri)
  ]
);

export const terminologyCodeSystems = pgTable(
  "terminology_code_systems",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configPackId: uuid("config_pack_id")
      .notNull()
      .references(() => configPacks.id, { onDelete: "cascade" }),
    systemUri: text("system_uri").notNull(),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    version: varchar("version", { length: 64 }),
    license: text("license"),
    status: lifecycleStatus("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("code_system_uri_version_uq").on(t.systemUri, t.version),
    index("code_system_pack_idx").on(t.configPackId)
  ]
);

export const terminologyConcepts = pgTable(
  "terminology_concepts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    codeSystemId: uuid("code_system_id")
      .notNull()
      .references(() => terminologyCodeSystems.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    display: text("display").notNull(),
    normalizedDisplay: text("normalized_display").notNull(),
    definition: text("definition"),
    synonyms: text("synonyms")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    properties: jsonbObj("properties"),
    status: lifecycleStatus("status").notNull().default("active"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("concept_code_system_code_uq").on(t.codeSystemId, t.code),
    index("concept_display_fts_idx").using(
      "gin",
      sql`to_tsvector('simple', coalesce(${t.normalizedDisplay}, ''))`
    )
  ]
);

export const terminologyMaps = pgTable(
  "terminology_maps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configPackId: uuid("config_pack_id")
      .notNull()
      .references(() => configPacks.id, { onDelete: "cascade" }),
    sourceSystemUri: text("source_system_uri").notNull(),
    sourceCode: text("source_code").notNull(),
    targetSystemUri: text("target_system_uri").notNull(),
    targetCode: text("target_code").notNull(),
    equivalence: text("equivalence").notNull().default("equivalent"),
    confidence: integer("confidence"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("terminology_map_uq").on(
      t.configPackId,
      t.sourceSystemUri,
      t.sourceCode,
      t.targetSystemUri,
      t.targetCode
    )
  ]
);

export const drugCatalogs = pgTable(
  "drug_catalogs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configPackId: uuid("config_pack_id")
      .notNull()
      .references(() => configPacks.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    source: text("source").notNull(),
    version: varchar("version", { length: 64 }).notNull(),
    license: text("license"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [uniqueIndex("drug_catalog_pack_code_version_uq").on(t.configPackId, t.code, t.version)]
);

export const drugProducts = pgTable(
  "drug_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    drugCatalogId: uuid("drug_catalog_id")
      .notNull()
      .references(() => drugCatalogs.id, { onDelete: "cascade" }),
    productCode: varchar("product_code", { length: 128 }).notNull(),
    brandName: text("brand_name"),
    genericName: text("generic_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    ingredientCodes: text("ingredient_codes")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    strength: text("strength"),
    dosageForm: text("dosage_form"),
    route: text("route"),
    manufacturer: text("manufacturer"),
    rxNormCode: text("rxnorm_code"),
    atcCode: text("atc_code"),
    schedule: text("schedule"),
    isControlled: boolean("is_controlled").notNull().default(false),
    status: lifecycleStatus("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("drug_product_catalog_code_uq").on(t.drugCatalogId, t.productCode),
    index("drug_product_name_fts_idx").using(
      "gin",
      sql`to_tsvector('simple', coalesce(${t.normalizedName}, ''))`
    )
  ]
);

export const drugInteractionRules = pgTable(
  "drug_interaction_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    drugCatalogId: uuid("drug_catalog_id")
      .notNull()
      .references(() => drugCatalogs.id, { onDelete: "cascade" }),
    ruleCode: varchar("rule_code", { length: 128 }).notNull(),
    ingredientCodes: text("ingredient_codes").array().notNull(),
    severity: text("severity").notNull(),
    title: text("title").notNull(),
    clinicalEffect: text("clinical_effect"),
    recommendation: text("recommendation"),
    evidenceLevel: text("evidence_level"),
    isBlocking: boolean("is_blocking").notNull().default(false),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("drug_interaction_rule_uq").on(t.drugCatalogId, t.ruleCode),
    index("drug_interaction_ingredients_gin_idx").using("gin", t.ingredientCodes)
  ]
);

export const payerCatalogs = pgTable(
  "payer_catalogs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    configPackId: uuid("config_pack_id").references(() => configPacks.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    payerType: text("payer_type").notNull(),
    nhcxParticipantId: text("nhcx_participant_id"),
    status: lifecycleStatus("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [uniqueIndex("payer_catalog_tenant_code_uq").on(t.tenantId, t.code)]
);

export const taxRules = pgTable(
  "tax_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configPackId: uuid("config_pack_id")
      .notNull()
      .references(() => configPacks.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    jurisdiction: text("jurisdiction").notNull(),
    taxType: text("tax_type").notNull(),
    ratePercent: text("rate_percent").notNull(),
    appliesTo: jsonbObj("applies_to").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [uniqueIndex("tax_rule_pack_code_uq").on(t.configPackId, t.code, t.effectiveFrom)]
);

export const documentTemplates = pgTable(
  "document_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configPackId: uuid("config_pack_id")
      .notNull()
      .references(() => configPacks.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    documentType: text("document_type").notNull(),
    language: varchar("language", { length: 32 }).notNull().default("en-IN"),
    templateEngine: text("template_engine").notNull().default("handlebars"),
    templateBody: text("template_body").notNull(),
    schema: jsonbObj("schema"),
    status: lifecycleStatus("status").notNull().default("active"),
    ...timestampColumns
  },
  (t) => [uniqueIndex("document_template_pack_code_lang_uq").on(t.configPackId, t.code, t.language)]
);

export const languagePacks = pgTable(
  "language_packs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configPackId: uuid("config_pack_id")
      .notNull()
      .references(() => configPacks.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 32 }).notNull(),
    namespace: varchar("namespace", { length: 128 }).notNull(),
    messages: jsonbObj("messages").notNull(),
    status: lifecycleStatus("status").notNull().default("active"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("language_pack_namespace_locale_uq").on(t.configPackId, t.namespace, t.locale)
  ]
);
```

## integrations.ts

External integration registry + message log. Deferred to Phase 7.

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import {
  consentStatus,
  integrationEnvironment,
  integrationKind,
  integrationMessageDirection,
  jobPriority,
  jsonbArray,
  jsonbObj,
  requestTraceColumns,
  syncStatus,
  timestampColumns
} from "./_shared";
import { tenants, facilities } from "./iam";

export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "cascade" }),
    kind: integrationKind("kind").notNull(),
    environment: integrationEnvironment("environment").notNull().default("sandbox"),
    name: text("name").notNull(),
    vendor: text("vendor"),
    status: text("status").notNull().default("configured"),
    baseUrl: text("base_url"),
    credentialRef: text("credential_ref"),
    kmsKeyId: text("kms_key_id"),
    allowedPurposes: text("allowed_purposes")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    healthStatus: text("health_status").notNull().default("unknown"),
    lastHealthCheckAt: timestamp("last_health_check_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("integration_connection_unique_uq").on(
      t.tenantId,
      t.facilityId,
      t.kind,
      t.environment,
      t.name
    ),
    index("integration_connection_kind_idx").on(t.tenantId, t.kind, t.environment)
  ]
);

export const integrationMessages = pgTable(
  "integration_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => integrationConnections.id, { onDelete: "cascade" }),
    direction: integrationMessageDirection("direction").notNull(),
    messageType: text("message_type").notNull(),
    externalMessageId: text("external_message_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    status: syncStatus("status").notNull().default("pending"),
    priority: jobPriority("priority").notNull().default("normal"),
    patientLogicalId: uuid("patient_logical_id"),
    encounterLogicalId: uuid("encounter_logical_id"),
    requestPayload: jsonbObj("request_payload"),
    responsePayload: jsonbObj("response_payload"),
    payloadHash: text("payload_hash"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    ...requestTraceColumns,
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("integration_message_idempotency_uq").on(t.connectionId, t.idempotencyKey),
    index("integration_message_status_idx").on(t.tenantId, t.status, t.nextAttemptAt, t.priority),
    index("integration_message_external_idx").on(t.connectionId, t.externalMessageId)
  ]
);

export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(() => integrationConnections.id, {
      onDelete: "cascade"
    }),
    name: text("name").notNull(),
    targetUrl: text("target_url").notNull(),
    secretRef: text("secret_ref"),
    eventTypes: text("event_types").array().notNull(),
    status: text("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [index("webhook_subscription_tenant_idx").on(t.tenantId, t.status)]
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => webhookSubscriptions.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").notNull(),
    status: syncStatus("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    responseStatus: integer("response_status"),
    responseBodyHash: text("response_body_hash"),
    errorMessage: text("error_message"),
    ...timestampColumns
  },
  (t) => [
    index("webhook_delivery_status_idx").on(t.tenantId, t.status, t.nextAttemptAt),
    uniqueIndex("webhook_delivery_event_sub_uq").on(t.subscriptionId, t.eventId)
  ]
);

export const abdmPatientLinks = pgTable(
  "abdm_patient_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    abhaAddress: text("abha_address"),
    abhaNumberMasked: text("abha_number_masked"),
    hipId: text("hip_id"),
    linkStatus: text("link_status").notNull().default("pending"),
    externalReferenceId: text("external_reference_id"),
    linkedAt: timestamp("linked_at", { withTimezone: true }),
    unlinkedAt: timestamp("unlinked_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("abdm_patient_link_uq").on(t.tenantId, t.patientLogicalId, t.abhaAddress),
    index("abdm_link_status_idx").on(t.tenantId, t.linkStatus)
  ]
);

export const abdmConsentArtifacts = pgTable(
  "abdm_consent_artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    consentRequestId: text("consent_request_id"),
    consentArtifactId: text("consent_artifact_id"),
    status: consentStatus("status").notNull().default("requested"),
    hiTypes: text("hi_types")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    purposeCode: text("purpose_code").notNull(),
    requester: jsonbObj("requester"),
    dateRangeFrom: timestamp("date_range_from", { withTimezone: true }),
    dateRangeTo: timestamp("date_range_to", { withTimezone: true }),
    grantedAt: timestamp("granted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationPropagatedAt: timestamp("revocation_propagated_at", { withTimezone: true }),
    artifactPayload: jsonbObj("artifact_payload"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("abdm_consent_artifact_uq").on(t.tenantId, t.consentArtifactId),
    index("abdm_consent_patient_status_idx").on(t.tenantId, t.patientLogicalId, t.status)
  ]
);

export const abdmHealthInformationLinks = pgTable(
  "abdm_health_information_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    encounterLogicalId: uuid("encounter_logical_id"),
    consentArtifactId: uuid("consent_artifact_id").references(() => abdmConsentArtifacts.id, {
      onDelete: "set null"
    }),
    bundleLogicalId: uuid("bundle_logical_id"),
    hiType: text("hi_type").notNull(),
    shareStatus: syncStatus("share_status").notNull().default("pending"),
    externalTransactionId: text("external_transaction_id"),
    bundleHash: text("bundle_hash"),
    pushedAt: timestamp("pushed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    index("abdm_hi_share_status_idx").on(t.tenantId, t.shareStatus, t.createdAt),
    index("abdm_hi_patient_idx").on(t.tenantId, t.patientLogicalId)
  ]
);

export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    patientLogicalId: uuid("patient_logical_id"),
    phoneE164: text("phone_e164").notNull(),
    templateName: text("template_name").notNull(),
    language: text("language").notNull().default("en_IN"),
    messagePurpose: text("message_purpose").notNull(),
    payload: jsonbObj("payload").notNull(),
    status: syncStatus("status").notNull().default("pending"),
    providerMessageId: text("provider_message_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    documentLinkExpiresAt: timestamp("document_link_expires_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    index("whatsapp_message_status_idx").on(t.tenantId, t.status, t.createdAt),
    index("whatsapp_message_provider_idx").on(t.providerMessageId)
  ]
);

export const hl7v2Messages = pgTable(
  "hl7v2_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => integrationConnections.id, { onDelete: "cascade" }),
    direction: integrationMessageDirection("direction").notNull(),
    messageControlId: text("message_control_id").notNull(),
    messageType: text("message_type").notNull(),
    eventType: text("event_type"),
    rawMessageObjectId: uuid("raw_message_object_id"),
    parsedJson: jsonbObj("parsed_json"),
    patientLogicalId: uuid("patient_logical_id"),
    encounterLogicalId: uuid("encounter_logical_id"),
    status: syncStatus("status").notNull().default("pending"),
    ackCode: text("ack_code"),
    errorMessage: text("error_message"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("hl7_message_control_uq").on(t.connectionId, t.messageControlId),
    index("hl7_message_status_idx").on(t.tenantId, t.status, t.createdAt)
  ]
);
```

## outbox.ts

Transactional outbox. Deferred to the start of Phase 7 (first real async external consumer).

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import {
  dataClassification,
  eventPublishStatus,
  facilityScopeColumns,
  jsonbObj,
  jobPriority,
  requestTraceColumns,
  tenantScopeColumns,
  timestampColumns
} from "./_shared";
import { facilities, tenants } from "./iam";

/**
 * Transactional outbox + inbox tables.
 *
 * These are the durable boundary between synchronous clinical/billing writes and async fan-out
 * to audit, ABDM, WhatsApp, payments, claims, revenue agents and future modules.
 */
export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenantScopeColumns,
    ...facilityScopeColumns,
    aggregateType: varchar("aggregate_type", { length: 128 }).notNull(),
    aggregateId: text("aggregate_id").notNull(),
    aggregateVersion: integer("aggregate_version"),
    eventType: varchar("event_type", { length: 192 }).notNull(),
    eventVersion: integer("event_version").notNull().default(1),
    source: text("source").notNull().default("arogya-os"),
    subject: text("subject"),
    idempotencyKey: text("idempotency_key").notNull(),
    correlationId: text("correlation_id"),
    causationId: text("causation_id"),
    actorUserId: text("actor_user_id"),
    actorType: text("actor_type"),
    dataClassification: dataClassification("data_classification").notNull().default("internal"),
    containsPhi: boolean("contains_phi").notNull().default(false),
    payload: jsonbObj("payload").notNull(),
    headers: jsonbObj("headers"),
    publishStatus: eventPublishStatus("publish_status").notNull().default("pending"),
    priority: jobPriority("priority").notNull().default("normal"),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    retryCount: integer("retry_count").notNull().default(0),
    maxRetries: integer("max_retries").notNull().default(10),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    dlqReason: text("dlq_reason"),
    schemaName: text("schema_name"),
    schemaVersion: integer("schema_version"),
    ...requestTraceColumns,
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("outbox_idempotency_uq").on(t.tenantId, t.idempotencyKey),
    index("outbox_pending_idx").on(t.publishStatus, t.availableAt, t.priority),
    index("outbox_aggregate_idx").on(t.tenantId, t.aggregateType, t.aggregateId),
    index("outbox_event_type_idx").on(t.eventType, t.eventVersion),
    index("outbox_payload_gin_idx").using("gin", sql`${t.payload}`)
  ]
);

export const outboxConsumerOffsets = pgTable(
  "outbox_consumer_offsets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    consumerName: varchar("consumer_name", { length: 128 }).notNull(),
    topicName: varchar("topic_name", { length: 192 }).notNull(),
    partitionKey: text("partition_key").notNull().default("default"),
    lastProcessedEventId: uuid("last_processed_event_id"),
    lastProcessedAt: timestamp("last_processed_at", { withTimezone: true }),
    lagCount: integer("lag_count").notNull().default(0),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [uniqueIndex("outbox_consumer_offsets_uq").on(t.consumerName, t.topicName, t.partitionKey)]
);

export const inboxProcessedMessages = pgTable(
  "inbox_processed_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenantScopeColumns,
    consumerName: varchar("consumer_name", { length: 128 }).notNull(),
    sourceSystem: text("source_system").notNull(),
    messageId: text("message_id").notNull(),
    idempotencyKey: text("idempotency_key"),
    processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
    result: text("result").notNull().default("processed"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("inbox_processed_messages_uq").on(
      t.tenantId,
      t.consumerName,
      t.sourceSystem,
      t.messageId
    ),
    index("inbox_idempotency_idx").on(t.tenantId, t.idempotencyKey)
  ]
);

export const backgroundJobs = pgTable(
  "background_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "cascade" }),
    queueName: varchar("queue_name", { length: 128 }).notNull(),
    jobType: varchar("job_type", { length: 192 }).notNull(),
    status: eventPublishStatus("status").notNull().default("pending"),
    priority: jobPriority("priority").notNull().default("normal"),
    payload: jsonbObj("payload").notNull(),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    lockedBy: text("locked_by"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(10),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    ...requestTraceColumns,
    ...timestampColumns
  },
  (t) => [
    index("background_jobs_pick_idx").on(t.queueName, t.status, t.runAfter, t.priority),
    index("background_jobs_tenant_type_idx").on(t.tenantId, t.jobType, t.status)
  ]
);
```

## offline.ts

Edge/offline sync bookkeeping. Deferred; re-open trigger is >2% consult-hours offline (ADR-0003).

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { edgeDeviceStatus, jsonbObj, syncStatus, timestampColumns } from "./_shared";
import { tenants, facilities } from "./iam";

export const edgeDevices = pgTable(
  "edge_devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    deviceCode: varchar("device_code", { length: 128 }).notNull(),
    deviceName: text("device_name").notNull(),
    status: edgeDeviceStatus("status").notNull().default("provisioned"),
    publicKey: text("public_key").notNull(),
    certificateFingerprint: text("certificate_fingerprint"),
    currentSoftwareVersion: text("current_software_version"),
    desiredSoftwareVersion: text("desired_software_version"),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    lastIpAddress: text("last_ip_address"),
    diskEncryptionEnabled: boolean("disk_encryption_enabled").notNull().default(false),
    remoteWipeRequestedAt: timestamp("remote_wipe_requested_at", { withTimezone: true }),
    remoteWipeConfirmedAt: timestamp("remote_wipe_confirmed_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("edge_device_code_uq").on(t.tenantId, t.facilityId, t.deviceCode),
    index("edge_device_status_idx").on(t.tenantId, t.status, t.lastHeartbeatAt)
  ]
);

export const edgeSyncCursors = pgTable(
  "edge_sync_cursors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    edgeDeviceId: uuid("edge_device_id")
      .notNull()
      .references(() => edgeDevices.id, { onDelete: "cascade" }),
    streamName: text("stream_name").notNull(),
    lastCloudSequence: text("last_cloud_sequence"),
    lastEdgeSequence: text("last_edge_sequence"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    conflictCount: integer("conflict_count").notNull().default(0),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [uniqueIndex("edge_sync_cursor_uq").on(t.edgeDeviceId, t.streamName)]
);

export const edgeCommandQueue = pgTable(
  "edge_command_queue",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    edgeDeviceId: uuid("edge_device_id")
      .notNull()
      .references(() => edgeDevices.id, { onDelete: "cascade" }),
    commandType: text("command_type").notNull(),
    payload: jsonbObj("payload").notNull(),
    status: syncStatus("status").notNull().default("pending"),
    issuedByUserId: text("issued_by_user_id"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    ...timestampColumns
  },
  (t) => [index("edge_command_status_idx").on(t.edgeDeviceId, t.status, t.issuedAt)]
);

export const offlineQueues = pgTable(
  "offline_queues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    edgeDeviceId: uuid("edge_device_id")
      .notNull()
      .references(() => edgeDevices.id, { onDelete: "cascade" }),
    queueName: text("queue_name").notNull(),
    localSequence: text("local_sequence").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    operationType: text("operation_type").notNull(), // quick_register | bill_draft | payment_capture
    payload: jsonbObj("payload").notNull(),
    payloadHash: text("payload_hash").notNull(),
    status: syncStatus("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    cloudResourceType: text("cloud_resource_type"),
    cloudResourceId: uuid("cloud_resource_id"),
    conflictDetectedAt: timestamp("conflict_detected_at", { withTimezone: true }),
    conflictResolution: text("conflict_resolution"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("offline_queue_idempotency_uq").on(t.edgeDeviceId, t.idempotencyKey),
    uniqueIndex("offline_queue_sequence_uq").on(t.edgeDeviceId, t.queueName, t.localSequence),
    index("offline_queue_status_idx").on(t.tenantId, t.status, t.nextAttemptAt)
  ]
);

export const billNumberReservations = pgTable(
  "bill_number_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    edgeDeviceId: uuid("edge_device_id").references(() => edgeDevices.id, { onDelete: "set null" }),
    seriesCode: text("series_code").notNull(),
    startNumber: integer("start_number").notNull(),
    endNumber: integer("end_number").notNull(),
    nextNumber: integer("next_number").notNull(),
    reservedAt: timestamp("reserved_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    exhaustedAt: timestamp("exhausted_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("bill_number_reservation_uq").on(
      t.tenantId,
      t.facilityId,
      t.seriesCode,
      t.startNumber,
      t.endNumber
    )
  ]
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    scope: text("scope").notNull(),
    requestHash: text("request_hash").notNull(),
    responseHash: text("response_hash"),
    responseStatus: integer("response_status"),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("idempotency_key_scope_uq").on(t.tenantId, t.scope, t.key),
    index("idempotency_expiry_idx").on(t.expiresAt)
  ]
);
```

## migration.ts

Legacy-import staging tables. Deferred — pilot is fresh registrations, no migration on the critical path.

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import {
  dataClassification,
  jsonbObj,
  migrationRunStatus,
  requestTraceColumns,
  syncStatus,
  tenantScopeColumns,
  timestampColumns
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
    ...timestampColumns
  },
  (t) => [index("migration_sources_tenant_idx").on(t.tenantId, t.sourceType)]
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
    validationRules: jsonb("validation_rules")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: varchar("status", { length: 48 }).notNull().default("draft"),
    approvedByUserId: text("approved_by_user_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("migration_mapping_version_uq").on(
      t.tenantId,
      t.sourceId,
      t.entityType,
      t.mappingVersion
    )
  ]
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
    ...timestampColumns
  },
  (t) => [
    index("migration_runs_tenant_status_idx").on(t.tenantId, t.status, t.runType),
    index("migration_runs_source_idx").on(t.sourceId, t.createdAt)
  ]
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
    warnings: jsonb("warnings")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    errors: jsonb("errors")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    duplicateCandidateIds: jsonb("duplicate_candidate_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    importedAt: timestamp("imported_at", { withTimezone: true }),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("migration_run_row_number_uq").on(t.runId, t.rowNumber),
    index("migration_rows_status_idx").on(t.tenantId, t.runId, t.status),
    index("migration_rows_target_idx").on(t.tenantId, t.targetResourceType, t.targetResourceId),
    index("migration_rows_payload_gin_idx").using("gin", sql`${t.normalizedPayload}`)
  ]
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
    items: jsonb("items")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    ownerUserId: text("owner_user_id"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [index("onboarding_tenant_status_idx").on(t.tenantId, t.status, t.checklistType)]
);
```

## fhir.ts

FHIR resource/mapping tables. Deferred to Phase 7 (ABDM export seam, ADR-0002).

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import {
  auditActorColumns,
  consentStatus,
  dataClassification,
  encryptionColumns,
  fhirResourceStatus,
  jsonbArray,
  jsonbObj,
  lifecycleStatus,
  requestTraceColumns,
  softDeleteColumns,
  timestampColumns
} from "./_shared";
import { tenants, facilities, practitioners } from "./iam";

export const fhirResourceVersions = pgTable(
  "fhir_resource_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    resourceType: varchar("resource_type", { length: 64 }).notNull(),
    logicalId: uuid("logical_id").notNull(),
    version: integer("version").notNull(),
    status: fhirResourceStatus("status").notNull().default("preliminary"),
    resource: jsonb("resource").$type<Record<string, unknown>>().notNull(),
    resourceHash: text("resource_hash").notNull(),
    profileUrls: text("profile_urls")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    securityLabels: text("security_labels")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).notNull().defaultNow(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }),
    supersedesVersionId: uuid("supersedes_version_id"),
    enteredInErrorAt: timestamp("entered_in_error_at", { withTimezone: true }),
    enteredInErrorReason: text("entered_in_error_reason"),
    dataClassification: dataClassification("data_classification").notNull().default("phi"),
    validationResult: jsonbObj("validation_result"),
    ...encryptionColumns,
    ...requestTraceColumns,
    ...auditActorColumns,
    ...softDeleteColumns,
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("fhir_version_unique_uq").on(t.tenantId, t.resourceType, t.logicalId, t.version),
    index("fhir_logical_current_idx").on(t.tenantId, t.resourceType, t.logicalId, t.version),
    index("fhir_resource_gin_idx").using("gin", t.resource),
    index("fhir_patient_search_idx").using("gin", sql`(${t.resource} -> 'subject')`),
    index("fhir_profiles_gin_idx").using("gin", t.profileUrls),
    index("fhir_security_labels_gin_idx").using("gin", t.securityLabels)
  ]
);

export const fhirResourceCurrent = pgTable(
  "fhir_resource_current",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    resourceType: varchar("resource_type", { length: 64 }).notNull(),
    logicalId: uuid("logical_id").notNull(),
    currentVersionId: uuid("current_version_id")
      .notNull()
      .references(() => fhirResourceVersions.id, { onDelete: "restrict" }),
    currentVersion: integer("current_version").notNull(),
    status: fhirResourceStatus("status").notNull(),
    patientLogicalId: uuid("patient_logical_id"),
    encounterLogicalId: uuid("encounter_logical_id"),
    practitionerLogicalId: uuid("practitioner_logical_id"),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).notNull(),
    searchText: text("search_text"),
    identifiers: jsonbArray<Record<string, unknown>>("identifiers"),
    references: jsonbArray<Record<string, unknown>>("references"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("fhir_current_unique_uq").on(t.tenantId, t.resourceType, t.logicalId),
    uniqueIndex("fhir_current_version_uq").on(t.currentVersionId),
    index("fhir_current_patient_idx").on(
      t.tenantId,
      t.patientLogicalId,
      t.resourceType,
      t.lastUpdatedAt
    ),
    index("fhir_current_search_idx").using(
      "gin",
      sql`to_tsvector('simple', coalesce(${t.searchText}, ''))`
    )
  ]
);

export const patientProjections = pgTable(
  "patient_projections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    fhirCurrentId: uuid("fhir_current_id")
      .notNull()
      .references(() => fhirResourceCurrent.id, { onDelete: "cascade" }),
    mrn: text("mrn"),
    abhaAddress: text("abha_address"),
    abhaNumberMasked: text("abha_number_masked"),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    gender: varchar("gender", { length: 32 }),
    birthDate: date("birth_date", { mode: "string" }),
    ageYearsApprox: integer("age_years_approx"),
    phoneE164: text("phone_e164"),
    email: text("email"),
    primaryLanguage: varchar("primary_language", { length: 32 }).default("hi-IN"),
    addressText: text("address_text"),
    emergencyContact: jsonbObj("emergency_contact"),
    deceased: boolean("deceased").notNull().default(false),
    isAnonymous: boolean("is_anonymous").notNull().default(false),
    isMerged: boolean("is_merged").notNull().default(false),
    mergedIntoPatientLogicalId: uuid("merged_into_patient_logical_id"),
    vipFlag: boolean("vip_flag").notNull().default(false),
    sensitivityLabels: text("sensitivity_labels")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    searchVectorText: text("search_vector_text"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("patient_projection_tenant_logical_uq").on(t.tenantId, t.patientLogicalId),
    index("patient_phone_idx").on(t.tenantId, t.phoneE164),
    index("patient_mrn_idx").on(t.tenantId, t.mrn),
    index("patient_abha_idx").on(t.tenantId, t.abhaAddress),
    index("patient_name_fts_idx").using(
      "gin",
      sql`to_tsvector('simple', coalesce(${t.searchVectorText}, ''))`
    )
  ]
);

export const patientIdentifiers = pgTable(
  "patient_identifiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    system: text("system").notNull(),
    valueHash: text("value_hash").notNull(),
    valueMasked: text("value_masked"),
    use: text("use"),
    confidence: integer("confidence"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    source: text("source"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("patient_identifier_unique_uq").on(t.tenantId, t.system, t.valueHash),
    index("patient_identifier_patient_idx").on(t.tenantId, t.patientLogicalId)
  ]
);

export const patientMergeCandidates = pgTable(
  "patient_merge_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sourcePatientLogicalId: uuid("source_patient_logical_id").notNull(),
    targetPatientLogicalId: uuid("target_patient_logical_id").notNull(),
    score: integer("score").notNull(),
    matchSignals: jsonbObj("match_signals").notNull(),
    status: lifecycleStatus("status").notNull().default("draft"),
    reviewedByUserId: text("reviewed_by_user_id"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewDecision: text("review_decision"),
    reviewReason: text("review_reason"),
    ...timestampColumns
  },
  (t) => [index("merge_candidate_status_idx").on(t.tenantId, t.status, t.score)]
);

export const patientMerges = pgTable(
  "patient_merges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    survivorPatientLogicalId: uuid("survivor_patient_logical_id").notNull(),
    duplicatePatientLogicalId: uuid("duplicate_patient_logical_id").notNull(),
    survivorshipRules: jsonbObj("survivorship_rules").notNull(),
    mergedByUserId: text("merged_by_user_id").notNull(),
    mergedAt: timestamp("merged_at", { withTimezone: true }).notNull().defaultNow(),
    unmergedAt: timestamp("unmerged_at", { withTimezone: true }),
    unmergedByUserId: text("unmerged_by_user_id"),
    unmergeReason: text("unmerge_reason"),
    auditEventId: uuid("audit_event_id"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("patient_merge_pair_uq").on(
      t.tenantId,
      t.survivorPatientLogicalId,
      t.duplicatePatientLogicalId
    )
  ]
);

export const encounterProjections = pgTable(
  "encounter_projections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    encounterLogicalId: uuid("encounter_logical_id").notNull(),
    fhirCurrentId: uuid("fhir_current_id")
      .notNull()
      .references(() => fhirResourceCurrent.id, { onDelete: "cascade" }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    practitionerId: uuid("practitioner_id").references(() => practitioners.id, {
      onDelete: "set null"
    }),
    departmentId: uuid("department_id"),
    encounterClass: text("encounter_class").notNull().default("opd"),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    chiefComplaint: text("chief_complaint"),
    diagnosisSummary: text("diagnosis_summary"),
    visitType: text("visit_type"),
    payerType: text("payer_type").notNull().default("self_pay"),
    billingStatus: text("billing_status"),
    documentationStatus: text("documentation_status"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("encounter_projection_tenant_logical_uq").on(t.tenantId, t.encounterLogicalId),
    index("encounter_patient_date_idx").on(t.tenantId, t.patientLogicalId, t.startedAt),
    index("encounter_doctor_status_idx").on(t.tenantId, t.practitionerId, t.status, t.startedAt)
  ]
);

export const documentReferences = pgTable(
  "document_references",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    fhirDocumentReferenceId: uuid("fhir_document_reference_id"),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    encounterLogicalId: uuid("encounter_logical_id"),
    documentType: text("document_type").notNull(),
    title: text("title").notNull(),
    objectId: uuid("object_id").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes"),
    sha256: text("sha256").notNull(),
    status: lifecycleStatus("status").notNull().default("active"),
    source: text("source").notNull().default("upload"),
    ocrStatus: text("ocr_status"),
    verifiedByUserId: text("verified_by_user_id"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    ...encryptionColumns,
    ...auditActorColumns,
    ...softDeleteColumns,
    ...timestampColumns
  },
  (t) => [
    index("document_patient_idx").on(t.tenantId, t.patientLogicalId, t.documentType, t.createdAt),
    index("document_object_idx").on(t.objectId)
  ]
);

export const objectBlobs = pgTable(
  "object_blobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("s3"),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    region: text("region").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes"),
    sha256: text("sha256"),
    malwareScanStatus: text("malware_scan_status").notNull().default("pending"),
    malwareScanAt: timestamp("malware_scan_at", { withTimezone: true }),
    retentionPolicy: text("retention_policy"),
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    legalHold: boolean("legal_hold").notNull().default(false),
    ...encryptionColumns,
    ...softDeleteColumns,
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("object_blob_key_uq").on(t.provider, t.bucket, t.objectKey),
    index("object_blob_tenant_idx").on(t.tenantId)
  ]
);

export const patientConsents = pgTable(
  "patient_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    consentFhirLogicalId: uuid("consent_fhir_logical_id"),
    consentKind: text("consent_kind").notNull(), // audio_capture | abdm_share | whatsapp_delivery | treatment | claims
    status: consentStatus("status").notNull().default("draft"),
    purpose: text("purpose").notNull(),
    scope: jsonbObj("scope").notNull(),
    grantedBy: text("granted_by"),
    grantedAt: timestamp("granted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: text("revocation_reason"),
    source: text("source").notNull().default("front_desk"),
    externalConsentId: text("external_consent_id"),
    version: integer("version").notNull().default(1),
    evidence: jsonbObj("evidence"),
    ...timestampColumns
  },
  (t) => [
    index("patient_consent_active_idx").on(t.tenantId, t.patientLogicalId, t.consentKind, t.status),
    index("patient_consent_external_idx").on(t.externalConsentId)
  ]
);
```

## ai.ts

Scribe sessions, drafts, provenance, review outcomes. Deferred to Phase 6 — but note how provenance hangs off the existing Preliminary→Signed states.

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import {
  aiArtifactStatus,
  aiReviewOutcome,
  auditActorColumns,
  encryptionColumns,
  jobPriority,
  jsonbArray,
  jsonbObj,
  safetySeverity,
  softDeleteColumns,
  syncStatus,
  timestampColumns
} from "./_shared";
import { tenants, facilities, practitioners } from "./iam";
import { objectBlobs, patientConsents } from "./fhir";

export const aiModelProviders = pgTable(
  "ai_model_providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    providerType: text("provider_type").notNull(), // stt | llm | ocr | embedding
    dataResidencyRegion: text("data_residency_region"),
    phiProcessingAllowed: boolean("phi_processing_allowed").notNull().default(false),
    noTrainingContract: boolean("no_training_contract").notNull().default(false),
    baaOrDpaReference: text("baa_or_dpa_reference"),
    status: text("status").notNull().default("candidate"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [uniqueIndex("ai_provider_code_uq").on(t.code)]
);

export const aiModels = pgTable(
  "ai_models",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => aiModelProviders.id, { onDelete: "cascade" }),
    modelCode: text("model_code").notNull(),
    modelVersion: text("model_version").notNull(),
    taskType: text("task_type").notNull(),
    languageSupport: text("language_support")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    status: text("status").notNull().default("candidate"),
    costPerUnit: numeric("cost_per_unit", { precision: 12, scale: 6 }),
    unit: text("unit"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [uniqueIndex("ai_model_version_uq").on(t.providerId, t.modelCode, t.modelVersion)]
);

export const scribeSessions = pgTable(
  "scribe_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id").references(() => facilities.id, { onDelete: "set null" }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    encounterLogicalId: uuid("encounter_logical_id").notNull(),
    practitionerId: uuid("practitioner_id").references(() => practitioners.id, {
      onDelete: "set null"
    }),
    consentId: uuid("consent_id").references(() => patientConsents.id, { onDelete: "restrict" }),
    status: aiArtifactStatus("status").notNull().default("captured"),
    languageHint: text("language_hint").notNull().default("hi-IN,en-IN"),
    audioObjectId: uuid("audio_object_id").references(() => objectBlobs.id, {
      onDelete: "set null"
    }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    deletionScheduledAt: timestamp("deletion_scheduled_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletionProofHash: text("deletion_proof_hash"),
    failureReason: text("failure_reason"),
    metadata: jsonbObj("metadata"),
    ...encryptionColumns,
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("scribe_session_encounter_uq").on(t.tenantId, t.encounterLogicalId),
    index("scribe_session_status_idx").on(t.tenantId, t.status, t.startedAt)
  ]
);

export const scribeAudioChunks = pgTable(
  "scribe_audio_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    scribeSessionId: uuid("scribe_session_id")
      .notNull()
      .references(() => scribeSessions.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    objectId: uuid("object_id").references(() => objectBlobs.id, { onDelete: "set null" }),
    durationMs: integer("duration_ms"),
    sha256: text("sha256"),
    status: syncStatus("status").notNull().default("pending"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestampColumns
  },
  (t) => [uniqueIndex("scribe_chunk_sequence_uq").on(t.scribeSessionId, t.sequence)]
);

export const transcripts = pgTable(
  "transcripts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    scribeSessionId: uuid("scribe_session_id")
      .notNull()
      .references(() => scribeSessions.id, { onDelete: "cascade" }),
    modelId: uuid("model_id").references(() => aiModels.id, { onDelete: "set null" }),
    status: aiArtifactStatus("status").notNull().default("processing"),
    transcriptText: text("transcript_text"),
    diarizedSegments: jsonbArray<Record<string, unknown>>("diarized_segments"),
    clinicalEntities: jsonbArray<Record<string, unknown>>("clinical_entities"),
    languageDetected: text("language_detected"),
    wordErrorRate: numeric("word_error_rate", { precision: 6, scale: 4 }),
    entityWer: numeric("entity_wer", { precision: 6, scale: 4 }),
    latencyMs: integer("latency_ms"),
    costInInr: numeric("cost_in_inr", { precision: 12, scale: 4 }),
    failureReason: text("failure_reason"),
    metadata: jsonbObj("metadata"),
    ...encryptionColumns,
    ...timestampColumns
  },
  (t) => [
    index("transcript_session_idx").on(t.scribeSessionId, t.status),
    index("transcript_text_fts_idx").using(
      "gin",
      sql`to_tsvector('simple', coalesce(${t.transcriptText}, ''))`
    )
  ]
);

export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    scribeSessionId: uuid("scribe_session_id").references(() => scribeSessions.id, {
      onDelete: "set null"
    }),
    transcriptId: uuid("transcript_id").references(() => transcripts.id, { onDelete: "set null" }),
    modelId: uuid("model_id").references(() => aiModels.id, { onDelete: "set null" }),
    artifactType: text("artifact_type").notNull(), // soap_note | prescription | orders | claim_prescrub | ocr_extract
    status: aiArtifactStatus("status").notNull().default("draft"),
    promptVersion: text("prompt_version").notNull(),
    inputHash: text("input_hash").notNull(),
    outputJson: jsonbObj("output_json"),
    outputText: text("output_text"),
    confidence: integer("confidence"),
    sourceSpans: jsonbArray<Record<string, unknown>>("source_spans"),
    validationErrors: jsonbArray<Record<string, unknown>>("validation_errors"),
    latencyMs: integer("latency_ms"),
    costInInr: numeric("cost_in_inr", { precision: 12, scale: 4 }),
    failureReason: text("failure_reason"),
    metadata: jsonbObj("metadata"),
    ...encryptionColumns,
    ...timestampColumns
  },
  (t) => [
    index("ai_generation_session_idx").on(t.tenantId, t.scribeSessionId, t.artifactType),
    index("ai_generation_status_idx").on(t.tenantId, t.status)
  ]
);

export const aiArtifactReviews = pgTable(
  "ai_artifact_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    aiGenerationId: uuid("ai_generation_id")
      .notNull()
      .references(() => aiGenerations.id, { onDelete: "cascade" }),
    reviewerUserId: text("reviewer_user_id").notNull(),
    reviewerPractitionerId: uuid("reviewer_practitioner_id"),
    outcome: aiReviewOutcome("outcome").notNull().default("not_reviewed"),
    fieldEditCount: integer("field_edit_count").notNull().default(0),
    criticalFieldEditCount: integer("critical_field_edit_count").notNull().default(0),
    beforeHash: text("before_hash"),
    afterHash: text("after_hash"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    index("ai_review_generation_idx").on(t.aiGenerationId),
    index("ai_review_outcome_idx").on(t.tenantId, t.outcome, t.reviewedAt)
  ]
);

export const aiSignoffGuards = pgTable(
  "ai_signoff_guards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    logicalId: uuid("logical_id").notNull(),
    aiGenerationId: uuid("ai_generation_id").references(() => aiGenerations.id, {
      onDelete: "set null"
    }),
    preliminaryVersionId: uuid("preliminary_version_id").notNull(),
    finalVersionId: uuid("final_version_id"),
    status: text("status").notNull().default("preliminary"),
    requiredReviewFields: jsonbArray<Record<string, unknown>>("required_review_fields"),
    signedByUserId: text("signed_by_user_id"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    blockedReason: text("blocked_reason"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("ai_signoff_resource_uq").on(
      t.tenantId,
      t.resourceType,
      t.logicalId,
      t.preliminaryVersionId
    )
  ]
);

export const ocrJobs = pgTable(
  "ocr_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    patientLogicalId: uuid("patient_logical_id"),
    encounterLogicalId: uuid("encounter_logical_id"),
    documentReferenceId: uuid("document_reference_id").notNull(),
    modelId: uuid("model_id").references(() => aiModels.id, { onDelete: "set null" }),
    status: syncStatus("status").notNull().default("pending"),
    priority: jobPriority("priority").notNull().default("normal"),
    documentType: text("document_type").notNull(),
    extractedJson: jsonbObj("extracted_json"),
    extractedText: text("extracted_text"),
    confidence: integer("confidence"),
    validationErrors: jsonbArray<Record<string, unknown>>("validation_errors"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    verifiedByUserId: text("verified_by_user_id"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    ...timestampColumns
  },
  (t) => [
    index("ocr_job_status_idx").on(t.tenantId, t.status, t.priority, t.createdAt),
    index("ocr_job_patient_idx").on(t.tenantId, t.patientLogicalId)
  ]
);

export const aiEvaluationDatasets = pgTable(
  "ai_evaluation_datasets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 128 }).notNull(),
    name: text("name").notNull(),
    datasetVersion: text("dataset_version").notNull(),
    dataPolicy: text("data_policy").notNull(), // synthetic | deidentified | consented_phi
    languageMix: jsonbObj("language_mix"),
    specialtyMix: jsonbObj("specialty_mix"),
    sampleCount: integer("sample_count"),
    audioHours: numeric("audio_hours", { precision: 8, scale: 2 }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("ai_eval_dataset_version_uq").on(t.tenantId, t.code, t.datasetVersion),
    index("ai_eval_dataset_tenant_idx").on(t.tenantId)
  ]
);

export const aiEvaluationRuns = pgTable(
  "ai_evaluation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => aiEvaluationDatasets.id, { onDelete: "cascade" }),
    modelId: uuid("model_id")
      .notNull()
      .references(() => aiModels.id, { onDelete: "cascade" }),
    runCode: text("run_code").notNull(),
    status: syncStatus("status").notNull().default("pending"),
    metrics: jsonbObj("metrics"),
    costInInr: numeric("cost_in_inr", { precision: 12, scale: 4 }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    decision: text("decision"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("ai_eval_run_code_uq").on(t.tenantId, t.runCode),
    index("ai_eval_run_model_idx").on(t.tenantId, t.modelId, t.status)
  ]
);
```

## analytics.ts

Owner-analytics rollups. Deferred (vision phase).

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import {
  dataClassification,
  jsonbObj,
  purposeOfUse,
  tenantScopeColumns,
  timestampColumns
} from "./_shared";
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
    ...timestampColumns
  },
  (t) => [
    index("analytics_events_tenant_name_idx").on(t.tenantId, t.eventName, t.occurredAt),
    index("analytics_payload_gin_idx").using("gin", sql`${t.payload}`)
  ]
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
    dimensions: jsonb("dimensions")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    metadata: jsonbObj("metadata"),
    ...timestampColumns
  },
  (t) => [uniqueIndex("metric_definitions_code_uq").on(t.code)]
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
    ...timestampColumns
  },
  (t) => [
    uniqueIndex("metric_snapshot_uq").on(
      t.tenantId,
      t.facilityId,
      t.metricCode,
      t.bucketStart,
      t.bucketEnd
    )
  ]
);
```
