import { describe, expect, it } from "vite-plus/test";

import { STAFF_ROLES } from "@tsu-stack/core/auth";

import { organizationRoles } from "#@/organization-access";

describe("organization access", () => {
  it("keeps Better Auth organization role keys aligned with staff roles", () => {
    expect(Object.keys(organizationRoles)).toEqual(STAFF_ROLES);
  });
});
