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
  varchar,
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
  timestampColumns,
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
    deploymentModel: tenantDeploymentModel("deployment_model").notNull().default("dedicated_tenant"),
    authOrganizationId: text("auth_organization_id"),
    countryCode: varchar("country_code", { length: 2 }).notNull().default("IN"),
    defaultLocale: varchar("default_locale", { length: 32 }).notNull().default("en-IN"),
    defaultTimezone: varchar("default_timezone", { length: 64 }).notNull().default("Asia/Kolkata"),
    dataResidencyRegion: varchar("data_residency_region", { length: 64 }).notNull().default("in-west"),
    configPackId: uuid("config_pack_id"),
    kmsKeyId: text("kms_key_id"),
    kmsKeyVersion: integer("kms_key_version").notNull().default(1),
    phiEnabledAt: timestamp("phi_enabled_at", { withTimezone: true }),
    goLiveAt: timestamp("go_live_at", { withTimezone: true }),
    offboardedAt: timestamp("offboarded_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("tenants_slug_uq").on(t.slug),
    uniqueIndex("tenants_auth_org_uq").on(t.authOrganizationId),
    index("tenants_lifecycle_idx").on(t.lifecycleStatus),
  ],
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
    ...timestampColumns,
  },
  (t) => [uniqueIndex("tenant_key_version_uq").on(t.tenantId, t.keyVersion), index("tenant_key_active_idx").on(t.tenantId, t.status)],
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
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("facilities_tenant_code_uq").on(t.tenantId, t.code),
    uniqueIndex("facilities_abdm_id_uq").on(t.abdmFacilityId),
    index("facilities_tenant_idx").on(t.tenantId),
  ],
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
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("departments_tenant_facility_code_uq").on(t.tenantId, t.facilityId, t.code),
    index("departments_tenant_idx").on(t.tenantId),
  ],
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
    defaultDepartmentId: uuid("default_department_id").references(() => departments.id, { onDelete: "set null" }),
    status: lifecycleStatus("status").notNull().default("active"),
    signatureObjectId: uuid("signature_object_id"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("practitioner_user_tenant_uq").on(t.tenantId, t.userId),
    uniqueIndex("practitioner_registration_uq").on(t.tenantId, t.registrationCouncil, t.registrationNumber),
    index("practitioner_tenant_idx").on(t.tenantId),
  ],
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
    ...timestampColumns,
  },
  (t) => [index("practitioner_roles_lookup_idx").on(t.tenantId, t.facilityId, t.departmentId, t.roleCode)],
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
    homeFacilityId: uuid("home_facility_id").references(() => facilities.id, { onDelete: "set null" }),
    practitionerId: uuid("practitioner_id").references(() => practitioners.id, { onDelete: "set null" }),
    status: lifecycleStatus("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("user_tenant_profiles_uq").on(t.tenantId, t.userId), index("user_profiles_tenant_idx").on(t.tenantId)],
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
    ...timestampColumns,
  },
  (t) => [uniqueIndex("permission_catalog_code_uq").on(t.code), index("permission_catalog_resource_idx").on(t.resource, t.action)],
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
    ...timestampColumns,
  },
  (t) => [uniqueIndex("role_definitions_tenant_code_uq").on(t.tenantId, t.code)],
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
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
    ...timestampColumns,
  },
  (t) => [
    index("user_role_assignments_user_idx").on(t.tenantId, t.userId),
    index("user_role_assignments_role_idx").on(t.roleId),
  ],
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
    ...timestampColumns,
  },
  (t) => [uniqueIndex("access_policy_rules_code_uq").on(t.tenantId, t.code), index("access_policy_rules_lookup_idx").on(t.tenantId, t.resourceType, t.action)],
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
    approvedByUserId: text("approved_by_user_id").references(() => user.id, { onDelete: "set null" }),
    auditEventId: uuid("audit_event_id"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [index("break_glass_active_idx").on(t.tenantId, t.userId, t.patientId, t.expiresAt)],
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
    ...timestampColumns,
  },
  (t) => [index("support_access_tenant_status_idx").on(t.tenantId, t.status, t.expiresAt)],
);
