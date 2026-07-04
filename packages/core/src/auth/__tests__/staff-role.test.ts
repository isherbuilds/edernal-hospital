import { describe, expect, it } from "vite-plus/test";

import {
  STAFF_ROLE,
  STAFF_ROLES,
  StaffRoleSchema,
  StaffRoleSetSchema,
  createStaffRoleRecord
} from "#@/auth/index";

describe("staff role contract", () => {
  it("keeps named role constants aligned with the staff role tuple", () => {
    expect(Object.values(STAFF_ROLE)).toEqual(STAFF_ROLES);
  });

  it("parses every staff role slug", () => {
    expect(STAFF_ROLES.map((role) => StaffRoleSchema.parse(role))).toEqual(STAFF_ROLES);
  });

  it("builds exact staff-role keyed records from the staff role tuple", () => {
    const roleRecord = createStaffRoleRecord((role) => role);

    expect(Object.keys(roleRecord)).toEqual(STAFF_ROLES);
  });

  it("keeps Better Auth organization role keys aligned with staff roles", async () => {
    const authOrganizationAccessUrl = new URL(
      "../../../../auth/src/organization-access.ts",
      import.meta.url
    ).href;
    const { organizationRoles } = (await import(authOrganizationAccessUrl)) as {
      organizationRoles: Record<string, unknown>;
    };

    expect(Object.keys(organizationRoles)).toEqual(STAFF_ROLES);
  });

  it("rejects Better Auth's built-in member role as a staff role", () => {
    expect(StaffRoleSchema.safeParse("member").success).toBe(false);
  });

  it("validates staff role sets", () => {
    expect(StaffRoleSetSchema.safeParse(["front_desk", "hospital_admin"]).success).toBe(true);
    expect(StaffRoleSetSchema.safeParse(["front_desk", "member"]).success).toBe(false);
    expect(StaffRoleSetSchema.safeParse([]).success).toBe(false);
  });
});
