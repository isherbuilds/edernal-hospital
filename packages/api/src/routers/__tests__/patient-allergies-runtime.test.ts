import { randomUUID } from "node:crypto";
import process from "node:process";

import { call } from "@orpc/server";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { type AuthSession } from "@tsu-stack/auth/index";
import { checkIsDbReady, db, inArray, sql } from "@tsu-stack/db";
import {
  auditEvents,
  facilities,
  member,
  organization,
  patients,
  practitioners,
  user as authUser
} from "@tsu-stack/db/schema";
import { type RequestLogger } from "@tsu-stack/logger/server";

import { type OrpcContext } from "#@/lib/context/types";
import { patientRouter } from "#@/routers/patient/index";

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

async function deleteAuditEventsForOrganizations(organizationIds: string[]) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1783186182780)`);
    await tx.execute(
      sql`ALTER TABLE "audit_events" DISABLE TRIGGER "audit_events_prevent_update_delete"`
    );

    try {
      await tx.delete(auditEvents).where(inArray(auditEvents.tenantId, organizationIds));
    } finally {
      await tx.execute(
        sql`ALTER TABLE "audit_events" ENABLE TRIGGER "audit_events_prevent_update_delete"`
      );
    }
  });
}

async function cleanup() {
  const organizationIds = [...created.organizationIds];
  const userIds = [...created.userIds];

  if (organizationIds.length > 0) {
    await deleteAuditEventsForOrganizations(organizationIds);
    await db.delete(patients).where(inArray(patients.tenantId, organizationIds));
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

afterEach(async () => {
  await cleanup();
});

async function createTenantFixture(input: { role?: string } = {}): Promise<TenantFixture> {
  const role = input.role ?? "front_desk";
  const suffix = randomUUID();
  const organizationId = `org_${suffix}`;
  const userId = `user_${suffix}`;

  await db.insert(authUser).values({
    email: `${suffix}@patient-allergies.test`,
    emailVerified: true,
    id: userId,
    name: `Patient allergies ${role}`
  });

  await db.insert(organization).values({
    defaultTimezone: "Asia/Kolkata",
    displayName: `Patient Allergies Tenant ${suffix}`,
    id: organizationId,
    legalName: `Patient Allergies Tenant ${suffix} Private Limited`,
    name: `Patient Allergies ${suffix}`,
    slug: `patient-allergies-${suffix}`
  });

  await db.insert(member).values({
    displayNameOverride: `Patient allergies ${role}`,
    employeeCode: `PA-${role}`,
    id: `member_${suffix}`,
    organizationId,
    role,
    userId
  });

  const [facility] = await db
    .insert(facilities)
    .values({
      address: {},
      code: "MAIN",
      name: `Patient Allergies Facility ${suffix}`,
      tenantId: organizationId
    })
    .returning();
  if (!facility) {
    throw new Error("Failed to create test Facility");
  }

  const [practitioner] = await db
    .insert(practitioners)
    .values({
      displayName: `Patient Allergies Practitioner ${suffix}`,
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

function contextFor(fixture: TenantFixture): OrpcContext {
  return {
    logger,
    session: {
      session: {
        activeOrganizationId: null,
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

async function checkPatientAllergiesSchemaReady(): Promise<boolean> {
  try {
    await db
      .select({ allergies: patients.allergies, id: patients.id, tenantId: patients.tenantId })
      .from(patients)
      .limit(0);
    await db
      .select({ id: auditEvents.id, tenantId: auditEvents.tenantId })
      .from(auditEvents)
      .limit(0);
    return true;
  } catch {
    return false;
  }
}

const isDbReady = await checkIsDbReady();
if (!isDbReady && process.env.CI) {
  throw new Error("Patient allergies runtime tests require a reachable DATABASE_URL in CI");
}
const isSchemaReady = isDbReady && (await checkPatientAllergiesSchemaReady());
if (isDbReady && !isSchemaReady && process.env.CI) {
  throw new Error("Patient allergies runtime tests require the patient allergies schema migration");
}
const describeWithDb = isSchemaReady ? describe : describe.skip;

describeWithDb("patient allergies runtime", () => {
  it("updates allergies, returns them from patient reads, and audits without allergy text", async () => {
    const fixture = await createTenantFixture({ role: "front_desk,practitioner" });
    const context = contextFor(fixture);
    const allergyText = `synthetic allergy note ${randomUUID()}`;

    const patient = await call(
      patientRouter.quickRegister,
      {
        ageYears: 34,
        fullName: "Allergy Update Patient",
        phone: "9876500200",
        sex: "unknown",
        tenantId: fixture.organizationId
      },
      { context }
    );

    const updated = await call(
      patientRouter.updateAllergies,
      {
        allergies: `  ${allergyText}  `,
        patientId: patient.id,
        tenantId: fixture.organizationId
      },
      { context }
    );
    const byId = await call(
      patientRouter.byId,
      { id: patient.id, tenantId: fixture.organizationId },
      { context }
    );
    const search = await call(
      patientRouter.searchByPhone,
      { phone: "9876500200", tenantId: fixture.organizationId },
      { context }
    );

    expect(patient.allergies).toBe("");
    expect(updated.allergies).toBe(allergyText);
    expect(byId?.allergies).toBe(allergyText);
    expect(search).toEqual([expect.objectContaining({ allergies: allergyText, id: patient.id })]);

    const audits = await db
      .select()
      .from(auditEvents)
      .where(inArray(auditEvents.tenantId, [fixture.organizationId]));
    const allergyAudit = audits.find(
      (audit) =>
        audit.action === "update" &&
        audit.resourceId === patient.id &&
        audit.resourceType === "patient" &&
        JSON.stringify(audit.details).includes("patient.updateAllergies")
    );

    expect(allergyAudit).toEqual(
      expect.objectContaining({
        details: expect.objectContaining({
          field: "allergies",
          procedure: "patient.updateAllergies"
        })
      })
    );
    expect(JSON.stringify(allergyAudit?.details)).not.toContain(allergyText);
  });

  it("persists allergies supplied during quick registration", async () => {
    const fixture = await createTenantFixture();
    const context = contextFor(fixture);
    const allergyText = `quick registration allergy note ${randomUUID()}`;

    const patient = await call(
      patientRouter.quickRegister,
      {
        ageYears: 29,
        allergies: `  ${allergyText}  `,
        fullName: "Quick Allergy Patient",
        phone: "9876500201",
        sex: "female",
        tenantId: fixture.organizationId
      },
      { context }
    );
    const byId = await call(
      patientRouter.byId,
      { id: patient.id, tenantId: fixture.organizationId },
      { context }
    );

    expect(patient.allergies).toBe(allergyText);
    expect(byId?.allergies).toBe(allergyText);
  });

  it("distinguishes tenant-scoped misses from missing tenant membership", async () => {
    expect.assertions(2);
    const tenantA = await createTenantFixture();
    const tenantB = await createTenantFixture({ role: "front_desk" });
    const contextA = contextFor(tenantA);
    const contextB = contextFor(tenantB);
    const patient = await call(
      patientRouter.quickRegister,
      {
        ageYears: 46,
        fullName: "Cross Tenant Allergy Patient",
        phone: "9876500202",
        sex: "male",
        tenantId: tenantA.organizationId
      },
      { context: contextA }
    );

    await expectOrpcCode(
      call(
        patientRouter.updateAllergies,
        {
          allergies: "tenant scoped miss allergy note",
          patientId: patient.id,
          tenantId: tenantB.organizationId
        },
        { context: contextB }
      ),
      "NOT_FOUND"
    );
    await expectOrpcCode(
      call(
        patientRouter.updateAllergies,
        {
          allergies: "forbidden tenant allergy note",
          patientId: patient.id,
          tenantId: tenantA.organizationId
        },
        { context: contextB }
      ),
      "FORBIDDEN"
    );
  });
});
