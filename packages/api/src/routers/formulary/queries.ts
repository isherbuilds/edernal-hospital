import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { TenantResourceStatusSchema } from "@tsu-stack/core/tenancy";
import { and, asc, eq, ilike } from "@tsu-stack/db";
import { formularyItems } from "@tsu-stack/db/schema";

import { type CatalogField, planCatalogUpdate, throwIfDuplicate } from "#@/lib/catalog";
import { TenantScopeInputSchema } from "#@/lib/tenancy/scope";
import { type TenantTxScope } from "#@/lib/tenancy/scoped-db";

const FORMULARY_UNIQUE_CONSTRAINT = "formulary_items_tenant_id_name_strength_form_unique";
const FORMULARY_DUPLICATE_MESSAGE =
  "A Formulary item with this name, strength, and form already exists.";

export const FormularySearchInputSchema = TenantScopeInputSchema.extend({
  query: z.string().trim().max(200).optional()
});

export const FormularyListInputSchema = TenantScopeInputSchema;

export const FormularyCreateInputSchema = TenantScopeInputSchema.extend({
  defaultDoseText: z.string().trim().max(300).default(""),
  form: z.string().trim().max(300).default(""),
  name: z.string().trim().min(1).max(300),
  strength: z.string().trim().max(300).default("")
});

export const FormularyUpdateInputSchema = TenantScopeInputSchema.extend({
  defaultDoseText: z.string().trim().max(300).optional(),
  form: z.string().trim().max(300).optional(),
  formularyItemId: z.uuid(),
  name: z.string().trim().min(1).max(300).optional(),
  status: TenantResourceStatusSchema.optional(),
  strength: z.string().trim().max(300).optional()
});

export const FormularyItemOutputSchema = z.object({
  defaultDoseText: z.string(),
  form: z.string(),
  id: z.uuid(),
  name: z.string(),
  status: TenantResourceStatusSchema,
  strength: z.string()
});

export type FormularyItemOutput = z.infer<typeof FormularyItemOutputSchema>;

type FormularyItemRow = typeof formularyItems.$inferSelect;

function toFormularyItemOutput(row: FormularyItemRow): FormularyItemOutput {
  return FormularyItemOutputSchema.parse({
    defaultDoseText: row.defaultDoseText,
    form: row.form,
    id: row.id,
    name: row.name,
    status: row.status,
    strength: row.strength
  });
}

const FORMULARY_FIELDS: ReadonlyArray<CatalogField<FormularyItemRow>> = [
  { column: formularyItems.defaultDoseText, key: "defaultDoseText" },
  { column: formularyItems.form, key: "form" },
  { column: formularyItems.name, key: "name" },
  { column: formularyItems.status, key: "status" },
  { column: formularyItems.strength, key: "strength" }
];

export async function searchFormularyItems(
  scope: TenantTxScope,
  input: z.infer<typeof FormularySearchInputSchema>
) {
  const filters = [
    eq(formularyItems.tenantId, scope.tenantId),
    eq(formularyItems.status, "active")
  ];
  if (input.query) {
    filters.push(ilike(formularyItems.name, `%${input.query}%`));
  }

  const rows = await scope.tx
    .select()
    .from(formularyItems)
    .where(and(...filters))
    .orderBy(asc(formularyItems.name))
    .limit(20);

  await scope.audit.search({
    details: { resultCount: rows.length },
    resourceType: "formulary_item",
    resultCount: rows.length
  });

  return rows.map(toFormularyItemOutput);
}

export async function listFormularyItems(scope: TenantTxScope) {
  const rows = await scope.tx
    .select()
    .from(formularyItems)
    .where(eq(formularyItems.tenantId, scope.tenantId))
    .orderBy(asc(formularyItems.name));

  await scope.audit.search({
    details: { resultCount: rows.length },
    resourceType: "formulary_item",
    resultCount: rows.length
  });

  return rows.map(toFormularyItemOutput);
}

export async function createFormularyItem(
  scope: TenantTxScope,
  input: z.infer<typeof FormularyCreateInputSchema>
) {
  const [row] = await scope.tx
    .insert(formularyItems)
    .values({
      defaultDoseText: input.defaultDoseText,
      form: input.form,
      name: input.name,
      strength: input.strength,
      tenantId: scope.tenantId
    })
    .returning()
    .catch((error: unknown) =>
      throwIfDuplicate(FORMULARY_UNIQUE_CONSTRAINT, FORMULARY_DUPLICATE_MESSAGE, error)
    );

  if (!row) {
    throw new Error("Failed to create Formulary item");
  }

  await scope.audit.write({
    action: "create",
    details: { status: row.status },
    resourceId: row.id,
    resourceType: "formulary_item"
  });

  return toFormularyItemOutput(row);
}

export async function updateFormularyItem(
  scope: TenantTxScope,
  input: z.infer<typeof FormularyUpdateInputSchema>
) {
  const baseGuard = [
    eq(formularyItems.tenantId, scope.tenantId),
    eq(formularyItems.id, input.formularyItemId)
  ];

  const [current] = await scope.tx
    .select()
    .from(formularyItems)
    .where(and(...baseGuard))
    .limit(1);

  if (!current) {
    throw new ORPCError("NOT_FOUND", {
      message: "Formulary item not found in the requested Tenant.",
      status: 404
    });
  }

  const { guard, patch, updatedFieldCount } = planCatalogUpdate(
    FORMULARY_FIELDS,
    current,
    input,
    baseGuard
  );

  if (updatedFieldCount === 0) {
    await scope.audit.write({
      action: "update",
      details: { status: current.status, updatedFieldCount },
      resourceId: current.id,
      resourceType: "formulary_item"
    });

    return toFormularyItemOutput(current);
  }

  const [row] = await scope.tx
    .update(formularyItems)
    .set(patch as Partial<typeof formularyItems.$inferInsert>)
    .where(and(...guard))
    .returning()
    .catch((error: unknown) =>
      throwIfDuplicate(FORMULARY_UNIQUE_CONSTRAINT, FORMULARY_DUPLICATE_MESSAGE, error)
    );

  if (!row) {
    throw new ORPCError("CONFLICT", {
      message: "Formulary item changed. Reload and retry.",
      status: 409
    });
  }

  await scope.audit.write({
    action: "update",
    details: { status: row.status, updatedFieldCount },
    resourceId: row.id,
    resourceType: "formulary_item"
  });

  return toFormularyItemOutput(row);
}
