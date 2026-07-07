import { ORPCError } from "@orpc/server";
import { type z } from "zod";

import {
  type consultNotes,
  type encounters,
  type patients,
  type prescriptionLines,
  type prescriptions,
  type practitioners,
  type tokens
} from "@tsu-stack/db/schema";

import { EncounterOutputSchema, QueueTokenOutputSchema } from "#@/routers/queue/queries";

import {
  ConsultNoteOutputSchema,
  ConsultPractitionerOutputSchema,
  PrescriptionLineOutputSchema,
  PrescriptionOutputSchema,
  type ConsultNoteOutput,
  type PrescriptionOutput
} from "./schemas";

export type ConsultNoteRow = typeof consultNotes.$inferSelect;
export type EncounterRow = typeof encounters.$inferSelect;
export type PatientRow = typeof patients.$inferSelect;
export type PractitionerRow = typeof practitioners.$inferSelect;
export type PrescriptionLineRow = typeof prescriptionLines.$inferSelect;
export type PrescriptionRow = typeof prescriptions.$inferSelect;
export type TokenRow = typeof tokens.$inferSelect;

export type Forbidden = () => never;
export type TenantProfileForPrint = {
  displayName: string | null;
  legalName: string | null;
};

export function notFound(message: string): never {
  throw new ORPCError("NOT_FOUND", {
    message,
    status: 404
  });
}

export function badRequest(message: string): never {
  throw new ORPCError("BAD_REQUEST", {
    message,
    status: 400
  });
}

export function conflict(message: string): never {
  throw new ORPCError("CONFLICT", {
    message,
    status: 409
  });
}

export function toEncounterOutput(row: EncounterRow): z.infer<typeof EncounterOutputSchema> {
  return EncounterOutputSchema.parse({
    createdAt: row.createdAt.toISOString(),
    facilityId: row.facilityId,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    id: row.id,
    patientId: row.patientId,
    practitionerId: row.practitionerId,
    startedAt: row.startedAt?.toISOString() ?? null,
    status: row.status,
    updatedAt: row.updatedAt.toISOString()
  });
}

export function toPractitionerOutput(
  row: PractitionerRow
): z.infer<typeof ConsultPractitionerOutputSchema> {
  return ConsultPractitionerOutputSchema.parse({
    displayName: row.displayName,
    id: row.id,
    registrationCouncil: row.registrationCouncil,
    registrationNumber: row.registrationNumber,
    specialties: row.specialties
  });
}

export function toQueueTokenOutput(row: {
  patientAgeYears: number | null;
  patientName: string;
  practitionerName: string;
  token: TokenRow;
}): z.infer<typeof QueueTokenOutputSchema> {
  return QueueTokenOutputSchema.parse({
    createdAt: row.token.createdAt.toISOString(),
    encounterId: row.token.encounterId,
    facilityId: row.token.facilityId,
    id: row.token.id,
    patientAgeYears: row.patientAgeYears,
    patientId: row.token.patientId,
    patientName: row.patientName,
    practitionerId: row.token.practitionerId,
    practitionerName: row.practitionerName,
    sequence: row.token.sequence,
    status: row.token.status,
    tokenDate: row.token.tokenDate,
    updatedAt: row.token.updatedAt.toISOString()
  });
}

export function toConsultNoteOutput(row: ConsultNoteRow): ConsultNoteOutput {
  return ConsultNoteOutputSchema.parse({
    advice: row.advice,
    complaints: row.complaints,
    createdAt: row.createdAt.toISOString(),
    diagnosisCode: row.diagnosisCode,
    diagnosisText: row.diagnosisText,
    encounterId: row.encounterId,
    findings: row.findings,
    followUp: row.followUp,
    id: row.id,
    patientId: row.patientId,
    practitionerId: row.practitionerId,
    signedAt: row.signedAt?.toISOString() ?? null,
    signedByUserId: row.signedByUserId,
    status: row.status,
    supersedesConsultNoteId: row.supersedesConsultNoteId,
    updatedAt: row.updatedAt.toISOString(),
    vitals: row.vitals
  });
}

export function toPrescriptionLineOutput(
  row: PrescriptionLineRow
): z.infer<typeof PrescriptionLineOutputSchema> {
  return PrescriptionLineOutputSchema.parse({
    createdAt: row.createdAt.toISOString(),
    dose: row.dose,
    duration: row.duration,
    formularyItemId: row.formularyItemId,
    frequency: row.frequency,
    id: row.id,
    instructions: row.instructions,
    medicationText: row.medicationText,
    prescriptionId: row.prescriptionId,
    sequence: row.sequence,
    updatedAt: row.updatedAt.toISOString()
  });
}

export function toPrescriptionOutput(
  row: PrescriptionRow,
  lines: PrescriptionLineRow[]
): PrescriptionOutput {
  return PrescriptionOutputSchema.parse({
    createdAt: row.createdAt.toISOString(),
    encounterId: row.encounterId,
    id: row.id,
    lines: lines.map(toPrescriptionLineOutput),
    patientId: row.patientId,
    practitionerId: row.practitionerId,
    signedAt: row.signedAt?.toISOString() ?? null,
    signedByUserId: row.signedByUserId,
    status: row.status,
    supersedesPrescriptionId: row.supersedesPrescriptionId,
    updatedAt: row.updatedAt.toISOString()
  });
}
