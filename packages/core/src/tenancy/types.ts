import { z } from "zod";

import { TENANT_RESOURCE_STATUSES } from "#@/tenancy/constants";

export const TenantResourceStatusSchema = z.enum(TENANT_RESOURCE_STATUSES);

export type TenantResourceStatus = z.infer<typeof TenantResourceStatusSchema>;
