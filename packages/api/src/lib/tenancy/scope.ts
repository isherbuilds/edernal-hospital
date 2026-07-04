import { z } from "zod";

export const TenantScopeInputSchema = z.object({
  tenantId: z.string().min(1)
});

export type TenantScopedInput = z.infer<typeof TenantScopeInputSchema>;
