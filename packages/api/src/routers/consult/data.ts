import { type z } from "zod";

import { type ClinicalArtifactStatus } from "@tsu-stack/core/clinical";
import { and, asc, eq, inArray, ne } from "@tsu-stack/db";
import {
  consultNotes,
  encounters,
  formularyItems,
  patients,
  prescriptionLines,
  prescriptions,
  practitioners,
  tokens
} from "@tsu-stack/db/schema";

import { isUniqueConstraintError } from "#@/lib/db-errors";
import { type TenantTxScope } from "#@/lib/tenancy/scoped-db";

import {
  badRequest,
  conflict,
  notFound,
  toPrescriptionOutput,
  toQueueTokenOutput,
  type Forbidden,
  type PatientRow,
  type PractitionerRow,
  type PrescriptionRow
} from "./mappers";
import { type ConsultNoteSaveInputSchema, type PrescriptionSaveInputSchema } from "./schemas";

export function noteContentPatch(input: z.infer<typeof ConsultNoteSaveInputSchema>) {
  return {
    advice: input.advice,
    complaints: input.complaints,
    diagnosisCode: input.diagnosisCode ?? null,
    diagnosisText: input.diagnosisText,
    findings: input.findings,
    followUp: input.followUp,
    vitals: input.vitals
  };
}

export function mapUniqueCurrentNoteError(error: unknown): never {
  if (isUniqueConstraintError(error, "consult_notes_tenant_id_encounter_id_unique")) {
    conflict("Consult note changed. Reload and retry.");
  }

  throw error;
}

export function mapUniqueCurrentPrescriptionError(error: unknown): never {
  if (isUniqueConstraintError(error, "prescriptions_tenant_id_encounter_id_unique")) {
    conflict("Prescription changed. Reload and retry.");
  }

  throw error;
}

export function assertSupersedable(
  status: ClinicalArtifactStatus,
  messages: { notSigned: string; alreadySuperseded: string }
) {
  if (status === "preliminary") {
    badRequest(messages.notSigned);
  }
  if (status === "superseded") {
    conflict(messages.alreadySuperseded);
  }
}

export async function encounterById(scope: TenantTxScope, encounterId: string) {
  const [encounter] = await scope.tx
    .select()
    .from(encounters)
    .where(and(eq(encounters.tenantId, scope.tenantId), eq(encounters.id, encounterId)))
    .limit(1);

  return encounter ?? null;
}

export async function currentConsultNoteForEncounter(scope: TenantTxScope, encounterId: string) {
  const [note] = await scope.tx
    .select()
    .from(consultNotes)
    .where(
      and(
        eq(consultNotes.tenantId, scope.tenantId),
        eq(consultNotes.encounterId, encounterId),
        ne(consultNotes.status, "superseded")
      )
    )
    .limit(1);

  return note ?? null;
}

export async function prescriptionLinesFor(scope: TenantTxScope, prescriptionId: string) {
  return scope.tx
    .select()
    .from(prescriptionLines)
    .where(
      and(
        eq(prescriptionLines.tenantId, scope.tenantId),
        eq(prescriptionLines.prescriptionId, prescriptionId)
      )
    )
    .orderBy(asc(prescriptionLines.sequence));
}

export async function currentPrescriptionForEncounter(scope: TenantTxScope, encounterId: string) {
  const [prescription] = await scope.tx
    .select()
    .from(prescriptions)
    .where(
      and(
        eq(prescriptions.tenantId, scope.tenantId),
        eq(prescriptions.encounterId, encounterId),
        ne(prescriptions.status, "superseded")
      )
    )
    .limit(1);

  return prescription ?? null;
}

export async function prescriptionOutputFor(scope: TenantTxScope, prescription: PrescriptionRow) {
  const lines = await prescriptionLinesFor(scope, prescription.id);
  return toPrescriptionOutput(prescription, lines);
}

export async function loadPatient(scope: TenantTxScope, patientId: string): Promise<PatientRow> {
  const [patient] = await scope.tx
    .select()
    .from(patients)
    .where(and(eq(patients.tenantId, scope.tenantId), eq(patients.id, patientId)))
    .limit(1);

  if (!patient) {
    notFound("Patient not found in the requested Tenant.");
  }

  return patient;
}

export async function loadPractitioner(
  scope: TenantTxScope,
  practitionerId: string
): Promise<PractitionerRow> {
  const [practitioner] = await scope.tx
    .select()
    .from(practitioners)
    .where(and(eq(practitioners.tenantId, scope.tenantId), eq(practitioners.id, practitionerId)))
    .limit(1);

  if (!practitioner) {
    notFound("Practitioner not found in the requested Tenant.");
  }

  return practitioner;
}

export async function loadTokenForEncounter(scope: TenantTxScope, encounterId: string) {
  const [row] = await scope.tx
    .select({
      patientAgeYears: patients.ageYears,
      patientName: patients.fullName,
      practitionerName: practitioners.displayName,
      token: tokens
    })
    .from(tokens)
    .innerJoin(
      patients,
      and(eq(patients.tenantId, scope.tenantId), eq(patients.id, tokens.patientId))
    )
    .innerJoin(
      practitioners,
      and(eq(practitioners.tenantId, scope.tenantId), eq(practitioners.id, tokens.practitionerId))
    )
    .where(and(eq(tokens.tenantId, scope.tenantId), eq(tokens.encounterId, encounterId)))
    .limit(1);

  return row ? toQueueTokenOutput(row) : null;
}
export async function sessionOwnsPractitioner(
  scope: TenantTxScope,
  input: { practitionerId: string; userId: string }
): Promise<boolean> {
  const [practitioner] = await scope.tx
    .select({ id: practitioners.id })
    .from(practitioners)
    .where(
      and(
        eq(practitioners.tenantId, scope.tenantId),
        eq(practitioners.id, input.practitionerId),
        eq(practitioners.userId, input.userId)
      )
    )
    .limit(1);

  return Boolean(practitioner);
}

export async function assertSessionOwnsPractitioner(
  scope: TenantTxScope,
  input: { practitionerId: string; userId: string },
  forbidden: Forbidden
) {
  if (!(await sessionOwnsPractitioner(scope, input))) {
    forbidden();
  }
}

export async function validateFormularyItems(
  scope: TenantTxScope,
  lines: z.infer<typeof PrescriptionSaveInputSchema>["lines"]
) {
  const formularyItemIds = [
    ...new Set(lines.flatMap((line) => (line.formularyItemId ? [line.formularyItemId] : [])))
  ];

  if (formularyItemIds.length === 0) {
    return;
  }

  const activeItems = await scope.tx
    .select({ id: formularyItems.id })
    .from(formularyItems)
    .where(
      and(
        eq(formularyItems.tenantId, scope.tenantId),
        eq(formularyItems.status, "active"),
        inArray(formularyItems.id, formularyItemIds)
      )
    );

  if (activeItems.length !== formularyItemIds.length) {
    notFound("Formulary item not found in the requested Tenant.");
  }
}

export async function replacePrescriptionLines(
  scope: TenantTxScope,
  prescriptionId: string,
  lines: z.infer<typeof PrescriptionSaveInputSchema>["lines"]
) {
  await scope.tx
    .delete(prescriptionLines)
    .where(
      and(
        eq(prescriptionLines.tenantId, scope.tenantId),
        eq(prescriptionLines.prescriptionId, prescriptionId)
      )
    );

  await scope.tx.insert(prescriptionLines).values(
    lines.map((line, index) => {
      return {
        dose: line.dose,
        duration: line.duration,
        formularyItemId: line.formularyItemId ?? null,
        frequency: line.frequency,
        instructions: line.instructions,
        medicationText: line.medicationText,
        prescriptionId,
        sequence: index + 1,
        tenantId: scope.tenantId
      };
    })
  );
}
