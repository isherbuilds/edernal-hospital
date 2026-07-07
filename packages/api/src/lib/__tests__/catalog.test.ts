// regression: optimistic guard must cover every editable catalog field, incl. specialty
import { describe, expect, it } from "vite-plus/test";

import { eq } from "@tsu-stack/db";
import { noteTemplates } from "@tsu-stack/db/schema";

import { type CatalogField, planCatalogUpdate } from "#@/lib/catalog";

type NoteTemplateCatalogRow = Pick<
  typeof noteTemplates.$inferSelect,
  | "advice"
  | "complaints"
  | "diagnosisText"
  | "findings"
  | "followUp"
  | "name"
  | "specialty"
  | "status"
>;

const emptyToNull = (value: string) => (value.length > 0 ? value : null);

const fields = [
  { column: noteTemplates.advice, key: "advice" },
  { column: noteTemplates.complaints, key: "complaints" },
  { column: noteTemplates.diagnosisText, key: "diagnosisText" },
  { column: noteTemplates.findings, key: "findings" },
  { column: noteTemplates.followUp, key: "followUp" },
  { column: noteTemplates.name, key: "name" },
  { column: noteTemplates.specialty, key: "specialty", normalize: emptyToNull },
  { column: noteTemplates.status, key: "status" }
] satisfies ReadonlyArray<CatalogField<NoteTemplateCatalogRow>>;

const current: NoteTemplateCatalogRow = {
  advice: "Rest and hydrate",
  complaints: "Headache",
  diagnosisText: "Migraine without aura",
  findings: "Normal neurological exam",
  followUp: "Review in two weeks",
  name: "Migraine follow-up",
  specialty: "neurology",
  status: "active"
};

const baseGuard = [eq(noteTemplates.tenantId, "tenant_1"), eq(noteTemplates.id, "template_1")];

describe("planCatalogUpdate", () => {
  it("guards every editable field when only specialty changes", () => {
    const plan = planCatalogUpdate(fields, current, { specialty: "cardiology" }, baseGuard);

    expect(plan.guard).toHaveLength(baseGuard.length + fields.length);
    expect(plan.patch).toEqual({ specialty: "cardiology" });
    expect(plan.updatedFieldCount).toBe(1);
  });

  it("normalizes empty specialty updates to null", () => {
    const plan = planCatalogUpdate(fields, current, { specialty: "" }, baseGuard);

    expect(plan.patch).toEqual({ specialty: null });
    expect(plan.updatedFieldCount).toBe(1);
  });

  it("guards every editable field even when the input changes no fields", () => {
    const plan = planCatalogUpdate(fields, current, {}, baseGuard);

    expect(plan.guard).toHaveLength(baseGuard.length + fields.length);
    expect(plan.patch).toEqual({});
    expect(plan.updatedFieldCount).toBe(0);
  });

  it("guards nullable editable fields when the current value is null", () => {
    const plan = planCatalogUpdate(fields, { ...current, specialty: null }, {}, baseGuard);

    expect(plan.guard).toHaveLength(baseGuard.length + fields.length);
    expect(plan.patch).toEqual({});
    expect(plan.updatedFieldCount).toBe(0);
  });
});
