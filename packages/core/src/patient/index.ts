const PATIENT_PHONE_MIN_DIGITS = 6;
const PATIENT_PHONE_MAX_DIGITS = 15;

export const PATIENT_SEX_OPTIONS = ["male", "female", "other", "unknown"] as const;

export type PatientSex = (typeof PATIENT_SEX_OPTIONS)[number];

export function normalizePatientPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // +91/91 and trunk-0 prefixes are the two common front-desk input habits.
  const normalized =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits;

  if (
    normalized.length < PATIENT_PHONE_MIN_DIGITS ||
    normalized.length > PATIENT_PHONE_MAX_DIGITS
  ) {
    throw new RangeError(
      `Phone number must contain ${PATIENT_PHONE_MIN_DIGITS} to ${PATIENT_PHONE_MAX_DIGITS} digits.`
    );
  }

  return normalized;
}
