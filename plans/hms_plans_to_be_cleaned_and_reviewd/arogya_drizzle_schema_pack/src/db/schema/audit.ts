import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
  timestampColumns,
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
    ...requestTraceColumns,
  },
  (t) => [
    index("audit_patient_timeline_idx").on(t.tenantId, t.patientLogicalId, t.occurredAt),
    index("audit_actor_timeline_idx").on(t.tenantId, t.actorUserId, t.occurredAt),
    index("audit_resource_idx").on(t.tenantId, t.resourceType, t.resourceLogicalId, t.occurredAt),
    index("audit_decision_idx").on(t.tenantId, t.decision, t.occurredAt),
    index("audit_trace_idx").on(t.traceId),
  ],
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
    ...timestampColumns,
  },
  (t) => [index("audit_batch_tenant_time_idx").on(t.tenantId, t.sequenceStartAt, t.sequenceEndAt)],
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
    ...timestampColumns,
  },
  (t) => [index("provenance_target_idx").on(t.tenantId, t.targetResourceType, t.targetLogicalId, t.targetVersionId), index("provenance_patient_idx").on(t.tenantId, t.patientLogicalId, t.occurredAt)],
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
    regulatoryNotificationRequired: boolean("regulatory_notification_required").notNull().default(false),
    customerNotificationRequired: boolean("customer_notification_required").notNull().default(false),
    ownerUserId: text("owner_user_id"),
    rootCause: text("root_cause"),
    correctiveActions: jsonbArray<Record<string, unknown>>("corrective_actions"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [index("security_incident_status_idx").on(t.status, t.severity, t.detectedAt), index("security_incident_tenant_idx").on(t.tenantId)],
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
    ...timestampColumns,
  },
  (t) => [index("tenant_export_status_idx").on(t.tenantId, t.status, t.createdAt)],
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
    ...timestampColumns,
  },
  (t) => [uniqueIndex("log_redaction_code_uq").on(t.code)],
);
