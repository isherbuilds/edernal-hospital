import { z } from "zod";

import { STAFF_ROLES, StaffRoleSchema } from "@tsu-stack/core/auth";

import { tenantProcedure } from "#@/lib/procedures/factory";
import { TenantScopeInputSchema } from "#@/lib/tenancy/scope";

const TenantMembershipOutputSchema = z.object({
  displayName: z.string(),
  roles: z.array(StaffRoleSchema),
  tenantId: z.string()
});

export const tenantRouter = {
  membership: tenantProcedure(TenantScopeInputSchema, STAFF_ROLES)
    .route({
      description: "Return the caller's Tenant membership context",
      method: "GET"
    })
    .output(TenantMembershipOutputSchema)
    .handler(({ context }) => {
      return {
        displayName: context.tenant.profile.displayName ?? context.tenant.profile.name,
        roles: context.tenant.roles,
        tenantId: context.tenant.id
      };
    })
};
