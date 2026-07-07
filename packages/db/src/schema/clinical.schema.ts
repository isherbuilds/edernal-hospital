import { sql } from "drizzle-orm";
import {
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { type ConsultNoteVitals } from "@tsu-stack/core/clinical";

import { organization } from "#@/schema/auth.schema";
import { facilities, practitioners, tenantResourceStatus } from "#@/schema/tenancy.schema";

export const clinicalArtifactStatus = pgEnum("clinical_artifact_status", [
  "preliminary",
  "signed",
  "superseded"
]);
export const patientSex = pgEnum("patient_sex", ["male", "female", "other", "unknown"]);
export const encounterStatus = pgEnum("encounter_status", ["planned", "in_progress", "finished"]);
export const tokenStatus = pgEnum("token_status", ["waiting", "in_consult", "done", "skipped"]);

export type PatientAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export const patients = pgTable(
  "patients",
  {
    address: jsonb("address").$type<PatientAddress>().default({}).notNull(),
    allergies: text("allergies").default("").notNull(),
    ageYears: integer("age_years"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    dateOfBirth: date("date_of_birth", { mode: "string" }),
    fullName: text("full_name").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    phone: text("phone").notNull(),
    phoneNormalized: text("phone_normalized").notNull(),
    sex: patientSex("sex").default("unknown").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  (table) => [
    uniqueIndex("patients_tenant_id_id_unique").on(table.tenantId, table.id),
    index("patients_tenant_id_phone_normalized_idx").on(table.tenantId, table.phoneNormalized),
    index("patients_tenant_id_full_name_idx").on(table.tenantId, table.fullName)
  ]
);

export const patientIdentifiers = pgTable(
  "patient_identifiers",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id").notNull(),
    system: text("system").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    value: text("value").notNull()
  },
  (table) => [
    index("patient_identifiers_tenant_id_patient_id_idx").on(table.tenantId, table.patientId),
    foreignKey({
      columns: [table.tenantId, table.patientId],
      foreignColumns: [patients.tenantId, patients.id],
      name: "patient_identifiers_tenant_id_patient_id_patients_tenant_id_id_fk"
    }).onDelete("cascade"),
    uniqueIndex("patient_identifiers_tenant_id_system_value_unique").on(
      table.tenantId,
      table.system,
      table.value
    )
  ]
);

export const encounters = pgTable(
  "encounters",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    facilityId: uuid("facility_id").notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id").notNull(),
    practitionerId: uuid("practitioner_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    status: encounterStatus("status").default("planned").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  (table) => [
    uniqueIndex("encounters_tenant_id_id_unique").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.facilityId],
      foreignColumns: [facilities.tenantId, facilities.id],
      name: "encounters_tenant_id_facility_id_facilities_tenant_id_id_fk"
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.patientId],
      foreignColumns: [patients.tenantId, patients.id],
      name: "encounters_tenant_id_patient_id_patients_tenant_id_id_fk"
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.practitionerId],
      foreignColumns: [practitioners.tenantId, practitioners.id],
      name: "encounters_tenant_id_practitioner_id_practitioners_tenant_id_id_fk"
    }).onDelete("restrict"),
    index("encounters_tenant_id_patient_id_idx").on(table.tenantId, table.patientId),
    index("encounters_tenant_id_practitioner_id_status_idx").on(
      table.tenantId,
      table.practitionerId,
      table.status
    )
  ]
);

export const tokens = pgTable(
  "tokens",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    encounterId: uuid("encounter_id").notNull(),
    facilityId: uuid("facility_id").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id").notNull(),
    practitionerId: uuid("practitioner_id").notNull(),
    sequence: integer("sequence").notNull(),
    status: tokenStatus("status").default("waiting").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    tokenDate: date("token_date", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  (table) => [
    uniqueIndex("tokens_tenant_id_encounter_id_unique").on(table.tenantId, table.encounterId),
    foreignKey({
      columns: [table.tenantId, table.encounterId],
      foreignColumns: [encounters.tenantId, encounters.id],
      name: "tokens_tenant_id_encounter_id_encounters_tenant_id_id_fk"
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenantId, table.facilityId],
      foreignColumns: [facilities.tenantId, facilities.id],
      name: "tokens_tenant_id_facility_id_facilities_tenant_id_id_fk"
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.patientId],
      foreignColumns: [patients.tenantId, patients.id],
      name: "tokens_tenant_id_patient_id_patients_tenant_id_id_fk"
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.practitionerId],
      foreignColumns: [practitioners.tenantId, practitioners.id],
      name: "tokens_tenant_id_practitioner_id_practitioners_tenant_id_id_fk"
    }).onDelete("restrict"),
    uniqueIndex("tokens_tenant_id_practitioner_id_date_sequence_unique").on(
      table.tenantId,
      table.practitionerId,
      table.tokenDate,
      table.sequence
    ),
    index("tokens_tenant_id_facility_id_date_status_idx").on(
      table.tenantId,
      table.facilityId,
      table.tokenDate,
      table.status
    ),
    index("tokens_tenant_id_practitioner_id_date_idx").on(
      table.tenantId,
      table.practitionerId,
      table.tokenDate
    )
  ]
);

export const consultNotes = pgTable(
  "consult_notes",
  {
    advice: text("advice").default("").notNull(),
    complaints: text("complaints").default("").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    diagnosisCode: text("diagnosis_code"),
    diagnosisText: text("diagnosis_text").default("").notNull(),
    encounterId: uuid("encounter_id").notNull(),
    findings: text("findings").default("").notNull(),
    followUp: text("follow_up").default("").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id").notNull(),
    practitionerId: uuid("practitioner_id").notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    signedByUserId: text("signed_by_user_id"),
    status: clinicalArtifactStatus("status").default("preliminary").notNull(),
    supersedesConsultNoteId: uuid("supersedes_consult_note_id"),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    vitals: jsonb("vitals").$type<ConsultNoteVitals>().default({}).notNull()
  },
  (table) => [
    uniqueIndex("consult_notes_tenant_id_id_unique").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.encounterId],
      foreignColumns: [encounters.tenantId, encounters.id],
      name: "consult_notes_tenant_id_encounter_id_encounters_tenant_id_id_fk"
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.patientId],
      foreignColumns: [patients.tenantId, patients.id],
      name: "consult_notes_tenant_id_patient_id_patients_tenant_id_id_fk"
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.practitionerId],
      foreignColumns: [practitioners.tenantId, practitioners.id],
      name: "consult_notes_tenant_id_practitioner_id_practitioners_tenant_id_id_fk"
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.supersedesConsultNoteId],
      foreignColumns: [table.tenantId, table.id],
      name: "consult_notes_tenant_id_supersedes_consult_note_id_consult_notes_tenant_id_id_fk"
    }).onDelete("restrict"),
    uniqueIndex("consult_notes_tenant_id_encounter_id_unique")
      .on(table.tenantId, table.encounterId)
      .where(sql`${table.status} <> 'superseded'`),
    index("consult_notes_tenant_id_patient_id_idx").on(table.tenantId, table.patientId),
    uniqueIndex("consult_notes_tenant_id_supersedes_consult_note_id_unique").on(
      table.tenantId,
      table.supersedesConsultNoteId
    )
  ]
);

export const prescriptions = pgTable(
  "prescriptions",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    encounterId: uuid("encounter_id").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id").notNull(),
    practitionerId: uuid("practitioner_id").notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    signedByUserId: text("signed_by_user_id"),
    status: clinicalArtifactStatus("status").default("preliminary").notNull(),
    supersedesPrescriptionId: uuid("supersedes_prescription_id"),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  (table) => [
    uniqueIndex("prescriptions_tenant_id_id_unique").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.encounterId],
      foreignColumns: [encounters.tenantId, encounters.id],
      name: "prescriptions_tenant_id_encounter_id_encounters_tenant_id_id_fk"
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.patientId],
      foreignColumns: [patients.tenantId, patients.id],
      name: "prescriptions_tenant_id_patient_id_patients_tenant_id_id_fk"
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.practitionerId],
      foreignColumns: [practitioners.tenantId, practitioners.id],
      name: "prescriptions_tenant_id_practitioner_id_practitioners_tenant_id_id_fk"
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.supersedesPrescriptionId],
      foreignColumns: [table.tenantId, table.id],
      name: "prescriptions_tenant_id_supersedes_prescription_id_prescriptions_tenant_id_id_fk"
    }).onDelete("restrict"),
    uniqueIndex("prescriptions_tenant_id_encounter_id_unique")
      .on(table.tenantId, table.encounterId)
      .where(sql`${table.status} <> 'superseded'`),
    index("prescriptions_tenant_id_patient_id_idx").on(table.tenantId, table.patientId),
    uniqueIndex("prescriptions_tenant_id_supersedes_prescription_id_unique").on(
      table.tenantId,
      table.supersedesPrescriptionId
    )
  ]
);

export const formularyItems = pgTable(
  "formulary_items",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    defaultDoseText: text("default_dose_text").default("").notNull(),
    form: text("form").default("").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    status: tenantResourceStatus("status").default("active").notNull(),
    strength: text("strength").default("").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  (table) => [
    uniqueIndex("formulary_items_tenant_id_id_unique").on(table.tenantId, table.id),
    uniqueIndex("formulary_items_tenant_id_name_strength_form_unique").on(
      table.tenantId,
      table.name,
      table.strength,
      table.form
    )
  ]
);

export const prescriptionLines = pgTable(
  "prescription_lines",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    dose: text("dose").default("").notNull(),
    duration: text("duration").default("").notNull(),
    formularyItemId: uuid("formulary_item_id"),
    frequency: text("frequency").default("").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    instructions: text("instructions").default("").notNull(),
    medicationText: text("medication_text").notNull(),
    prescriptionId: uuid("prescription_id").notNull(),
    sequence: integer("sequence").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  (table) => [
    uniqueIndex("prescription_lines_tenant_id_id_unique").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.prescriptionId],
      foreignColumns: [prescriptions.tenantId, prescriptions.id],
      name: "prescription_lines_tenant_id_prescription_id_prescriptions_tenant_id_id_fk"
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenantId, table.formularyItemId],
      foreignColumns: [formularyItems.tenantId, formularyItems.id],
      name: "prescription_lines_tenant_id_formulary_item_id_formulary_items_tenant_id_id_fk"
    }).onDelete("restrict"),
    uniqueIndex("prescription_lines_tenant_id_prescription_id_sequence_unique").on(
      table.tenantId,
      table.prescriptionId,
      table.sequence
    )
  ]
);

export const noteTemplates = pgTable(
  "note_templates",
  {
    advice: text("advice").default("").notNull(),
    complaints: text("complaints").default("").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    diagnosisText: text("diagnosis_text").default("").notNull(),
    findings: text("findings").default("").notNull(),
    followUp: text("follow_up").default("").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    specialty: text("specialty"),
    status: tenantResourceStatus("status").default("active").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  (table) => [
    uniqueIndex("note_templates_tenant_id_id_unique").on(table.tenantId, table.id),
    uniqueIndex("note_templates_tenant_id_name_unique").on(table.tenantId, table.name)
  ]
);
