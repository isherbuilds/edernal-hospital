import {
  date,
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

import { organization } from "#@/schema/auth.schema";
import { facilities, practitioners } from "#@/schema/tenancy.schema";

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
    index("patients_tenant_id_phone_normalized_idx").on(table.tenantId, table.phoneNormalized),
    index("patients_tenant_id_full_name_idx").on(table.tenantId, table.fullName)
  ]
);

export const patientIdentifiers = pgTable(
  "patient_identifiers",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    system: text("system").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    value: text("value").notNull()
  },
  (table) => [
    index("patient_identifiers_tenant_id_patient_id_idx").on(table.tenantId, table.patientId),
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
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    practitionerId: uuid("practitioner_id")
      .notNull()
      .references(() => practitioners.id, { onDelete: "restrict" }),
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
    encounterId: uuid("encounter_id")
      .notNull()
      .references(() => encounters.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    practitionerId: uuid("practitioner_id")
      .notNull()
      .references(() => practitioners.id, { onDelete: "restrict" }),
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
