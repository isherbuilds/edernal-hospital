import { randomUUID } from "node:crypto";
import process from "node:process";

import { call } from "@orpc/server";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { type AuthSession } from "@tsu-stack/auth/index";
import { type RequestLogger } from "@tsu-stack/logger/server";

import { type OrpcContext } from "#@/lib/context/types";
import { setupApiTestEnv } from "#@/routers/__tests__/test-env";

setupApiTestEnv();

const { checkIsDbReady, db, eq, inArray, sql } = await import("@tsu-stack/db");
const {
  auditEvents,
  facilities,
  member,
  organization,
  practitioners,
  user: authUser
} = await import("@tsu-stack/db/schema");
const { facilityRouter } = await import("#@/routers/facility/index");
const { practitionerRouter } = await import("#@/routers/practitioner/index");

type TenantFixture = {
  facilityId: string;
  organizationId: string;
  practitionerId: string;
  userId: string;
};

const created = {
  organizationIds: new Set<string>(),
  userIds: new Set<string>()
};

const logger = {
  debug() {},
  emit() {},
  error() {},
  info() {},
  set() {},
  warn() {}
} as unknown as RequestLogger;

function remember(fixture: TenantFixture) {
  created.organizationIds.add(fixture.organizationId);
  created.userIds.add(fixture.userId);
}

async function cleanup() {
  const organizationIds = [...created.organizationIds];
  const userIds = [...created.userIds];

  if (organizationIds.length > 0) {
    await deleteAuditEventsForOrganizations(organizationIds);
    await db.delete(facilities).where(inArray(facilities.tenantId, organizationIds));
    await db.delete(practitioners).where(inArray(practitioners.tenantId, organizationIds));
    await db.delete(member).where(inArray(member.organizationId, organizationIds));
    await db.delete(organization).where(inArray(organization.id, organizationIds));
  }

  if (userIds.length > 0) {
    await db.delete(authUser).where(inArray(authUser.id, userIds));
  }

  created.organizationIds.clear();
  created.userIds.clear();
}

async function deleteAuditEventsForOrganizations(organizationIds: string[]) {
  await db.execute(
    sql`ALTER TABLE "audit_events" DISABLE TRIGGER "audit_events_prevent_update_delete"`
  );

  try {
    await db.delete(auditEvents).where(inArray(auditEvents.tenantId, organizationIds));
  } finally {
    await db.execute(
      sql`ALTER TABLE "audit_events" ENABLE TRIGGER "audit_events_prevent_update_delete"`
    );
  }
}

afterEach(async () => {
  await cleanup();
});

async function createTenantFixture(input: {
  role?: string;
  withMember?: boolean;
}): Promise<TenantFixture> {
  const role = input.role ?? "front_desk";
  const suffix = randomUUID();
  const organizationId = `org_${suffix}`;
  const userId = `user_${suffix}`;
  const memberId = `member_${suffix}`;
  const slug = `phase0-${suffix}`;

  await db.insert(authUser).values({
    email: `${suffix}@phase0.test`,
    emailVerified: true,
    id: userId,
    name: `Phase 0 ${role}`
  });

  await db.insert(organization).values({
    defaultTimezone: "Asia/Kolkata",
    displayName: `Phase 0 Tenant ${suffix}`,
    id: organizationId,
    legalName: `Phase 0 Tenant ${suffix} Private Limited`,
    name: `Phase 0 ${suffix}`,
    slug
  });

  if (input.withMember !== false) {
    await db.insert(member).values({
      id: memberId,
      displayNameOverride: `Phase 0 ${role}`,
      employeeCode: `TST-${role}`,
      organizationId,
      role,
      userId
    });
  }

  const [facility] = await db
    .insert(facilities)
    .values({
      address: {},
      code: "MAIN",
      name: `Phase 0 Facility ${suffix}`,
      tenantId: organizationId
    })
    .returning();
  if (!facility) {
    throw new Error("Failed to create test Facility");
  }

  const [practitioner] = await db
    .insert(practitioners)
    .values({
      displayName: `Phase 0 Practitioner ${suffix}`,
      registrationCouncil: "NMC",
      registrationNumber: suffix,
      specialties: ["general_medicine"],
      tenantId: organizationId
    })
    .returning();
  if (!practitioner) {
    throw new Error("Failed to create test Practitioner");
  }

  const fixture = {
    facilityId: facility.id,
    organizationId,
    practitionerId: practitioner.id,
    userId
  };
  remember(fixture);
  return fixture;
}

function tenantScope(fixture: TenantFixture) {
  return {
    tenantId: fixture.organizationId
  };
}

function contextFor(
  fixture: TenantFixture,
  activeOrganizationId: string | null = null
): OrpcContext {
  return {
    logger,
    session: {
      session: {
        activeOrganizationId,
        id: `session_${randomUUID()}`,
        userId: fixture.userId
      },
      user: {
        id: fixture.userId
      }
    } as AuthSession
  };
}

async function expectOrpcCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}

async function checkTenantRuntimeSchemaReady(): Promise<boolean> {
  try {
    await db
      .select({
        defaultTimezone: organization.defaultTimezone,
        id: organization.id
      })
      .from(organization)
      .limit(0);
    await db
      .select({
        id: facilities.id,
        tenantId: facilities.tenantId
      })
      .from(facilities)
      .limit(0);
    await db
      .select({
        id: practitioners.id,
        tenantId: practitioners.tenantId
      })
      .from(practitioners)
      .limit(0);
    await db
      .select({
        id: auditEvents.id,
        tenantId: auditEvents.tenantId
      })
      .from(auditEvents)
      .limit(0);
    return true;
  } catch {
    return false;
  }
}

const isDbReady = await checkIsDbReady();
if (!isDbReady && process.env.CI) {
  throw new Error("Tenant runtime tests require a reachable DATABASE_URL in CI");
}
const isSchemaReady = isDbReady && (await checkTenantRuntimeSchemaReady());
if (isDbReady && !isSchemaReady && process.env.CI) {
  throw new Error("Tenant runtime tests require the Phase 0 migrated DATABASE_URL schema in CI");
}
const describeWithDb = isSchemaReady ? describe : describe.skip;

describeWithDb("tenant runtime access", () => {
  it("lists Facilities for the requested Tenant organization without active organization", async () => {
    const fixture = await createTenantFixture({ role: "front_desk" });

    const result = await call(facilityRouter.list, tenantScope(fixture), {
      context: contextFor(fixture)
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(fixture.facilityId);
  });

  it("denies create access to non-admin staff", async () => {
    expect.assertions(1);
    const fixture = await createTenantFixture({ role: "front_desk" });

    await expectOrpcCode(
      call(
        facilityRouter.create,
        {
          code: "WEST",
          name: "West Wing",
          tenantId: fixture.organizationId
        },
        {
          context: contextFor(fixture)
        }
      ),
      "FORBIDDEN"
    );
  });

  it("allows Better Auth multi-role member strings when one role is permitted", async () => {
    const fixture = await createTenantFixture({ role: "front_desk,hospital_admin" });

    const result = await call(
      facilityRouter.create,
      {
        code: "MULTI",
        name: "Multi Role Wing",
        tenantId: fixture.organizationId
      },
      {
        context: contextFor(fixture)
      }
    );

    expect(result.code).toBe("MULTI");
  });

  it("rejects unknown Better Auth member role strings", async () => {
    expect.assertions(1);
    const fixture = await createTenantFixture({ role: "member" });

    await expectOrpcCode(
      call(facilityRouter.list, tenantScope(fixture), {
        context: contextFor(fixture)
      }),
      "FORBIDDEN"
    );
  });

  it("ignores session active organization when requested Tenant membership is valid", async () => {
    const activeTenant = await createTenantFixture({ role: "front_desk" });
    const requestedTenant = await createTenantFixture({ role: "front_desk" });

    const result = await call(facilityRouter.list, tenantScope(requestedTenant), {
      context: contextFor(requestedTenant, activeTenant.organizationId)
    });

    expect(result.map((row) => row.id)).toEqual([requestedTenant.facilityId]);
  });

  it("rejects a requested Tenant organization the user does not belong to", async () => {
    expect.assertions(2);
    const tenantA = await createTenantFixture({ role: "front_desk" });
    const tenantB = await createTenantFixture({ role: "front_desk" });
    const tenantBContext = contextFor(tenantB);

    await expectOrpcCode(
      call(facilityRouter.list, tenantScope(tenantA), {
        context: tenantBContext
      }),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(
        facilityRouter.create,
        {
          code: "EAST",
          name: "East Wing",
          tenantId: tenantA.organizationId
        },
        {
          context: tenantBContext
        }
      ),
      "FORBIDDEN"
    );
  });

  it("rejects a requested Tenant organization with no member row", async () => {
    expect.assertions(1);
    const fixture = await createTenantFixture({ withMember: false });

    await expectOrpcCode(
      call(facilityRouter.list, tenantScope(fixture), {
        context: contextFor(fixture)
      }),
      "FORBIDDEN"
    );
  });

  it("keeps reads tenant-scoped and writes read audit events", async () => {
    const tenantA = await createTenantFixture({ role: "front_desk" });
    const tenantB = await createTenantFixture({ role: "front_desk" });
    const contextB = contextFor(tenantB);

    const facility = await call(
      facilityRouter.byId,
      { id: tenantA.facilityId, tenantId: tenantB.organizationId },
      { context: contextB }
    );
    const practitioner = await call(
      practitionerRouter.byId,
      { id: tenantA.practitionerId, tenantId: tenantB.organizationId },
      { context: contextB }
    );
    const facilityList = await call(facilityRouter.list, tenantScope(tenantB), {
      context: contextB
    });
    const practitionerList = await call(practitionerRouter.list, tenantScope(tenantB), {
      context: contextB
    });

    expect(facility).toBeNull();
    expect(practitioner).toBeNull();
    expect(facilityList.map((row) => row.id)).toEqual([tenantB.facilityId]);
    expect(practitionerList.map((row) => row.id)).toEqual([tenantB.practitionerId]);

    const tenantBAudits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.tenantId, tenantB.organizationId));

    expect(tenantBAudits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "read",
          details: expect.objectContaining({
            procedure: "facility.byId",
            resultCount: 0
          }),
          resourceId: tenantA.facilityId,
          resourceType: "facility"
        }),
        expect.objectContaining({
          action: "read",
          details: expect.objectContaining({
            procedure: "practitioner.byId",
            resultCount: 0
          }),
          resourceId: tenantA.practitionerId,
          resourceType: "practitioner"
        }),
        expect.objectContaining({
          action: "search",
          details: expect.objectContaining({
            procedure: "facility.list",
            resultCount: 1
          }),
          resourceType: "facility"
        }),
        expect.objectContaining({
          action: "search",
          details: expect.objectContaining({
            procedure: "practitioner.list",
            resultCount: 1
          }),
          resourceType: "practitioner"
        })
      ])
    );
  });

  it("allows hospital_admin writes and records write audit events", async () => {
    const fixture = await createTenantFixture({ role: "hospital_admin" });
    const registrationNumber = `reg_${randomUUID()}`;

    const createdFacility = await call(
      facilityRouter.create,
      {
        code: "EAST",
        name: "East Wing",
        tenantId: fixture.organizationId
      },
      {
        context: contextFor(fixture)
      }
    );
    const createdPractitioner = await call(
      practitionerRouter.create,
      {
        displayName: "Dr Phase Zero",
        registrationCouncil: "NMC",
        registrationNumber,
        tenantId: fixture.organizationId
      },
      {
        context: contextFor(fixture)
      }
    );

    const audits = await db
      .select()
      .from(auditEvents)
      .where(inArray(auditEvents.resourceId, [createdFacility.id, createdPractitioner.id]));

    expect(audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "create",
          details: expect.objectContaining({
            procedure: "facility.create"
          }),
          resourceId: createdFacility.id,
          resourceType: "facility",
          tenantId: fixture.organizationId
        }),
        expect.objectContaining({
          action: "create",
          details: expect.objectContaining({
            procedure: "practitioner.create"
          }),
          resourceId: createdPractitioner.id,
          resourceType: "practitioner",
          tenantId: fixture.organizationId
        })
      ])
    );
  });
});
