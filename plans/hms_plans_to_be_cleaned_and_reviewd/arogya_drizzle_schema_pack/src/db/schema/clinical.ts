import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgTable, text, time, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import {
  appointmentStatus,
  auditActorColumns,
  encounterClass,
  encounterStatus,
  jsonbArray,
  jsonbObj,
  queueTokenStatus,
  safetySeverity,
  timestampColumns,
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
    practitionerId: uuid("practitioner_id").references(() => practitioners.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    visitType: text("visit_type").notNull().default("opd_consult"),
    slotDurationMinutes: integer("slot_duration_minutes").notNull().default(10),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    status: text("status").notNull().default("active"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [index("appointment_books_lookup_idx").on(t.tenantId, t.facilityId, t.practitionerId, t.departmentId)],
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
    ...timestampColumns,
  },
  (t) => [index("appointment_book_schedule_idx").on(t.appointmentBookId, t.dayOfWeek, t.effectiveFrom)],
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
    appointmentBookId: uuid("appointment_book_id").references(() => appointmentBooks.id, { onDelete: "set null" }),
    fhirAppointmentId: uuid("fhir_appointment_id").references(() => fhirResourceCurrent.id, { onDelete: "set null" }),
    patientLogicalId: uuid("patient_logical_id").notNull(),
    practitionerId: uuid("practitioner_id").references(() => practitioners.id, { onDelete: "set null" }),
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
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("appointments_idempotency_uq").on(t.tenantId, t.idempotencyKey),
    index("appointments_slot_lookup_idx").on(t.tenantId, t.practitionerId, t.startsAt, t.status),
    index("appointments_patient_idx").on(t.tenantId, t.patientLogicalId, t.startsAt),
  ],
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
    practitionerId: uuid("practitioner_id").references(() => practitioners.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    boardDate: date("board_date", { mode: "string" }).notNull(),
    status: text("status").notNull().default("open"),
    currentTokenNumber: integer("current_token_number"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("queue_board_unique_uq").on(t.tenantId, t.facilityId, t.practitionerId, t.departmentId, t.boardDate)],
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
    appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
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
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("queue_token_number_uq").on(t.queueBoardId, t.tokenNumber),
    uniqueIndex("queue_token_idempotency_uq").on(t.tenantId, t.idempotencyKey),
    index("queue_token_board_status_idx").on(t.queueBoardId, t.status, t.priority, t.tokenNumber),
  ],
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
    ...timestampColumns,
  },
  (t) => [index("encounter_lifecycle_idx").on(t.tenantId, t.encounterLogicalId, t.occurredAt)],
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
    assignedToPractitionerId: uuid("assigned_to_practitioner_id").references(() => practitioners.id, { onDelete: "set null" }),
    taskType: text("task_type").notNull(),
    status: text("status").notNull().default("requested"),
    priority: text("priority").notNull().default("routine"),
    title: text("title").notNull(),
    description: text("description"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    fhirTaskId: uuid("fhir_task_id"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [index("clinical_task_assignee_idx").on(t.tenantId, t.assignedToUserId, t.status, t.dueAt), index("clinical_task_patient_idx").on(t.tenantId, t.patientLogicalId)],
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
    practitionerId: uuid("practitioner_id").references(() => practitioners.id, { onDelete: "set null" }),
    source: text("source").notNull().default("manual"), // manual | ai_scribe | imported
    status: text("status").notNull().default("draft"),
    fhirMedicationRequestIds: uuid("fhir_medication_request_ids").array(),
    mandatoryReviewFields: jsonbArray("mandatory_review_fields"),
    signedByUserId: text("signed_by_user_id"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [index("prescription_draft_encounter_idx").on(t.tenantId, t.encounterLogicalId, t.status)],
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
    drugProductId: uuid("drug_product_id").references(() => drugProducts.id, { onDelete: "set null" }),
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
    ...timestampColumns,
  },
  (t) => [index("prescription_line_draft_idx").on(t.prescriptionDraftId, t.sequence)],
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
    ...timestampColumns,
  },
  (t) => [index("med_safety_draft_idx").on(t.tenantId, t.prescriptionDraftId, t.severity, t.status)],
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
    signedByPractitionerId: uuid("signed_by_practitioner_id").references(() => practitioners.id, { onDelete: "set null" }),
    signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
    signatureHash: text("signature_hash").notNull(),
    attestationText: text("attestation_text").notNull(),
    source: text("source").notNull().default("doctor_tablet"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("clinical_note_signature_uq").on(t.tenantId, t.compositionLogicalId, t.compositionVersionId)],
);
