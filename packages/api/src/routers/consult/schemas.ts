import { z } from "zod";

import {
  ClinicalArtifactStatusSchema,
  ConsultNoteVitalsSchema,
  NOTE_TEXT_LIMIT,
  PRESCRIPTION_TEXT_LIMIT
} from "@tsu-stack/core/clinical";

import { TenantScopeInputSchema } from "#@/lib/tenancy/scope";
import { FacilityAddressSchema } from "#@/routers/facility/queries";
import { PatientOutputSchema } from "#@/routers/patient/queries";
import { EncounterOutputSchema, QueueTokenOutputSchema } from "#@/routers/queue/queries";

const NoteTextInputSchema = z.string().trim().max(NOTE_TEXT_LIMIT).default("");
const PrescriptionTextInputSchema = z.string().trim().max(PRESCRIPTION_TEXT_LIMIT).default("");

export const ConsultWorkspaceInputSchema = TenantScopeInputSchema.extend({
  encounterId: z.uuid()
});

export const ConsultNoteSaveInputSchema = ConsultWorkspaceInputSchema.extend({
  advice: NoteTextInputSchema,
  complaints: NoteTextInputSchema,
  diagnosisCode: z.string().trim().max(100).nullable().optional(),
  diagnosisText: NoteTextInputSchema,
  findings: NoteTextInputSchema,
  followUp: NoteTextInputSchema,
  vitals: ConsultNoteVitalsSchema.default({})
});

export const ConsultNoteByIdInputSchema = TenantScopeInputSchema.extend({
  consultNoteId: z.uuid()
});

const PrescriptionLineInputSchema = z.object({
  dose: PrescriptionTextInputSchema,
  duration: PrescriptionTextInputSchema,
  formularyItemId: z.uuid().optional(),
  frequency: PrescriptionTextInputSchema,
  instructions: PrescriptionTextInputSchema,
  medicationText: z.string().trim().min(1).max(PRESCRIPTION_TEXT_LIMIT)
});

export const PrescriptionSaveInputSchema = ConsultWorkspaceInputSchema.extend({
  lines: z.array(PrescriptionLineInputSchema).min(1)
});

export const PrescriptionByIdInputSchema = TenantScopeInputSchema.extend({
  prescriptionId: z.uuid()
});

const NullableIsoDateTimeSchema = z.iso.datetime().nullable();

export const ConsultNoteOutputSchema = z.object({
  advice: z.string(),
  complaints: z.string(),
  createdAt: z.iso.datetime(),
  diagnosisCode: z.string().nullable(),
  diagnosisText: z.string(),
  encounterId: z.uuid(),
  findings: z.string(),
  followUp: z.string(),
  id: z.uuid(),
  patientId: z.uuid(),
  practitionerId: z.uuid(),
  signedAt: NullableIsoDateTimeSchema,
  signedByUserId: z.string().nullable(),
  status: ClinicalArtifactStatusSchema,
  supersedesConsultNoteId: z.uuid().nullable(),
  updatedAt: z.iso.datetime(),
  vitals: ConsultNoteVitalsSchema
});

export const PrescriptionLineOutputSchema = z.object({
  createdAt: z.iso.datetime(),
  dose: z.string(),
  duration: z.string(),
  formularyItemId: z.uuid().nullable(),
  frequency: z.string(),
  id: z.uuid(),
  instructions: z.string(),
  medicationText: z.string(),
  prescriptionId: z.uuid(),
  sequence: z.number().int(),
  updatedAt: z.iso.datetime()
});

export const PrescriptionOutputSchema = z.object({
  createdAt: z.iso.datetime(),
  encounterId: z.uuid(),
  id: z.uuid(),
  lines: z.array(PrescriptionLineOutputSchema),
  patientId: z.uuid(),
  practitionerId: z.uuid(),
  signedAt: NullableIsoDateTimeSchema,
  signedByUserId: z.string().nullable(),
  status: ClinicalArtifactStatusSchema,
  supersedesPrescriptionId: z.uuid().nullable(),
  updatedAt: z.iso.datetime()
});

export const ConsultPractitionerOutputSchema = z.object({
  displayName: z.string(),
  id: z.uuid(),
  registrationCouncil: z.string(),
  registrationNumber: z.string(),
  specialties: z.array(z.string())
});

export const ConsultWorkspaceOutputSchema = z.object({
  canWriteClinical: z.boolean(),
  consultNote: ConsultNoteOutputSchema.nullable(),
  encounter: EncounterOutputSchema,
  patient: PatientOutputSchema,
  practitioner: ConsultPractitionerOutputSchema,
  prescription: PrescriptionOutputSchema.nullable(),
  token: QueueTokenOutputSchema.nullable()
});

const PrescriptionPrintPrescriptionSchema = z.object({
  id: z.uuid(),
  lines: z.array(PrescriptionLineOutputSchema),
  signedAt: z.iso.datetime(),
  status: z.literal("signed")
});

export const PrescriptionPrintOutputSchema = z.object({
  encounter: z.object({
    id: z.uuid()
  }),
  facility: z.object({
    address: FacilityAddressSchema,
    gstin: z.string().nullable(),
    name: z.string()
  }),
  patient: PatientOutputSchema,
  practitioner: ConsultPractitionerOutputSchema,
  prescription: PrescriptionPrintPrescriptionSchema,
  tenant: z.object({
    displayName: z.string().nullable(),
    legalName: z.string().nullable()
  })
});

export type ConsultWorkspaceOutput = z.infer<typeof ConsultWorkspaceOutputSchema>;
export type ConsultNoteOutput = z.infer<typeof ConsultNoteOutputSchema>;
export type PrescriptionOutput = z.infer<typeof PrescriptionOutputSchema>;
export type PrescriptionPrintOutput = z.infer<typeof PrescriptionPrintOutputSchema>;
