import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { normalizePatientPhone, PATIENT_SEX_OPTIONS } from "@tsu-stack/core/patient";
import { and, asc, desc, eq } from "@tsu-stack/db";
import { patientIdentifiers, patients } from "@tsu-stack/db/schema";

import { isUniqueConstraintError } from "#@/lib/db-errors";
import { TenantScopeInputSchema } from "#@/lib/tenancy/scope";
import { type TenantTxScope } from "#@/lib/tenancy/scoped-db";

export const PatientAddressSchema = z
  .object({
    city: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    line1: z.string().max(200).optional(),
    line2: z.string().max(200).optional(),
    postalCode: z.string().max(20).optional(),
    state: z.string().max(100).optional()
  })
  .default({});

export const PatientSexSchema = z.enum(PATIENT_SEX_OPTIONS);

const PatientDateOfBirthSchema = z.iso
  .date()
  .refine((value) => value <= new Date().toISOString().slice(0, 10), {
    message: "Date of birth cannot be in the future."
  });

const PatientAllergiesInputSchema = z.string().trim().max(2000);

const PatientDemographicsInputSchema = {
  address: PatientAddressSchema.optional(),
  ageYears: z.number().int().min(0).max(130).optional(),
  allergies: PatientAllergiesInputSchema.default(""),
  dateOfBirth: PatientDateOfBirthSchema.optional(),
  fullName: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(6).max(32),
  sex: PatientSexSchema.default("unknown")
} as const;

export const PatientQuickRegisterInputSchema = TenantScopeInputSchema.extend(
  PatientDemographicsInputSchema
).superRefine((input, ctx) => {
  if (input.ageYears == null && !input.dateOfBirth) {
    ctx.addIssue({
      code: "custom",
      message: "Either ageYears or dateOfBirth is required.",
      path: ["ageYears"]
    });
  }
});

export type PatientQuickRegisterInput = z.infer<typeof PatientQuickRegisterInputSchema>;

export const PatientUpdateAllergiesInputSchema = TenantScopeInputSchema.extend({
  allergies: PatientAllergiesInputSchema,
  patientId: z.uuid()
});

export const PatientByIdInputSchema = TenantScopeInputSchema.extend({
  id: z.uuid()
});

export const PatientSearchInputSchema = TenantScopeInputSchema.extend({
  phone: z.string().trim().min(6).max(32)
});

export const PatientIdentifierOutputSchema = z.object({
  id: z.uuid(),
  system: z.string(),
  value: z.string()
});

export const DuplicatePatientWarningSchema = z.object({
  patientId: z.uuid(),
  reason: z.enum(["same_phone", "same_phone_similar_name"])
});

export const PatientOutputSchema = z.object({
  address: PatientAddressSchema,
  allergies: z.string(),
  ageYears: z.number().int().nullable(),
  createdAt: z.iso.datetime(),
  dateOfBirth: z.iso.date().nullable(),
  duplicateWarnings: z.array(DuplicatePatientWarningSchema).default([]),
  fullName: z.string(),
  id: z.uuid(),
  identifiers: z.array(PatientIdentifierOutputSchema).default([]),
  phone: z.string(),
  sex: PatientSexSchema,
  updatedAt: z.iso.datetime()
});

export type PatientOutput = z.infer<typeof PatientOutputSchema>;

type PatientRow = typeof patients.$inferSelect;
type PatientIdentifierRow = typeof patientIdentifiers.$inferSelect;

function normalizePhoneInput(phone: string): string {
  try {
    return normalizePatientPhone(phone);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new ORPCError("BAD_REQUEST", {
        message: error.message,
        status: 400
      });
    }
    throw error;
  }
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036F]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function namesLookSimilar(first: string, second: string): boolean {
  const a = normalizeName(first);
  const b = normalizeName(second);
  if (!a || !b) {
    return false;
  }
  if (a === b || a.includes(b) || b.includes(a)) {
    return true;
  }

  const [firstTokenA] = a.split(" ");
  const [firstTokenB] = b.split(" ");
  return firstTokenA.length >= 3 && firstTokenA === firstTokenB;
}

export function toPatientOutput(
  row: PatientRow,
  identifiers: PatientIdentifierRow[] = [],
  duplicateWarnings: z.infer<typeof DuplicatePatientWarningSchema>[] = []
): PatientOutput {
  return PatientOutputSchema.parse({
    address: row.address,
    allergies: row.allergies,
    ageYears: row.ageYears,
    createdAt: row.createdAt.toISOString(),
    dateOfBirth: row.dateOfBirth,
    duplicateWarnings,
    fullName: row.fullName,
    id: row.id,
    identifiers: identifiers.map((identifier) => {
      return {
        id: identifier.id,
        system: identifier.system,
        value: identifier.value
      };
    }),
    phone: row.phone,
    sex: row.sex,
    updatedAt: row.updatedAt.toISOString()
  });
}

async function getPatientIdentifiers(
  { tenantId, tx }: TenantTxScope,
  patientId: string
): Promise<PatientIdentifierRow[]> {
  return tx
    .select()
    .from(patientIdentifiers)
    .where(
      and(eq(patientIdentifiers.tenantId, tenantId), eq(patientIdentifiers.patientId, patientId))
    )
    .orderBy(asc(patientIdentifiers.system), asc(patientIdentifiers.value));
}

async function findDuplicateWarnings(
  { tenantId, tx }: TenantTxScope,
  input: { fullName: string; phoneNormalized: string }
) {
  const rows = await tx
    .select({ fullName: patients.fullName, id: patients.id })
    .from(patients)
    .where(
      and(eq(patients.tenantId, tenantId), eq(patients.phoneNormalized, input.phoneNormalized))
    )
    .orderBy(asc(patients.createdAt));

  return rows.map((row) => {
    return {
      patientId: row.id,
      reason: namesLookSimilar(row.fullName, input.fullName)
        ? ("same_phone_similar_name" as const)
        : ("same_phone" as const)
    };
  });
}

export async function quickRegisterPatient(scope: TenantTxScope, input: PatientQuickRegisterInput) {
  const phoneNormalized = normalizePhoneInput(input.phone);
  const duplicateWarnings = await findDuplicateWarnings(scope, {
    fullName: input.fullName,
    phoneNormalized
  });

  const [patient] = await scope.tx
    .insert(patients)
    .values({
      address: input.address ?? {},
      allergies: input.allergies,
      ageYears: input.ageYears ?? null,
      dateOfBirth: input.dateOfBirth ?? null,
      fullName: input.fullName,
      phone: input.phone,
      phoneNormalized,
      sex: input.sex,
      tenantId: scope.tenantId
    })
    .returning();

  if (!patient) {
    throw new Error("Failed to create Patient");
  }

  await scope.audit.write({
    action: "create",
    details: {
      duplicateWarningCount: duplicateWarnings.length,
      hasDateOfBirth: Boolean(input.dateOfBirth)
    },
    resourceId: patient.id,
    resourceType: "patient"
  });

  return toPatientOutput(patient, [], duplicateWarnings);
}

export async function updatePatientAllergies(
  scope: TenantTxScope,
  input: z.infer<typeof PatientUpdateAllergiesInputSchema>
) {
  const [patient] = await scope.tx
    .update(patients)
    .set({
      allergies: input.allergies
    })
    .where(and(eq(patients.tenantId, scope.tenantId), eq(patients.id, input.patientId)))
    .returning();

  if (!patient) {
    throw new ORPCError("NOT_FOUND", {
      message: "Patient not found in the requested Tenant.",
      status: 404
    });
  }

  await scope.audit.write({
    action: "update",
    details: {
      field: "allergies"
    },
    resourceId: patient.id,
    resourceType: "patient"
  });

  const identifiers = await getPatientIdentifiers(scope, patient.id);
  return toPatientOutput(patient, identifiers);
}

export async function searchPatientsByPhone(scope: TenantTxScope, phone: string) {
  const phoneNormalized = normalizePhoneInput(phone);
  const rows = await scope.tx
    .select()
    .from(patients)
    .where(
      and(eq(patients.tenantId, scope.tenantId), eq(patients.phoneNormalized, phoneNormalized))
    )
    .orderBy(desc(patients.updatedAt));

  await scope.audit.search({
    details: {
      searchMode: "phone"
    },
    resourceType: "patient",
    resultCount: rows.length
  });

  return rows.map((row) => toPatientOutput(row));
}

export async function getPatientById(scope: TenantTxScope, id: string) {
  const [patient] = await scope.tx
    .select()
    .from(patients)
    .where(and(eq(patients.tenantId, scope.tenantId), eq(patients.id, id)))
    .limit(1);

  await scope.audit.read({
    resourceId: id,
    resourceType: "patient",
    resultCount: patient ? 1 : 0
  });

  if (!patient) {
    return null;
  }

  const identifiers = await getPatientIdentifiers(scope, patient.id);
  return toPatientOutput(patient, identifiers);
}

export async function createPatientIdentifier(
  scope: TenantTxScope,
  input: { patientId: string; system: string; value: string }
) {
  const [patient] = await scope.tx
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.tenantId, scope.tenantId), eq(patients.id, input.patientId)))
    .limit(1);

  if (!patient) {
    throw new ORPCError("NOT_FOUND", {
      message: "Patient not found in the requested Tenant.",
      status: 404
    });
  }

  const [identifier] = await scope.tx
    .insert(patientIdentifiers)
    .values({
      patientId: input.patientId,
      system: input.system,
      tenantId: scope.tenantId,
      value: input.value
    })
    .returning()
    .catch((error: unknown) => {
      if (isUniqueConstraintError(error, "patient_identifiers_tenant_id_system_value_unique")) {
        throw new ORPCError("CONFLICT", {
          message: "Patient identifier already exists for this Tenant.",
          status: 409
        });
      }

      throw error;
    });

  if (!identifier) {
    throw new Error("Failed to create Patient identifier");
  }

  await scope.audit.write({
    action: "create",
    details: {
      system: input.system
    },
    resourceId: identifier.id,
    resourceType: "patient_identifier"
  });

  return PatientIdentifierOutputSchema.parse({
    id: identifier.id,
    system: identifier.system,
    value: identifier.value
  });
}
