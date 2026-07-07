import { ORPCError } from "@orpc/server";

import { type AnyPgColumn, eq, isNull, type SQL } from "@tsu-stack/db";

import { isUniqueConstraintError } from "#@/lib/db-errors";

/**
 * One editable field of a tenant catalog resource (Formulary item, Note Template, …):
 * its column, the row/input key, and an optional normalizer (e.g. empty string → null).
 */
export type CatalogField<TRow> = {
  readonly column: AnyPgColumn;
  readonly key: keyof TRow & string;
  readonly normalize?: (value: string) => string | null;
};

export type CatalogUpdatePlan = {
  readonly guard: SQL[];
  readonly patch: Record<string, string | null>;
  readonly updatedFieldCount: number;
};

/**
 * Derive the write patch AND the guard from a single field list.
 *
 * Because both come from the same list, every editable column is also part of the
 * guard — the UPDATE only lands if the row still matches the values just read in this
 * transaction, closing the server read→write race (the bug class where a column was
 * writable but missing from the guard). This is NOT full optimistic concurrency: it does
 * not compare against the client's edit-dialog baseline, so callers reduce the
 * lost-update window by sending sparse patches of only the fields they changed.
 */
export function planCatalogUpdate<TRow>(
  fields: ReadonlyArray<CatalogField<TRow>>,
  current: TRow,
  input: Readonly<Record<string, string | undefined>>,
  baseGuard: SQL[]
): CatalogUpdatePlan {
  const currentRow = current as Record<string, string | null>;
  const patch: Record<string, string | null> = {};
  const guard = [...baseGuard];
  let updatedFieldCount = 0;

  for (const field of fields) {
    const currentValue = currentRow[field.key];
    guard.push(currentValue === null ? isNull(field.column) : eq(field.column, currentValue));

    const nextValue = input[field.key];
    if (nextValue !== undefined) {
      patch[field.key] = field.normalize ? field.normalize(nextValue) : nextValue;
      updatedFieldCount += 1;
    }
  }

  return { guard, patch, updatedFieldCount };
}

/** Map a unique-constraint violation to a CONFLICT; rethrow anything else. */
export function throwIfDuplicate(uniqueConstraint: string, message: string, error: unknown): never {
  if (isUniqueConstraintError(error, uniqueConstraint)) {
    throw new ORPCError("CONFLICT", { message, status: 409 });
  }

  throw error;
}
