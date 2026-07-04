import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { and, asc, eq } from "@tsu-stack/db";
import { facilities } from "@tsu-stack/db/schema";

import { isUniqueConstraintError } from "#@/lib/db-errors";
import { TenantScopeInputSchema } from "#@/lib/tenancy/scope";
import { type TenantTxScope } from "#@/lib/tenancy/scoped-db";

export const FacilityAddressSchema = z
  .object({
    city: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
    line1: z.string().min(1).optional(),
    line2: z.string().min(1).optional(),
    postalCode: z.string().min(1).optional(),
    state: z.string().min(1).optional()
  })
  .default({});

export const FacilityStatusSchema = z.enum(["active", "inactive"]);

export const FacilityCreateInputSchema = TenantScopeInputSchema.extend({
  address: FacilityAddressSchema.optional(),
  code: z.string().min(1).max(32),
  gstin: z.string().min(1).max(32).optional(),
  name: z.string().min(1).max(200),
  timezone: z.string().min(1).default("Asia/Kolkata")
});

export type FacilityCreateInput = z.infer<typeof FacilityCreateInputSchema>;

export const FacilityByIdInputSchema = TenantScopeInputSchema.extend({
  id: z.uuid()
});

export const FacilityOutputSchema = z.object({
  address: FacilityAddressSchema,
  code: z.string(),
  createdAt: z.iso.datetime(),
  gstin: z.string().nullable(),
  id: z.uuid(),
  name: z.string(),
  status: FacilityStatusSchema,
  timezone: z.string(),
  updatedAt: z.iso.datetime()
});

export type FacilityOutput = z.infer<typeof FacilityOutputSchema>;
export const FacilityCreateOutputSchema = FacilityOutputSchema;
export const FacilityStaffOutputSchema = FacilityOutputSchema.omit({ gstin: true });
export type FacilityStaffOutput = z.infer<typeof FacilityStaffOutputSchema>;

type FacilityRow = typeof facilities.$inferSelect;

function toFacilityOutput(row: FacilityRow): FacilityOutput {
  return {
    address: FacilityAddressSchema.parse(row.address),
    code: row.code,
    createdAt: row.createdAt.toISOString(),
    gstin: row.gstin,
    id: row.id,
    name: row.name,
    status: FacilityStatusSchema.parse(row.status),
    timezone: row.timezone,
    updatedAt: row.updatedAt.toISOString()
  };
}

function toFacilityStaffOutput(row: FacilityRow): FacilityStaffOutput {
  return FacilityStaffOutputSchema.parse(toFacilityOutput(row));
}

export async function createFacility(
  { audit, tenantId, tx }: TenantTxScope,
  input: FacilityCreateInput
) {
  const [facility] = await tx
    .insert(facilities)
    .values({
      address: input.address ?? {},
      code: input.code,
      gstin: input.gstin,
      name: input.name,
      tenantId,
      timezone: input.timezone
    })
    .returning()
    .catch((error: unknown) => {
      if (isUniqueConstraintError(error, "facilities_tenant_id_code_unique")) {
        throw new ORPCError("CONFLICT", {
          message: "Facility code already exists for this Tenant.",
          status: 409
        });
      }

      throw error;
    });

  if (!facility) {
    throw new Error("Failed to create Facility");
  }

  await audit.write({
    action: "create",
    details: {
      code: input.code
    },
    resourceId: facility.id,
    resourceType: "facility"
  });

  return toFacilityOutput(facility);
}

export async function listFacilities({ audit, tenantId, tx }: TenantTxScope) {
  const rows = await tx
    .select()
    .from(facilities)
    .where(eq(facilities.tenantId, tenantId))
    .orderBy(asc(facilities.name));

  await audit.search({
    resourceType: "facility",
    resultCount: rows.length
  });

  return rows.map(toFacilityStaffOutput);
}

export async function getFacilityById({ audit, tenantId, tx }: TenantTxScope, id: string) {
  const [facility] = await tx
    .select()
    .from(facilities)
    .where(and(eq(facilities.tenantId, tenantId), eq(facilities.id, id)))
    .limit(1);

  await audit.read({
    resourceId: id,
    resourceType: "facility",
    resultCount: facility ? 1 : 0
  });

  return facility ? toFacilityStaffOutput(facility) : null;
}
