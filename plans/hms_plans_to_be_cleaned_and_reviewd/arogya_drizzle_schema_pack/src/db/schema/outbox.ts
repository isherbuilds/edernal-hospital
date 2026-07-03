import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import {
  dataClassification,
  eventPublishStatus,
  facilityScopeColumns,
  jsonbObj,
  jobPriority,
  requestTraceColumns,
  tenantScopeColumns,
  timestampColumns,
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
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("outbox_idempotency_uq").on(t.tenantId, t.idempotencyKey),
    index("outbox_pending_idx").on(t.publishStatus, t.availableAt, t.priority),
    index("outbox_aggregate_idx").on(t.tenantId, t.aggregateType, t.aggregateId),
    index("outbox_event_type_idx").on(t.eventType, t.eventVersion),
    index("outbox_payload_gin_idx").using("gin", sql`${t.payload}`),
  ],
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
    ...timestampColumns,
  },
  (t) => [uniqueIndex("outbox_consumer_offsets_uq").on(t.consumerName, t.topicName, t.partitionKey)],
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
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("inbox_processed_messages_uq").on(t.tenantId, t.consumerName, t.sourceSystem, t.messageId),
    index("inbox_idempotency_idx").on(t.tenantId, t.idempotencyKey),
  ],
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
    ...timestampColumns,
  },
  (t) => [
    index("background_jobs_pick_idx").on(t.queueName, t.status, t.runAfter, t.priority),
    index("background_jobs_tenant_type_idx").on(t.tenantId, t.jobType, t.status),
  ],
);
