import { type z } from "zod";

import { and, eq } from "@tsu-stack/db";
import {
  consultNotes,
  encounters,
  facilities,
  patients,
  prescriptionLines,
  prescriptions,
  practitioners
} from "@tsu-stack/db/schema";

import { type TenantTxScope } from "#@/lib/tenancy/scoped-db";
import { toPatientOutput } from "#@/routers/patient/queries";

import * as consultData from "./data";
import * as consultMappers from "./mappers";
import {
  type ConsultNoteByIdInputSchema,
  type ConsultNoteSaveInputSchema,
  type ConsultWorkspaceInputSchema,
  ConsultWorkspaceOutputSchema,
  type PrescriptionByIdInputSchema,
  PrescriptionPrintOutputSchema,
  type PrescriptionSaveInputSchema,
  type PrescriptionPrintOutput
} from "./schemas";

export * from "./schemas";

export async function getConsultWorkspace(
  scope: TenantTxScope,
  input: z.infer<typeof ConsultWorkspaceInputSchema>,
  userId: string
) {
  const encounter = await consultData.encounterById(scope, input.encounterId);
  if (!encounter) {
    await scope.audit.read({
      details: { scope: "consult_workspace" },
      resourceId: input.encounterId,
      resourceType: "encounter",
      resultCount: 0
    });
    consultMappers.notFound("Encounter not found in the requested Tenant.");
  }

  const patient = await consultData.loadPatient(scope, encounter.patientId);
  const practitioner = await consultData.loadPractitioner(scope, encounter.practitionerId);
  const token = await consultData.loadTokenForEncounter(scope, encounter.id);
  const currentNote = await consultData.currentConsultNoteForEncounter(scope, encounter.id);
  const currentPrescription = await consultData.currentPrescriptionForEncounter(
    scope,
    encounter.id
  );
  const canWriteClinical = await consultData.sessionOwnsPractitioner(scope, {
    practitionerId: encounter.practitionerId,
    userId
  });

  await scope.audit.read({
    details: { scope: "consult_workspace" },
    resourceId: encounter.id,
    resourceType: "encounter",
    resultCount: 1
  });

  return ConsultWorkspaceOutputSchema.parse({
    canWriteClinical,
    consultNote: currentNote ? consultMappers.toConsultNoteOutput(currentNote) : null,
    encounter: consultMappers.toEncounterOutput(encounter),
    patient: toPatientOutput(patient),
    practitioner: consultMappers.toPractitionerOutput(practitioner),
    prescription: currentPrescription
      ? await consultData.prescriptionOutputFor(scope, currentPrescription)
      : null,
    token
  });
}

export async function saveConsultNote(
  scope: TenantTxScope,
  input: z.infer<typeof ConsultNoteSaveInputSchema>,
  userId: string,
  forbidden: consultMappers.Forbidden
) {
  const encounter = await consultData.encounterById(scope, input.encounterId);
  if (!encounter) {
    consultMappers.notFound("Encounter not found in the requested Tenant.");
  }

  await consultData.assertSessionOwnsPractitioner(
    scope,
    { practitionerId: encounter.practitionerId, userId },
    forbidden
  );

  const currentNote = await consultData.currentConsultNoteForEncounter(scope, encounter.id);
  if (!currentNote) {
    const [note] = await scope.tx
      .insert(consultNotes)
      .values({
        ...consultData.noteContentPatch(input),
        encounterId: encounter.id,
        patientId: encounter.patientId,
        practitionerId: encounter.practitionerId,
        status: "preliminary",
        tenantId: scope.tenantId
      })
      .returning()
      .catch(consultData.mapUniqueCurrentNoteError);

    if (!note) {
      throw new Error("Failed to create Consult Note");
    }

    await scope.audit.write({
      action: "create",
      details: { status: note.status },
      resourceId: note.id,
      resourceType: "consult_note"
    });

    return consultMappers.toConsultNoteOutput(note);
  }

  if (currentNote.status !== "preliminary") {
    consultMappers.conflict("Signed note cannot be edited; supersede to correct");
  }

  const [note] = await scope.tx
    .update(consultNotes)
    .set(consultData.noteContentPatch(input))
    .where(
      and(
        eq(consultNotes.tenantId, scope.tenantId),
        eq(consultNotes.id, currentNote.id),
        eq(consultNotes.status, "preliminary")
      )
    )
    .returning();

  if (!note) {
    consultMappers.conflict("Consult note changed. Reload and retry.");
  }

  await scope.audit.write({
    action: "update",
    details: { status: note.status },
    resourceId: note.id,
    resourceType: "consult_note"
  });

  return consultMappers.toConsultNoteOutput(note);
}

export async function signConsultNote(
  scope: TenantTxScope,
  input: z.infer<typeof ConsultNoteByIdInputSchema>,
  userId: string,
  forbidden: consultMappers.Forbidden
) {
  const [currentNote] = await scope.tx
    .select()
    .from(consultNotes)
    .where(and(eq(consultNotes.tenantId, scope.tenantId), eq(consultNotes.id, input.consultNoteId)))
    .limit(1);

  if (!currentNote) {
    consultMappers.notFound("Consult note not found in the requested Tenant.");
  }

  await consultData.assertSessionOwnsPractitioner(
    scope,
    { practitionerId: currentNote.practitionerId, userId },
    forbidden
  );

  const [note] = await scope.tx
    .update(consultNotes)
    .set({ signedAt: new Date(), signedByUserId: userId, status: "signed" })
    .where(
      and(
        eq(consultNotes.tenantId, scope.tenantId),
        eq(consultNotes.id, currentNote.id),
        eq(consultNotes.status, "preliminary")
      )
    )
    .returning();

  if (!note) {
    consultMappers.conflict("Consult note is no longer preliminary. Reload and retry.");
  }

  await scope.audit.write({
    action: "sign",
    details: { status: note.status },
    resourceId: note.id,
    resourceType: "consult_note"
  });

  return consultMappers.toConsultNoteOutput(note);
}

export async function supersedeConsultNote(
  scope: TenantTxScope,
  input: z.infer<typeof ConsultNoteByIdInputSchema>,
  userId: string,
  forbidden: consultMappers.Forbidden
) {
  const [currentNote] = await scope.tx
    .select()
    .from(consultNotes)
    .where(and(eq(consultNotes.tenantId, scope.tenantId), eq(consultNotes.id, input.consultNoteId)))
    .limit(1);

  if (!currentNote) {
    consultMappers.notFound("Consult note not found in the requested Tenant.");
  }
  consultData.assertSupersedable(currentNote.status, {
    alreadySuperseded: "Consult note has already been superseded.",
    notSigned: "Only signed notes can be superseded"
  });

  await consultData.assertSessionOwnsPractitioner(
    scope,
    { practitionerId: currentNote.practitionerId, userId },
    forbidden
  );

  const [oldNote] = await scope.tx
    .update(consultNotes)
    .set({ status: "superseded" })
    .where(
      and(
        eq(consultNotes.tenantId, scope.tenantId),
        eq(consultNotes.id, currentNote.id),
        eq(consultNotes.status, "signed")
      )
    )
    .returning();

  if (!oldNote) {
    consultMappers.conflict("Consult note changed. Reload and retry.");
  }

  const [newNote] = await scope.tx
    .insert(consultNotes)
    .values({
      advice: oldNote.advice,
      complaints: oldNote.complaints,
      diagnosisCode: oldNote.diagnosisCode,
      diagnosisText: oldNote.diagnosisText,
      encounterId: oldNote.encounterId,
      findings: oldNote.findings,
      followUp: oldNote.followUp,
      patientId: oldNote.patientId,
      practitionerId: oldNote.practitionerId,
      status: "preliminary",
      supersedesConsultNoteId: oldNote.id,
      tenantId: scope.tenantId,
      vitals: oldNote.vitals
    })
    .returning()
    .catch(consultData.mapUniqueCurrentNoteError);

  if (!newNote) {
    throw new Error("Failed to create replacement Consult Note");
  }

  await scope.audit.write({
    action: "update",
    details: { status: oldNote.status },
    resourceId: oldNote.id,
    resourceType: "consult_note"
  });
  await scope.audit.write({
    action: "create",
    details: { status: newNote.status },
    resourceId: newNote.id,
    resourceType: "consult_note"
  });

  return consultMappers.toConsultNoteOutput(newNote);
}

export async function saveEncounterPrescription(
  scope: TenantTxScope,
  input: z.infer<typeof PrescriptionSaveInputSchema>,
  userId: string,
  forbidden: consultMappers.Forbidden
) {
  const encounter = await consultData.encounterById(scope, input.encounterId);
  if (!encounter) {
    consultMappers.notFound("Encounter not found in the requested Tenant.");
  }

  await consultData.assertSessionOwnsPractitioner(
    scope,
    { practitionerId: encounter.practitionerId, userId },
    forbidden
  );

  await consultData.validateFormularyItems(scope, input.lines);

  const currentPrescription = await consultData.currentPrescriptionForEncounter(
    scope,
    encounter.id
  );
  if (!currentPrescription) {
    const [prescription] = await scope.tx
      .insert(prescriptions)
      .values({
        encounterId: encounter.id,
        patientId: encounter.patientId,
        practitionerId: encounter.practitionerId,
        status: "preliminary",
        tenantId: scope.tenantId
      })
      .returning()
      .catch(consultData.mapUniqueCurrentPrescriptionError);

    if (!prescription) {
      throw new Error("Failed to create Prescription");
    }

    await consultData.replacePrescriptionLines(scope, prescription.id, input.lines);

    await scope.audit.write({
      action: "create",
      details: { lineCount: input.lines.length, status: prescription.status },
      resourceId: prescription.id,
      resourceType: "prescription"
    });

    return consultData.prescriptionOutputFor(scope, prescription);
  }

  if (currentPrescription.status !== "preliminary") {
    consultMappers.conflict("Signed prescription cannot be edited; supersede to correct");
  }

  const [prescription] = await scope.tx
    .update(prescriptions)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(prescriptions.tenantId, scope.tenantId),
        eq(prescriptions.id, currentPrescription.id),
        eq(prescriptions.status, "preliminary")
      )
    )
    .returning();

  if (!prescription) {
    consultMappers.conflict("Prescription changed. Reload and retry.");
  }

  await consultData.replacePrescriptionLines(scope, prescription.id, input.lines);

  await scope.audit.write({
    action: "update",
    details: { lineCount: input.lines.length, status: prescription.status },
    resourceId: prescription.id,
    resourceType: "prescription"
  });

  return consultData.prescriptionOutputFor(scope, prescription);
}

export async function signEncounterPrescription(
  scope: TenantTxScope,
  input: z.infer<typeof PrescriptionByIdInputSchema>,
  userId: string,
  forbidden: consultMappers.Forbidden
) {
  const [currentPrescription] = await scope.tx
    .select()
    .from(prescriptions)
    .where(
      and(eq(prescriptions.tenantId, scope.tenantId), eq(prescriptions.id, input.prescriptionId))
    )
    .limit(1);

  if (!currentPrescription) {
    consultMappers.notFound("Prescription not found in the requested Tenant.");
  }

  await consultData.assertSessionOwnsPractitioner(
    scope,
    { practitionerId: currentPrescription.practitionerId, userId },
    forbidden
  );

  const [prescription] = await scope.tx
    .update(prescriptions)
    .set({ signedAt: new Date(), signedByUserId: userId, status: "signed" })
    .where(
      and(
        eq(prescriptions.tenantId, scope.tenantId),
        eq(prescriptions.id, currentPrescription.id),
        eq(prescriptions.status, "preliminary")
      )
    )
    .returning();

  if (!prescription) {
    consultMappers.conflict("Prescription is no longer preliminary. Reload and retry.");
  }

  await scope.audit.write({
    action: "sign",
    details: { status: prescription.status },
    resourceId: prescription.id,
    resourceType: "prescription"
  });

  return consultData.prescriptionOutputFor(scope, prescription);
}

export async function supersedeEncounterPrescription(
  scope: TenantTxScope,
  input: z.infer<typeof PrescriptionByIdInputSchema>,
  userId: string,
  forbidden: consultMappers.Forbidden
) {
  const [currentPrescription] = await scope.tx
    .select()
    .from(prescriptions)
    .where(
      and(eq(prescriptions.tenantId, scope.tenantId), eq(prescriptions.id, input.prescriptionId))
    )
    .limit(1);

  if (!currentPrescription) {
    consultMappers.notFound("Prescription not found in the requested Tenant.");
  }
  consultData.assertSupersedable(currentPrescription.status, {
    alreadySuperseded: "Prescription has already been superseded.",
    notSigned: "Only signed prescriptions can be superseded"
  });

  await consultData.assertSessionOwnsPractitioner(
    scope,
    { practitionerId: currentPrescription.practitionerId, userId },
    forbidden
  );

  const oldLines = await consultData.prescriptionLinesFor(scope, currentPrescription.id);
  const [oldPrescription] = await scope.tx
    .update(prescriptions)
    .set({ status: "superseded" })
    .where(
      and(
        eq(prescriptions.tenantId, scope.tenantId),
        eq(prescriptions.id, currentPrescription.id),
        eq(prescriptions.status, "signed")
      )
    )
    .returning();

  if (!oldPrescription) {
    consultMappers.conflict("Prescription changed. Reload and retry.");
  }

  const [newPrescription] = await scope.tx
    .insert(prescriptions)
    .values({
      encounterId: oldPrescription.encounterId,
      patientId: oldPrescription.patientId,
      practitionerId: oldPrescription.practitionerId,
      status: "preliminary",
      supersedesPrescriptionId: oldPrescription.id,
      tenantId: scope.tenantId
    })
    .returning()
    .catch(consultData.mapUniqueCurrentPrescriptionError);

  if (!newPrescription) {
    throw new Error("Failed to create replacement Prescription");
  }

  if (oldLines.length > 0) {
    await scope.tx.insert(prescriptionLines).values(
      oldLines.map((line) => {
        return {
          dose: line.dose,
          duration: line.duration,
          formularyItemId: line.formularyItemId,
          frequency: line.frequency,
          instructions: line.instructions,
          medicationText: line.medicationText,
          prescriptionId: newPrescription.id,
          sequence: line.sequence,
          tenantId: scope.tenantId
        };
      })
    );
  }

  await scope.audit.write({
    action: "update",
    details: { lineCount: oldLines.length, status: oldPrescription.status },
    resourceId: oldPrescription.id,
    resourceType: "prescription"
  });
  await scope.audit.write({
    action: "create",
    details: { lineCount: oldLines.length, status: newPrescription.status },
    resourceId: newPrescription.id,
    resourceType: "prescription"
  });

  return consultData.prescriptionOutputFor(scope, newPrescription);
}

export async function printEncounterPrescription(
  scope: TenantTxScope,
  input: z.infer<typeof PrescriptionByIdInputSchema>,
  tenantProfile: consultMappers.TenantProfileForPrint
): Promise<PrescriptionPrintOutput> {
  const [row] = await scope.tx
    .select({
      encounter: encounters,
      facility: facilities,
      patient: patients,
      practitioner: practitioners,
      prescription: prescriptions
    })
    .from(prescriptions)
    .innerJoin(
      encounters,
      and(eq(encounters.tenantId, scope.tenantId), eq(encounters.id, prescriptions.encounterId))
    )
    .innerJoin(
      patients,
      and(eq(patients.tenantId, scope.tenantId), eq(patients.id, prescriptions.patientId))
    )
    .innerJoin(
      practitioners,
      and(
        eq(practitioners.tenantId, scope.tenantId),
        eq(practitioners.id, prescriptions.practitionerId)
      )
    )
    .innerJoin(
      facilities,
      and(eq(facilities.tenantId, scope.tenantId), eq(facilities.id, encounters.facilityId))
    )
    .where(
      and(eq(prescriptions.tenantId, scope.tenantId), eq(prescriptions.id, input.prescriptionId))
    )
    .limit(1);

  if (!row) {
    consultMappers.notFound("Prescription not found in the requested Tenant.");
  }
  if (row.prescription.status !== "signed") {
    consultMappers.badRequest("Only signed prescriptions can be printed");
  }
  if (!row.prescription.signedAt) {
    consultMappers.conflict("Signed prescription is missing signed metadata. Reload and retry.");
  }

  const lines = await consultData.prescriptionLinesFor(scope, row.prescription.id);

  await scope.audit.print({
    details: { lineCount: lines.length, status: row.prescription.status },
    resourceId: row.prescription.id,
    resourceType: "prescription"
  });

  return PrescriptionPrintOutputSchema.parse({
    encounter: { id: row.encounter.id },
    facility: {
      address: row.facility.address,
      gstin: row.facility.gstin,
      name: row.facility.name
    },
    patient: toPatientOutput(row.patient),
    practitioner: consultMappers.toPractitionerOutput(row.practitioner),
    prescription: {
      id: row.prescription.id,
      lines: lines.map(consultMappers.toPrescriptionLineOutput),
      signedAt: row.prescription.signedAt.toISOString(),
      status: row.prescription.status
    },
    tenant: {
      displayName: tenantProfile.displayName,
      legalName: tenantProfile.legalName
    }
  });
}
