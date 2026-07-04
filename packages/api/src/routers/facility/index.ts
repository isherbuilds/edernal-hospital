import { z } from "zod";

import { STAFF_ROLE, STAFF_ROLES } from "@tsu-stack/core/auth";

import { tenantProcedure } from "#@/lib/procedures/factory";
import { TenantScopeInputSchema } from "#@/lib/tenancy/scope";
import { withTenantTx } from "#@/lib/tenancy/scoped-db";

import {
  createFacility,
  FacilityByIdInputSchema,
  FacilityCreateInputSchema,
  FacilityCreateOutputSchema,
  FacilityStaffOutputSchema,
  getFacilityById,
  listFacilities
} from "./queries";

export const facilityRouter = {
  byId: tenantProcedure(FacilityByIdInputSchema, STAFF_ROLES)
    .route({
      description: "Get a Facility by ID in the requested Tenant",
      method: "GET"
    })
    .output(FacilityStaffOutputSchema.nullable())
    .handler(({ context, input }) =>
      withTenantTx(context, "facility.byId", (scope) => getFacilityById(scope, input.id))
    ),
  create: tenantProcedure(FacilityCreateInputSchema, [STAFF_ROLE.HOSPITAL_ADMIN])
    .route({
      description: "Create a Facility in the requested Tenant",
      method: "POST"
    })
    .output(FacilityCreateOutputSchema)
    .handler(({ context, input }) =>
      withTenantTx(context, "facility.create", (scope) => createFacility(scope, input))
    ),
  list: tenantProcedure(TenantScopeInputSchema, STAFF_ROLES)
    .route({
      description: "List Facilities in the requested Tenant",
      method: "GET"
    })
    .output(z.array(FacilityStaffOutputSchema))
    .handler(({ context }) => withTenantTx(context, "facility.list", listFacilities))
};
