export const PHI_FIELD_BANLIST = [
  "patientName",
  "patient_name",
  "firstName",
  "first_name",
  "lastName",
  "last_name",
  "phone",
  "phoneNumber",
  "mobile",
  "email",
  "dob",
  "dateOfBirth",
  "date_of_birth",
  "address",
  "diagnosis",
  "complaint",
  "chiefComplaint",
  "allergy",
  "allergies",
  "clinicalNote",
  "clinicalText",
  "prescription",
  "labResult",
  "paymentDetails"
] as const;

export type PhiFieldName = (typeof PHI_FIELD_BANLIST)[number];
