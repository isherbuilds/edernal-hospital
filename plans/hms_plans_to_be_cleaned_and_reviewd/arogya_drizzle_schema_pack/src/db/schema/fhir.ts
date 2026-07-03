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
  varchar,
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
  timestampColumns,
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
    profileUrls: text("profile_urls").array().notNull().default(sql`ARRAY[]::text[]`),
    securityLabels: text("security_labels").array().notNull().default(sql`ARRAY[]::text[]`),
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
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
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("fhir_version_unique_uq").on(t.tenantId, t.resourceType, t.logicalId, t.version),
    index("fhir_logical_current_idx").on(t.tenantId, t.resourceType, t.logicalId, t.version),
    index("fhir_resource_gin_idx").using("gin", t.resource),
    index("fhir_patient_search_idx").using("gin", sql`(${t.resource} -> 'subject')`),
    index("fhir_profiles_gin_idx").using("gin", t.profileUrls),
    index("fhir_security_labels_gin_idx").using("gin", t.securityLabels),
  ],
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
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("fhir_current_unique_uq").on(t.tenantId, t.resourceType, t.logicalId),
    uniqueIndex("fhir_current_version_uq").on(t.currentVersionId),
    index("fhir_current_patient_idx").on(t.tenantId, t.patientLogicalId, t.resourceType, t.lastUpdatedAt),
    index("fhir_current_search_idx").using("gin", sql`to_tsvector('simple', coalesce(${t.searchText}, ''))`),
  ],
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
    fhirCurrentId: uuid("fhir_current_id").notNull().references(() => fhirResourceCurrent.id, { onDelete: "cascade" }),
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
    sensitivityLabels: text("sensitivity_labels").array().notNull().default(sql`ARRAY[]::text[]`),
    searchVectorText: text("search_vector_text"),
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("patient_projection_tenant_logical_uq").on(t.tenantId, t.patientLogicalId),
    index("patient_phone_idx").on(t.tenantId, t.phoneE164),
    index("patient_mrn_idx").on(t.tenantId, t.mrn),
    index("patient_abha_idx").on(t.tenantId, t.abhaAddress),
    index("patient_name_fts_idx").using("gin", sql`to_tsvector('simple', coalesce(${t.searchVectorText}, ''))`),
  ],
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
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("patient_identifier_unique_uq").on(t.tenantId, t.system, t.valueHash),
    index("patient_identifier_patient_idx").on(t.tenantId, t.patientLogicalId),
  ],
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
    ...timestampColumns,
  },
  (t) => [index("merge_candidate_status_idx").on(t.tenantId, t.status, t.score)],
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
    ...timestampColumns,
  },
  (t) => [uniqueIndex("patient_merge_pair_uq").on(t.tenantId, t.survivorPatientLogicalId, t.duplicatePatientLogicalId)],
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
    fhirCurrentId: uuid("fhir_current_id").notNull().references(() => fhirResourceCurrent.id, { onDelete: "cascade" }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    practitionerId: uuid("practitioner_id").references(() => practitioners.id, { onDelete: "set null" }),
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
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("encounter_projection_tenant_logical_uq").on(t.tenantId, t.encounterLogicalId),
    index("encounter_patient_date_idx").on(t.tenantId, t.patientLogicalId, t.startedAt),
    index("encounter_doctor_status_idx").on(t.tenantId, t.practitionerId, t.status, t.startedAt),
  ],
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
    ...timestampColumns,
  },
  (t) => [index("document_patient_idx").on(t.tenantId, t.patientLogicalId, t.documentType, t.createdAt), index("document_object_idx").on(t.objectId)],
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
    ...timestampColumns,
  },
  (t) => [uniqueIndex("object_blob_key_uq").on(t.provider, t.bucket, t.objectKey), index("object_blob_tenant_idx").on(t.tenantId)],
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
    ...timestampColumns,
  },
  (t) => [
    index("patient_consent_active_idx").on(t.tenantId, t.patientLogicalId, t.consentKind, t.status),
    index("patient_consent_external_idx").on(t.externalConsentId),
  ],
);
