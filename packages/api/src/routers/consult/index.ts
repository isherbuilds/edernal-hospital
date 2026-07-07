import { STAFF_ROLE } from "@tsu-stack/core/auth";

import { tenantProcedure } from "#@/lib/procedures/factory";
import { withTenantTx } from "#@/lib/tenancy/scoped-db";

import {
  ConsultNoteByIdInputSchema,
  ConsultNoteOutputSchema,
  ConsultNoteSaveInputSchema,
  ConsultWorkspaceInputSchema,
  ConsultWorkspaceOutputSchema,
  getConsultWorkspace,
  PrescriptionByIdInputSchema,
  PrescriptionOutputSchema,
  PrescriptionPrintOutputSchema,
  PrescriptionSaveInputSchema,
  printEncounterPrescription,
  saveConsultNote,
  saveEncounterPrescription,
  signConsultNote,
  signEncounterPrescription,
  supersedeConsultNote,
  supersedeEncounterPrescription
} from "./queries";

const consultReaderRoles = [STAFF_ROLE.PRACTITIONER, STAFF_ROLE.HOSPITAL_ADMIN] as const;
const consultWriterRoles = [STAFF_ROLE.PRACTITIONER] as const;

export const consultRouter = {
  printPrescription: tenantProcedure(PrescriptionByIdInputSchema, consultReaderRoles)
    .route({
      description: "Print a signed Prescription for the doctor loop",
      method: "GET"
    })
    .output(PrescriptionPrintOutputSchema)
    .handler(({ context, input }) =>
      withTenantTx(context, "consult.printPrescription", (scope) =>
        printEncounterPrescription(scope, input, context.tenant.profile)
      )
    ),
  saveNote: tenantProcedure(ConsultNoteSaveInputSchema, consultWriterRoles)
    .route({
      description: "Save the current preliminary Consult Note for an Encounter",
      method: "POST"
    })
    .output(ConsultNoteOutputSchema)
    .handler(({ context, errors, input }) =>
      withTenantTx(context, "consult.saveNote", (scope) =>
        saveConsultNote(scope, input, context.session.user.id, () => {
          throw errors.FORBIDDEN();
        })
      )
    ),
  savePrescription: tenantProcedure(PrescriptionSaveInputSchema, consultWriterRoles)
    .route({
      description: "Save the current preliminary Prescription for an Encounter",
      method: "POST"
    })
    .output(PrescriptionOutputSchema)
    .handler(({ context, errors, input }) =>
      withTenantTx(context, "consult.savePrescription", (scope) =>
        saveEncounterPrescription(scope, input, context.session.user.id, () => {
          throw errors.FORBIDDEN();
        })
      )
    ),
  signNote: tenantProcedure(ConsultNoteByIdInputSchema, consultWriterRoles)
    .route({
      description: "Sign a preliminary Consult Note",
      method: "POST"
    })
    .output(ConsultNoteOutputSchema)
    .handler(({ context, errors, input }) =>
      withTenantTx(context, "consult.signNote", (scope) =>
        signConsultNote(scope, input, context.session.user.id, () => {
          throw errors.FORBIDDEN();
        })
      )
    ),
  signPrescription: tenantProcedure(PrescriptionByIdInputSchema, consultWriterRoles)
    .route({
      description: "Sign a preliminary Prescription",
      method: "POST"
    })
    .output(PrescriptionOutputSchema)
    .handler(({ context, errors, input }) =>
      withTenantTx(context, "consult.signPrescription", (scope) =>
        signEncounterPrescription(scope, input, context.session.user.id, () => {
          throw errors.FORBIDDEN();
        })
      )
    ),
  supersedeNote: tenantProcedure(ConsultNoteByIdInputSchema, consultWriterRoles)
    .route({
      description: "Supersede a signed Consult Note with a preliminary copy",
      method: "POST"
    })
    .output(ConsultNoteOutputSchema)
    .handler(({ context, errors, input }) =>
      withTenantTx(context, "consult.supersedeNote", (scope) =>
        supersedeConsultNote(scope, input, context.session.user.id, () => {
          throw errors.FORBIDDEN();
        })
      )
    ),
  supersedePrescription: tenantProcedure(PrescriptionByIdInputSchema, consultWriterRoles)
    .route({
      description: "Supersede a signed Prescription with a preliminary copy",
      method: "POST"
    })
    .output(PrescriptionOutputSchema)
    .handler(({ context, errors, input }) =>
      withTenantTx(context, "consult.supersedePrescription", (scope) =>
        supersedeEncounterPrescription(scope, input, context.session.user.id, () => {
          throw errors.FORBIDDEN();
        })
      )
    ),
  workspace: tenantProcedure(ConsultWorkspaceInputSchema, consultReaderRoles)
    .route({
      description: "Load the doctor consult workspace for an Encounter",
      method: "GET"
    })
    .output(ConsultWorkspaceOutputSchema)
    .handler(({ context, input }) =>
      withTenantTx(context, "consult.workspace", (scope) =>
        getConsultWorkspace(scope, input, context.session.user.id)
      )
    )
};
