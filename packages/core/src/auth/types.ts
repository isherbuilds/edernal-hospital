import { z } from "zod";

import { STAFF_ROLES } from "#@/auth/constants";

export const StaffRoleSchema = z.enum(STAFF_ROLES);
export const StaffRoleSetSchema = z.array(StaffRoleSchema).min(1);

export type StaffRole = z.infer<typeof StaffRoleSchema>;

export type StaffRoleRecord<TValue> = Record<StaffRole, TValue>;

export function createStaffRoleRecord<TValue>(
  getValue: (role: StaffRole) => TValue
): StaffRoleRecord<TValue> {
  return Object.fromEntries(
    STAFF_ROLES.map((role) => [role, getValue(role)])
  ) as StaffRoleRecord<TValue>;
}
