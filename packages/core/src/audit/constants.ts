export const AUDIT_ACTIONS = [
  "create",
  "read",
  "search",
  "update",
  "sign",
  "print",
  "export",
  "delete"
] as const;

export const AUDIT_RESOURCE_TYPES = [
  "tenant",
  "facility",
  "practitioner",
  "staff_profile",
  "patient",
  "patient_identifier",
  "encounter",
  "token",
  "consult_note",
  "prescription",
  "formulary_item",
  "note_template"
] as const;
