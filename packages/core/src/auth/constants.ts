export const STAFF_ROLE = {
  FRONT_DESK: "front_desk",
  PRACTITIONER: "practitioner",
  BILLING: "billing",
  PHARMACY_LAB: "pharmacy_lab",
  HOSPITAL_ADMIN: "hospital_admin"
} as const;

export const STAFF_ROLES = [
  STAFF_ROLE.FRONT_DESK,
  STAFF_ROLE.PRACTITIONER,
  STAFF_ROLE.BILLING,
  STAFF_ROLE.PHARMACY_LAB,
  STAFF_ROLE.HOSPITAL_ADMIN
] as const;
