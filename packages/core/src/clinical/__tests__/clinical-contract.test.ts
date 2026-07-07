import { describe, expect, it } from "vite-plus/test";

import {
  CLINICAL_ARTIFACT_STATUS,
  ClinicalArtifactStatusSchema,
  ConsultNoteVitalsSchema
} from "@tsu-stack/core/clinical";

describe("clinical contract", () => {
  it("keeps named artifact status constants aligned with the schema", () => {
    const statuses = Object.values(CLINICAL_ARTIFACT_STATUS);

    expect(statuses.map((status) => ClinicalArtifactStatusSchema.parse(status))).toEqual(statuses);
  });

  it("rejects statuses outside the clinical artifact lifecycle", () => {
    expect(ClinicalArtifactStatusSchema.safeParse("draft").success).toBe(false);
  });

  describe("consult note vitals", () => {
    it("accepts an empty vitals object", () => {
      expect(ConsultNoteVitalsSchema.parse({})).toEqual({});
    });

    it("normalizes and preserves every documented vitals field", () => {
      const parsed = ConsultNoteVitalsSchema.parse({
        bloodPressure: " 120/80 ",
        heightCm: 170,
        pulseBpm: 72,
        spo2Percent: 98,
        temperatureCelsius: 36.6,
        unexpectedField: "ignored by the package's default z.object convention",
        weightKg: 70.5
      });

      expect(parsed).toEqual({
        bloodPressure: "120/80",
        heightCm: 170,
        pulseBpm: 72,
        spo2Percent: 98,
        temperatureCelsius: 36.6,
        weightKg: 70.5
      });
    });

    it.each([
      { field: "pulseBpm", value: -1 },
      { field: "pulseBpm", value: 401 },
      { field: "spo2Percent", value: -1 },
      { field: "spo2Percent", value: 101 }
    ])("rejects out-of-range $field values", ({ field, value }) => {
      expect(ConsultNoteVitalsSchema.safeParse({ [field]: value }).success).toBe(false);
    });
  });
});
