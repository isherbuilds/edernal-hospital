import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { and, asc, eq } from "@tsu-stack/db";
import { practitioners } from "@tsu-stack/db/schema";

import { TenantScopeInputSchema } from "#@/lib/tenancy/scope";
import { type TenantTxScope } from "#@/lib/tenancy/scoped-db";

export const PractitionerStatusSchema = z.enum(["active", "inactive"]);

export const PractitionerCreateInputSchema = TenantScopeInputSchema.extend({
  displayName: z.string().min(1).max(200),
  registrationCouncil: z.string().min(1).max(100),
  registrationNumber: z.string().min(1).max(100),
  specialties: z.array(z.string().min(1).max(100)).default([])
});

export type PractitionerCreateInput = z.infer<typeof PractitionerCreateInputSchema>;

export const PractitionerByIdInputSchema = TenantScopeInputSchema.extend({
  id: z.uuid()
});

export const PractitionerOutputSchema = z.object({
  createdAt: z.iso.datetime(),
  displayName: z.string(),
  id: z.uuid(),
  registrationCouncil: z.string(),
  registrationNumber: z.string(),
  specialties: z.array(z.string()),
  status: PractitionerStatusSchema,
  updatedAt: z.iso.datetime(),
  userId: z.string().nullable()
});

export type PractitionerOutput = z.infer<typeof PractitionerOutputSchema>;

type PractitionerRow = typeof practitioners.$inferSelect;

function toPractitionerOutput(row: PractitionerRow): PractitionerOutput {
  return {
    createdAt: row.createdAt.toISOString(),
    displayName: row.displayName,
    id: row.id,
    registrationCouncil: row.registrationCouncil,
    registrationNumber: row.registrationNumber,
    specialties: row.specialties,
    status: PractitionerStatusSchema.parse(row.status),
    updatedAt: row.updatedAt.toISOString(),
    userId: row.userId
  };
}

function isUniqueConstraintError(error: unknown, constraintName: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  return (
    "code" in error &&
    "constraint_name" in error &&
    error.code === "23505" &&
    error.constraint_name === constraintName
  );
}

export async function createPractitioner(
  { audit, tenantId, tx }: TenantTxScope,
  input: PractitionerCreateInput
) {
  const [practitioner] = await tx
    .insert(practitioners)
    .values({
      displayName: input.displayName,
      registrationCouncil: input.registrationCouncil,
      registrationNumber: input.registrationNumber,
      specialties: input.specialties,
      tenantId
    })
    .returning()
    .catch((error: unknown) => {
      if (isUniqueConstraintError(error, "practitioners_tenant_id_registration_unique")) {
        throw new ORPCError("CONFLICT", {
          message: "Practitioner registration already exists for this Tenant.",
          status: 409
        });
      }

      throw error;
    });

  if (!practitioner) {
    throw new Error("Failed to create Practitioner");
  }

  await audit.write({
    action: "create",
    details: {
      registrationCouncil: input.registrationCouncil,
      registrationNumber: input.registrationNumber
    },
    resourceId: practitioner.id,
    resourceType: "practitioner"
  });

  return toPractitionerOutput(practitioner);
}

export async function listPractitioners({ audit, tenantId, tx }: TenantTxScope) {
  const rows = await tx
    .select()
    .from(practitioners)
    .where(eq(practitioners.tenantId, tenantId))
    .orderBy(asc(practitioners.displayName));

  await audit.search({
    resourceType: "practitioner",
    resultCount: rows.length
  });

  return rows.map(toPractitionerOutput);
}

export async function getPractitionerById({ audit, tenantId, tx }: TenantTxScope, id: string) {
  const [practitioner] = await tx
    .select()
    .from(practitioners)
    .where(and(eq(practitioners.tenantId, tenantId), eq(practitioners.id, id)))
    .limit(1);

  await audit.read({
    resourceId: id,
    resourceType: "practitioner",
    resultCount: practitioner ? 1 : 0
  });

  return practitioner ? toPractitionerOutput(practitioner) : null;
}
