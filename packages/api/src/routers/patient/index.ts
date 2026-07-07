import { z } from "zod";

import { STAFF_ROLE } from "@tsu-stack/core/auth";

import { tenantProcedure } from "#@/lib/procedures/factory";
import { withTenantTx } from "#@/lib/tenancy/scoped-db";

import {
  createPatientIdentifier,
  getPatientById,
  PatientByIdInputSchema,
  PatientIdentifierOutputSchema,
  PatientOutputSchema,
  PatientQuickRegisterInputSchema,
  PatientSearchInputSchema,
  PatientUpdateAllergiesInputSchema,
  quickRegisterPatient,
  searchPatientsByPhone,
  updatePatientAllergies
} from "./queries";

const patientStaffRoles = [
  STAFF_ROLE.FRONT_DESK,
  STAFF_ROLE.PRACTITIONER,
  STAFF_ROLE.HOSPITAL_ADMIN
] as const;

export const PatientIdentifierCreateInputSchema = PatientByIdInputSchema.extend({
  system: z.string().trim().min(1).max(100),
  value: z.string().trim().min(1).max(200)
});

export const patientRouter = {
  byId: tenantProcedure(PatientByIdInputSchema, patientStaffRoles)
    .route({
      description: "Get a Patient by ID in the requested Tenant",
      method: "GET"
    })
    .output(PatientOutputSchema.nullable())
    .handler(({ context, input }) =>
      withTenantTx(context, "patient.byId", (scope) => getPatientById(scope, input.id))
    ),
  createIdentifier: tenantProcedure(PatientIdentifierCreateInputSchema, [
    STAFF_ROLE.FRONT_DESK,
    STAFF_ROLE.HOSPITAL_ADMIN
  ])
    .route({
      description: "Attach a system/value identifier to a Patient",
      method: "POST"
    })
    .output(PatientIdentifierOutputSchema)
    .handler(({ context, input }) =>
      withTenantTx(context, "patient.createIdentifier", (scope) =>
        createPatientIdentifier(scope, {
          patientId: input.id,
          system: input.system,
          value: input.value
        })
      )
    ),
  quickRegister: tenantProcedure(PatientQuickRegisterInputSchema, [STAFF_ROLE.FRONT_DESK])
    .route({
      description: "Quick-register a Patient for the front desk flow",
      method: "POST"
    })
    .output(PatientOutputSchema)
    .handler(({ context, input }) =>
      withTenantTx(context, "patient.quickRegister", (scope) => quickRegisterPatient(scope, input))
    ),
  updateAllergies: tenantProcedure(PatientUpdateAllergiesInputSchema, patientStaffRoles)
    .route({
      description: "Update a Patient's allergy note in the requested Tenant",
      method: "POST"
    })
    .output(PatientOutputSchema)
    .handler(({ context, input }) =>
      withTenantTx(context, "patient.updateAllergies", (scope) =>
        updatePatientAllergies(scope, input)
      )
    ),
  searchByPhone: tenantProcedure(PatientSearchInputSchema, patientStaffRoles)
    .route({
      description: "Search Patients by normalized phone number in the requested Tenant",
      method: "GET"
    })
    .output(z.array(PatientOutputSchema))
    .handler(({ context, input }) =>
      withTenantTx(context, "patient.searchByPhone", (scope) =>
        searchPatientsByPhone(scope, input.phone)
      )
    )
};
