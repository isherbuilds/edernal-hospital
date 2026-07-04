import { z } from "zod";

import { STAFF_ROLE, STAFF_ROLES } from "@tsu-stack/core/auth";

import { tenantProcedure } from "#@/lib/procedures/factory";
import { TenantScopeInputSchema } from "#@/lib/tenancy/scope";
import { withTenantTx } from "#@/lib/tenancy/scoped-db";

import {
  createPractitioner,
  getPractitionerById,
  listPractitioners,
  PractitionerByIdInputSchema,
  PractitionerCreateInputSchema,
  PractitionerOutputSchema
} from "./queries";

export const practitionerRouter = {
  byId: tenantProcedure(PractitionerByIdInputSchema, STAFF_ROLES)
    .route({
      description: "Get a Practitioner by ID in the requested Tenant",
      method: "GET"
    })
    .output(PractitionerOutputSchema.nullable())
    .handler(({ context, input }) =>
      withTenantTx(context, "practitioner.byId", (scope) => getPractitionerById(scope, input.id))
    ),
  create: tenantProcedure(PractitionerCreateInputSchema, [STAFF_ROLE.HOSPITAL_ADMIN])
    .route({
      description: "Create a Practitioner in the requested Tenant",
      method: "POST"
    })
    .output(PractitionerOutputSchema)
    .handler(({ context, input }) =>
      withTenantTx(context, "practitioner.create", (scope) => createPractitioner(scope, input))
    ),
  list: tenantProcedure(TenantScopeInputSchema, STAFF_ROLES)
    .route({
      description: "List Practitioners in the requested Tenant",
      method: "GET"
    })
    .output(z.array(PractitionerOutputSchema))
    .handler(({ context }) => withTenantTx(context, "practitioner.list", listPractitioners))
};
