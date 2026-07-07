import { z } from "zod";

import { type ConsultNoteOutput } from "@tsu-stack/api/routers/consult/queries";
import {
  ConsultNoteVitalsSchema,
  NOTE_TEXT_LIMIT,
  PRESCRIPTION_TEXT_LIMIT,
  type ConsultNoteVitals
} from "@tsu-stack/core/clinical";

const noteTextSchema = z.string().trim().max(NOTE_TEXT_LIMIT);
const prescriptionTextSchema = z.string().trim().max(PRESCRIPTION_TEXT_LIMIT);

const noteContentSchema = z.object({
  advice: noteTextSchema,
  complaints: noteTextSchema,
  diagnosisCode: z.string().trim().max(100).optional(),
  diagnosisText: noteTextSchema,
  findings: noteTextSchema,
  followUp: noteTextSchema
});

const prescriptionLineSchema = z.object({
  dose: prescriptionTextSchema,
  duration: prescriptionTextSchema,
  formularyItemId: z.uuid().optional(),
  frequency: prescriptionTextSchema,
  instructions: prescriptionTextSchema,
  medicationText: z.string().trim().min(1, "Medication is required.").max(PRESCRIPTION_TEXT_LIMIT)
});

export type NoteFormState = {
  advice: string;
  bloodPressure: string;
  complaints: string;
  diagnosisCode: string;
  diagnosisText: string;
  findings: string;
  followUp: string;
  heightCm: string;
  pulseBpm: string;
  spo2Percent: string;
  temperatureCelsius: string;
  weightKg: string;
};

type NoteSubmitResult =
  | {
      ok: true;
      value: z.infer<typeof noteContentSchema> & { vitals: ConsultNoteVitals };
    }
  | { ok: false; message: string };

export type PrescriptionLineForm = {
  dose: string;
  duration: string;
  formularyItemId?: string;
  frequency: string;
  id: string;
  instructions: string;
  medicationText: string;
};

type PrescriptionLinesSubmitResult =
  | { ok: true; value: Array<z.infer<typeof prescriptionLineSchema>> }
  | { ok: false; message: string };

export const emptyNoteForm: NoteFormState = {
  advice: "",
  bloodPressure: "",
  complaints: "",
  diagnosisCode: "",
  diagnosisText: "",
  findings: "",
  followUp: "",
  heightCm: "",
  pulseBpm: "",
  spo2Percent: "",
  temperatureCelsius: "",
  weightKg: ""
};

export function noteFormFromOutput(note: ConsultNoteOutput): NoteFormState {
  return {
    advice: note.advice,
    bloodPressure: note.vitals.bloodPressure ?? "",
    complaints: note.complaints,
    diagnosisCode: note.diagnosisCode ?? "",
    diagnosisText: note.diagnosisText,
    findings: note.findings,
    followUp: note.followUp,
    heightCm: note.vitals.heightCm == null ? "" : String(note.vitals.heightCm),
    pulseBpm: note.vitals.pulseBpm == null ? "" : String(note.vitals.pulseBpm),
    spo2Percent: note.vitals.spo2Percent == null ? "" : String(note.vitals.spo2Percent),
    temperatureCelsius:
      note.vitals.temperatureCelsius == null ? "" : String(note.vitals.temperatureCelsius),
    weightKg: note.vitals.weightKg == null ? "" : String(note.vitals.weightKg)
  };
}

export function parseOptionalNumber(value: string, label: string, mode: "int" | "number") {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: undefined } as const;
  }
  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue)) {
    return { ok: false, message: `${label} must be a number.` } as const;
  }
  if (mode === "int" && !Number.isInteger(numericValue)) {
    return { ok: false, message: `${label} must be a whole number.` } as const;
  }

  return { ok: true, value: numericValue } as const;
}

export function buildNoteInput(form: NoteFormState): NoteSubmitResult {
  const pulse = parseOptionalNumber(form.pulseBpm, "Pulse", "int");
  const temperature = parseOptionalNumber(form.temperatureCelsius, "Temperature", "number");
  const spo2 = parseOptionalNumber(form.spo2Percent, "SpO₂", "int");
  const weight = parseOptionalNumber(form.weightKg, "Weight", "number");
  const height = parseOptionalNumber(form.heightCm, "Height", "number");
  const parsedNumbers = [pulse, temperature, spo2, weight, height];
  const invalidNumber = parsedNumbers.find((result) => !result.ok);
  if (invalidNumber && !invalidNumber.ok) {
    return { ok: false, message: invalidNumber.message };
  }

  const vitals: ConsultNoteVitals = {};
  if (form.bloodPressure.trim().length > 0) {
    vitals.bloodPressure = form.bloodPressure.trim();
  }
  if (pulse.ok && pulse.value != null) {
    vitals.pulseBpm = pulse.value;
  }
  if (temperature.ok && temperature.value != null) {
    vitals.temperatureCelsius = temperature.value;
  }
  if (spo2.ok && spo2.value != null) {
    vitals.spo2Percent = spo2.value;
  }
  if (weight.ok && weight.value != null) {
    vitals.weightKg = weight.value;
  }
  if (height.ok && height.value != null) {
    vitals.heightCm = height.value;
  }

  const parsedVitals = ConsultNoteVitalsSchema.safeParse(vitals);
  if (!parsedVitals.success) {
    return {
      ok: false,
      message: parsedVitals.error.issues[0]?.message ?? "Vitals are outside the allowed range."
    };
  }

  const parsedContent = noteContentSchema.safeParse({
    advice: form.advice,
    complaints: form.complaints,
    diagnosisCode: form.diagnosisCode.trim().length > 0 ? form.diagnosisCode : undefined,
    diagnosisText: form.diagnosisText,
    findings: form.findings,
    followUp: form.followUp
  });
  if (!parsedContent.success) {
    return {
      ok: false,
      message: parsedContent.error.issues[0]?.message ?? "Note content is invalid."
    };
  }

  return { ok: true, value: { ...parsedContent.data, vitals: parsedVitals.data } };
}

export function buildPrescriptionLines(
  lines: PrescriptionLineForm[]
): PrescriptionLinesSubmitResult {
  if (lines.length === 0) {
    return { ok: false, message: "Add at least one prescription line." };
  }

  const parsedLines: Array<z.infer<typeof prescriptionLineSchema>> = [];
  for (const [index, line] of lines.entries()) {
    const parsedLine = prescriptionLineSchema.safeParse({
      dose: line.dose,
      duration: line.duration,
      formularyItemId: line.formularyItemId === "" ? undefined : line.formularyItemId,
      frequency: line.frequency,
      instructions: line.instructions,
      medicationText: line.medicationText
    });
    if (!parsedLine.success) {
      return {
        ok: false,
        message: `Line ${index + 1}: ${parsedLine.error.issues[0]?.message ?? "Invalid prescription line."}`
      };
    }
    parsedLines.push(parsedLine.data);
  }

  return { ok: true, value: parsedLines };
}

export function formatPatientAgeDob(ageYears: number | null, dateOfBirth: string | null) {
  const age = ageYears == null ? "Age not recorded" : `${ageYears}y`;
  const dob = dateOfBirth == null ? "DOB not recorded" : `DOB ${dateOfBirth}`;
  return `${age} / ${dob}`;
}

export function formatSex(sex: string) {
  if (sex === "unknown") {
    return "Sex not recorded";
  }
  return sex.charAt(0).toUpperCase() + sex.slice(1);
}
