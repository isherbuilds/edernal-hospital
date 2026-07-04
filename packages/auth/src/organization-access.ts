import { createAccessControl } from "better-auth/plugins/access";

import { STAFF_ROLE, createStaffRoleRecord, type StaffRole } from "@tsu-stack/core/auth";

export const organizationAccessStatements = {
  ac: ["create", "read", "update", "delete"],
  invitation: ["create", "cancel"],
  member: ["create", "update", "delete"],
  organization: ["update", "delete"],
  team: ["create", "update", "delete"]
} as const;

export const organizationAccessControl = createAccessControl(organizationAccessStatements);

const staffReadOnlyRole = organizationAccessControl.newRole({
  ac: ["read"],
  invitation: [],
  member: [],
  organization: [],
  team: []
});

const hospitalAdminRole = organizationAccessControl.newRole({
  ac: ["read"],
  invitation: ["create", "cancel"],
  member: ["create", "update", "delete"],
  organization: ["update"],
  team: []
});

function getOrganizationRole(role: StaffRole) {
  if (role === STAFF_ROLE.HOSPITAL_ADMIN) {
    return hospitalAdminRole;
  }

  return staffReadOnlyRole;
}

export const organizationRoles = createStaffRoleRecord(getOrganizationRole);
