import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
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
    ...timestampColumns,
  },
  (t) => [uniqueIndex("edge_device_code_uq").on(t.tenantId, t.facilityId, t.deviceCode), index("edge_device_status_idx").on(t.tenantId, t.status, t.lastHeartbeatAt)],
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
    ...timestampColumns,
  },
  (t) => [uniqueIndex("edge_sync_cursor_uq").on(t.edgeDeviceId, t.streamName)],
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
    ...timestampColumns,
  },
  (t) => [index("edge_command_status_idx").on(t.edgeDeviceId, t.status, t.issuedAt)],
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
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("offline_queue_idempotency_uq").on(t.edgeDeviceId, t.idempotencyKey),
    uniqueIndex("offline_queue_sequence_uq").on(t.edgeDeviceId, t.queueName, t.localSequence),
    index("offline_queue_status_idx").on(t.tenantId, t.status, t.nextAttemptAt),
  ],
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
    ...timestampColumns,
  },
  (t) => [uniqueIndex("bill_number_reservation_uq").on(t.tenantId, t.facilityId, t.seriesCode, t.startNumber, t.endNumber)],
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
    ...timestampColumns,
  },
  (t) => [uniqueIndex("idempotency_key_scope_uq").on(t.tenantId, t.scope, t.key), index("idempotency_expiry_idx").on(t.expiresAt)],
);
