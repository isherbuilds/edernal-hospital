import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
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
  timestampColumns,
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
    ...timestampColumns,
  },
  (t) => [uniqueIndex("ai_provider_code_uq").on(t.code)],
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
    languageSupport: text("language_support").array().notNull().default(sql`ARRAY[]::text[]`),
    status: text("status").notNull().default("candidate"),
    costPerUnit: numeric("cost_per_unit", { precision: 12, scale: 6 }),
    unit: text("unit"),
    metadata: jsonbObj("metadata"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("ai_model_version_uq").on(t.providerId, t.modelCode, t.modelVersion)],
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
    practitionerId: uuid("practitioner_id").references(() => practitioners.id, { onDelete: "set null" }),
    consentId: uuid("consent_id").references(() => patientConsents.id, { onDelete: "restrict" }),
    status: aiArtifactStatus("status").notNull().default("captured"),
    languageHint: text("language_hint").notNull().default("hi-IN,en-IN"),
    audioObjectId: uuid("audio_object_id").references(() => objectBlobs.id, { onDelete: "set null" }),
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
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("scribe_session_encounter_uq").on(t.tenantId, t.encounterLogicalId),
    index("scribe_session_status_idx").on(t.tenantId, t.status, t.startedAt),
  ],
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
    ...timestampColumns,
  },
  (t) => [uniqueIndex("scribe_chunk_sequence_uq").on(t.scribeSessionId, t.sequence)],
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
    ...timestampColumns,
  },
  (t) => [index("transcript_session_idx").on(t.scribeSessionId, t.status), index("transcript_text_fts_idx").using("gin", sql`to_tsvector('simple', coalesce(${t.transcriptText}, ''))`)],
);

export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    scribeSessionId: uuid("scribe_session_id").references(() => scribeSessions.id, { onDelete: "set null" }),
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
    ...timestampColumns,
  },
  (t) => [index("ai_generation_session_idx").on(t.tenantId, t.scribeSessionId, t.artifactType), index("ai_generation_status_idx").on(t.tenantId, t.status)],
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
    ...timestampColumns,
  },
  (t) => [index("ai_review_generation_idx").on(t.aiGenerationId), index("ai_review_outcome_idx").on(t.tenantId, t.outcome, t.reviewedAt)],
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
    aiGenerationId: uuid("ai_generation_id").references(() => aiGenerations.id, { onDelete: "set null" }),
    preliminaryVersionId: uuid("preliminary_version_id").notNull(),
    finalVersionId: uuid("final_version_id"),
    status: text("status").notNull().default("preliminary"),
    requiredReviewFields: jsonbArray<Record<string, unknown>>("required_review_fields"),
    signedByUserId: text("signed_by_user_id"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    blockedReason: text("blocked_reason"),
    ...timestampColumns,
  },
  (t) => [uniqueIndex("ai_signoff_resource_uq").on(t.tenantId, t.resourceType, t.logicalId, t.preliminaryVersionId)],
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
    ...timestampColumns,
  },
  (t) => [index("ocr_job_status_idx").on(t.tenantId, t.status, t.priority, t.createdAt), index("ocr_job_patient_idx").on(t.tenantId, t.patientLogicalId)],
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
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("ai_eval_dataset_version_uq").on(t.tenantId, t.code, t.datasetVersion),
    index("ai_eval_dataset_tenant_idx").on(t.tenantId),
  ],
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
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("ai_eval_run_code_uq").on(t.tenantId, t.runCode),
    index("ai_eval_run_model_idx").on(t.tenantId, t.modelId, t.status),
  ],
);
