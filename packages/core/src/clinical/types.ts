import { z } from "zod";

import { CLINICAL_ARTIFACT_STATUSES } from "#@/clinical/constants";

export const ClinicalArtifactStatusSchema = z.enum(CLINICAL_ARTIFACT_STATUSES);

export type ClinicalArtifactStatus = z.infer<typeof ClinicalArtifactStatusSchema>;

export const ConsultNoteVitalsSchema = z.object({
  bloodPressure: z.string().trim().max(32).optional(),
  pulseBpm: z.number().int().min(0).max(400).optional(),
  temperatureCelsius: z.number().min(25).max(45).optional(),
  spo2Percent: z.number().int().min(0).max(100).optional(),
  weightKg: z.number().min(0).max(500).optional(),
  heightCm: z.number().min(0).max(300).optional()
});

export type ConsultNoteVitals = z.infer<typeof ConsultNoteVitalsSchema>;
