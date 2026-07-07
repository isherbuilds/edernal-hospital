import { useQuery } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type TenantMembershipOutput } from "@tsu-stack/api/routers/tenant/index";

export type TenantMembershipQueryInput = {
  tenantId: string;
};

export type TenantMembershipQueryResult = TenantMembershipOutput;

export const tenantMembershipQueryKeys = {
  byTenant(tenantId: string) {
    return orpc.tenant.membership.key({ input: { tenantId } });
  }
};

export function getTenantMembershipQueryOptions(input: TenantMembershipQueryInput) {
  return orpc.tenant.membership.queryOptions({ input });
}

export function useGetTenantMembershipQuery(
  input: TenantMembershipQueryInput,
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    ...getTenantMembershipQueryOptions(input),
    enabled: options.enabled ?? true
  });
}
