import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { NOTE_TEXT_LIMIT } from "@tsu-stack/core/clinical";
import { TenantResourceStatusSchema } from "@tsu-stack/core/tenancy";
import { and, asc, eq } from "@tsu-stack/db";
import { noteTemplates } from "@tsu-stack/db/schema";

import { type CatalogField, planCatalogUpdate, throwIfDuplicate } from "#@/lib/catalog";
import { TenantScopeInputSchema } from "#@/lib/tenancy/scope";
import { type TenantTxScope } from "#@/lib/tenancy/scoped-db";

const NOTE_TEMPLATE_UNIQUE_CONSTRAINT = "note_templates_tenant_id_name_unique";
const NOTE_TEMPLATE_DUPLICATE_MESSAGE = "A Note Template with this name already exists.";

const NoteTemplateContentCreateInputSchema = {
  advice: z.string().trim().max(NOTE_TEXT_LIMIT).default(""),
  complaints: z.string().trim().max(NOTE_TEXT_LIMIT).default(""),
  diagnosisText: z.string().trim().max(NOTE_TEXT_LIMIT).default(""),
  findings: z.string().trim().max(NOTE_TEXT_LIMIT).default(""),
  followUp: z.string().trim().max(NOTE_TEXT_LIMIT).default("")
} as const;

const NoteTemplateContentUpdateInputSchema = {
  advice: z.string().trim().max(NOTE_TEXT_LIMIT).optional(),
  complaints: z.string().trim().max(NOTE_TEXT_LIMIT).optional(),
  diagnosisText: z.string().trim().max(NOTE_TEXT_LIMIT).optional(),
  findings: z.string().trim().max(NOTE_TEXT_LIMIT).optional(),
  followUp: z.string().trim().max(NOTE_TEXT_LIMIT).optional()
} as const;

export const NoteTemplateListInputSchema = TenantScopeInputSchema.extend({
  includeInactive: z.boolean().default(false)
});

export const NoteTemplateCreateInputSchema = TenantScopeInputSchema.extend({
  ...NoteTemplateContentCreateInputSchema,
  name: z.string().trim().min(1).max(200),
  specialty: z.string().trim().max(200).optional()
});

export const NoteTemplateUpdateInputSchema = TenantScopeInputSchema.extend({
  ...NoteTemplateContentUpdateInputSchema,
  name: z.string().trim().min(1).max(200).optional(),
  noteTemplateId: z.uuid(),
  specialty: z.string().trim().max(200).optional(),
  status: TenantResourceStatusSchema.optional()
});

export const NoteTemplateOutputSchema = z.object({
  advice: z.string(),
  complaints: z.string(),
  diagnosisText: z.string(),
  findings: z.string(),
  followUp: z.string(),
  id: z.uuid(),
  name: z.string(),
  specialty: z.string().nullable(),
  status: TenantResourceStatusSchema
});

export type NoteTemplateOutput = z.infer<typeof NoteTemplateOutputSchema>;

type NoteTemplateRow = typeof noteTemplates.$inferSelect;

function toNoteTemplateOutput(row: NoteTemplateRow): NoteTemplateOutput {
  return NoteTemplateOutputSchema.parse({
    advice: row.advice,
    complaints: row.complaints,
    diagnosisText: row.diagnosisText,
    findings: row.findings,
    followUp: row.followUp,
    id: row.id,
    name: row.name,
    specialty: row.specialty,
    status: row.status
  });
}

const emptyToNull = (value: string) => (value.length > 0 ? value : null);

const NOTE_TEMPLATE_FIELDS: ReadonlyArray<CatalogField<NoteTemplateRow>> = [
  { column: noteTemplates.advice, key: "advice" },
  { column: noteTemplates.complaints, key: "complaints" },
  { column: noteTemplates.diagnosisText, key: "diagnosisText" },
  { column: noteTemplates.findings, key: "findings" },
  { column: noteTemplates.followUp, key: "followUp" },
  { column: noteTemplates.name, key: "name" },
  { column: noteTemplates.specialty, key: "specialty", normalize: emptyToNull },
  { column: noteTemplates.status, key: "status" }
];

export async function listNoteTemplates(
  scope: TenantTxScope,
  input: z.infer<typeof NoteTemplateListInputSchema>
) {
  const filters = [eq(noteTemplates.tenantId, scope.tenantId)];
  if (!input.includeInactive) {
    filters.push(eq(noteTemplates.status, "active"));
  }

  const rows = await scope.tx
    .select()
    .from(noteTemplates)
    .where(and(...filters))
    .orderBy(asc(noteTemplates.name));

  await scope.audit.search({
    details: { resultCount: rows.length },
    resourceType: "note_template",
    resultCount: rows.length
  });

  return rows.map(toNoteTemplateOutput);
}

export async function createNoteTemplate(
  scope: TenantTxScope,
  input: z.infer<typeof NoteTemplateCreateInputSchema>
) {
  const [row] = await scope.tx
    .insert(noteTemplates)
    .values({
      advice: input.advice,
      complaints: input.complaints,
      diagnosisText: input.diagnosisText,
      findings: input.findings,
      followUp: input.followUp,
      name: input.name,
      specialty: emptyToNull(input.specialty ?? ""),
      tenantId: scope.tenantId
    })
    .returning()
    .catch((error: unknown) =>
      throwIfDuplicate(NOTE_TEMPLATE_UNIQUE_CONSTRAINT, NOTE_TEMPLATE_DUPLICATE_MESSAGE, error)
    );

  if (!row) {
    throw new Error("Failed to create Note Template");
  }

  await scope.audit.write({
    action: "create",
    details: { status: row.status },
    resourceId: row.id,
    resourceType: "note_template"
  });

  return toNoteTemplateOutput(row);
}

export async function updateNoteTemplate(
  scope: TenantTxScope,
  input: z.infer<typeof NoteTemplateUpdateInputSchema>
) {
  const baseGuard = [
    eq(noteTemplates.tenantId, scope.tenantId),
    eq(noteTemplates.id, input.noteTemplateId)
  ];

  const [current] = await scope.tx
    .select()
    .from(noteTemplates)
    .where(and(...baseGuard))
    .limit(1);

  if (!current) {
    throw new ORPCError("NOT_FOUND", {
      message: "Note Template not found in the requested Tenant.",
      status: 404
    });
  }

  const { guard, patch, updatedFieldCount } = planCatalogUpdate(
    NOTE_TEMPLATE_FIELDS,
    current,
    input,
    baseGuard
  );

  if (updatedFieldCount === 0) {
    await scope.audit.write({
      action: "update",
      details: { status: current.status, updatedFieldCount },
      resourceId: current.id,
      resourceType: "note_template"
    });

    return toNoteTemplateOutput(current);
  }

  const [row] = await scope.tx
    .update(noteTemplates)
    .set(patch as Partial<typeof noteTemplates.$inferInsert>)
    .where(and(...guard))
    .returning()
    .catch((error: unknown) =>
      throwIfDuplicate(NOTE_TEMPLATE_UNIQUE_CONSTRAINT, NOTE_TEMPLATE_DUPLICATE_MESSAGE, error)
    );

  if (!row) {
    throw new ORPCError("CONFLICT", {
      message: "Note Template changed. Reload and retry.",
      status: 409
    });
  }

  await scope.audit.write({
    action: "update",
    details: { status: row.status, updatedFieldCount },
    resourceId: row.id,
    resourceType: "note_template"
  });

  return toNoteTemplateOutput(row);
}
