import { useState } from "react";

import { authClient } from "@tsu-stack/auth/react/auth-client";

import { useGetTenantMembershipQuery } from "@/shared/api/get-tenant-membership.query";

export function useTenantGate() {
  const organizations = authClient.useListOrganizations();
  const organizationOptions = organizations.data ?? [];
  const [selectedTenantId, setTenantId] = useState("");
  const tenantId = selectedTenantId || organizationOptions[0]?.id || "";
  const tenantReady = tenantId.trim().length > 0;
  const membership = useGetTenantMembershipQuery({ tenantId }, { enabled: tenantReady });
  const roles = membership.data?.roles ?? [];

  return {
    membership,
    organizationOptions,
    organizationsPending: organizations.isPending,
    roles,
    setTenantId,
    tenantId,
    tenantReady
  };
}
