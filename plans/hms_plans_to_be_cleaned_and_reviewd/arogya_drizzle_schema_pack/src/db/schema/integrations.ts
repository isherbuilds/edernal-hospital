import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
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
  timestampColumns,
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
    allowedPurposes: text("allowed_purposes").array().notNull().default(sql`ARRAY[]::text[]`),
    healthStatus: text("health_status").notNull().default("unknown"),
    lastHealthCheckAt: timestamp("last_health_check_at", { withTimezone: true }),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("integration_connection_unique_uq").on(t.tenantId, t.facilityId, t.kind, t.environment, t.name), index("integration_connection_kind_idx").on(t.tenantId, t.kind, t.environment)],
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
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("integration_message_idempotency_uq").on(t.connectionId, t.idempotencyKey),
    index("integration_message_status_idx").on(t.tenantId, t.status, t.nextAttemptAt, t.priority),
    index("integration_message_external_idx").on(t.connectionId, t.externalMessageId),
  ],
);

export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(() => integrationConnections.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetUrl: text("target_url").notNull(),
    secretRef: text("secret_ref"),
    eventTypes: text("event_types").array().notNull(),
    status: text("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [index("webhook_subscription_tenant_idx").on(t.tenantId, t.status)],
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
    ...timestampColumns,
  },
  (t) => [index("webhook_delivery_status_idx").on(t.tenantId, t.status, t.nextAttemptAt), uniqueIndex("webhook_delivery_event_sub_uq").on(t.subscriptionId, t.eventId)],
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
    ...timestampColumns,
  },
  (t) => [uniqueIndex("abdm_patient_link_uq").on(t.tenantId, t.patientLogicalId, t.abhaAddress), index("abdm_link_status_idx").on(t.tenantId, t.linkStatus)],
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
    hiTypes: text("hi_types").array().notNull().default(sql`ARRAY[]::text[]`),
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
    ...timestampColumns,
  },
  (t) => [uniqueIndex("abdm_consent_artifact_uq").on(t.tenantId, t.consentArtifactId), index("abdm_consent_patient_status_idx").on(t.tenantId, t.patientLogicalId, t.status)],
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
    consentArtifactId: uuid("consent_artifact_id").references(() => abdmConsentArtifacts.id, { onDelete: "set null" }),
    bundleLogicalId: uuid("bundle_logical_id"),
    hiType: text("hi_type").notNull(),
    shareStatus: syncStatus("share_status").notNull().default("pending"),
    externalTransactionId: text("external_transaction_id"),
    bundleHash: text("bundle_hash"),
    pushedAt: timestamp("pushed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [index("abdm_hi_share_status_idx").on(t.tenantId, t.shareStatus, t.createdAt), index("abdm_hi_patient_idx").on(t.tenantId, t.patientLogicalId)],
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
    ...timestampColumns,
  },
  (t) => [index("whatsapp_message_status_idx").on(t.tenantId, t.status, t.createdAt), index("whatsapp_message_provider_idx").on(t.providerMessageId)],
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
    ...timestampColumns,
  },
  (t) => [uniqueIndex("hl7_message_control_uq").on(t.connectionId, t.messageControlId), index("hl7_message_status_idx").on(t.tenantId, t.status, t.createdAt)],
);
