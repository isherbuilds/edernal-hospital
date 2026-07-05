import { randomUUID } from "node:crypto";
import process from "node:process";

import { call } from "@orpc/server";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { type AuthSession } from "@tsu-stack/auth/index";
import { checkIsDbReady, db, eq, inArray, sql } from "@tsu-stack/db";
import {
  auditEvents,
  encounters,
  facilities,
  member,
  organization,
  patients,
  practitioners,
  tokens,
  user as authUser
} from "@tsu-stack/db/schema";
import { type RequestLogger } from "@tsu-stack/logger/server";

import { type OrpcContext } from "#@/lib/context/types";
import { patientRouter } from "#@/routers/patient/index";
import { queueRouter } from "#@/routers/queue/index";
import { tenantRouter } from "#@/routers/tenant/index";

type TenantFixture = {
  facilityId: string;
  organizationId: string;
  organizationDisplayName: string;
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
    await db.delete(tokens).where(inArray(tokens.tenantId, organizationIds));
    await db.delete(encounters).where(inArray(encounters.tenantId, organizationIds));
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
  const organizationDisplayName = `Phase 1 Tenant ${suffix}`;

  await db.insert(authUser).values({
    email: `${suffix}@phase1.test`,
    emailVerified: true,
    id: userId,
    name: `Phase 1 ${role}`
  });

  await db.insert(organization).values({
    defaultTimezone: "Asia/Kolkata",
    displayName: organizationDisplayName,
    id: organizationId,
    legalName: `Phase 1 Tenant ${suffix} Private Limited`,
    name: `Phase 1 ${suffix}`,
    slug: `phase1-${suffix}`
  });

  await db.insert(member).values({
    displayNameOverride: `Phase 1 ${role}`,
    employeeCode: `P1-${role}`,
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
      name: `Phase 1 Facility ${suffix}`,
      tenantId: organizationId
    })
    .returning();
  if (!facility) {
    throw new Error("Failed to create test Facility");
  }

  const [practitioner] = await db
    .insert(practitioners)
    .values({
      displayName: `Phase 1 Practitioner ${suffix}`,
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
    organizationDisplayName,
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

function todayInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function auditDetailProcedure(details: unknown): string | null {
  if (!details || typeof details !== "object" || !("procedure" in details)) {
    return null;
  }

  const procedure = details.procedure;
  return typeof procedure === "string" ? procedure : null;
}

async function checkPhaseOneSchemaReady(): Promise<boolean> {
  try {
    await db.select({ id: patients.id, tenantId: patients.tenantId }).from(patients).limit(0);
    await db.select({ id: encounters.id, tenantId: encounters.tenantId }).from(encounters).limit(0);
    await db.select({ id: tokens.id, tenantId: tokens.tenantId }).from(tokens).limit(0);
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
  throw new Error("Front desk runtime tests require a reachable DATABASE_URL in CI");
}
const isSchemaReady = isDbReady && (await checkPhaseOneSchemaReady());
if (isDbReady && !isSchemaReady && process.env.CI) {
  throw new Error(
    "Front desk runtime tests require the Phase 1 migrated DATABASE_URL schema in CI"
  );
}
const describeWithDb = isSchemaReady ? describe : describe.skip;

describeWithDb("front desk runtime", () => {
  it("quick-registers, searches, warns on duplicates, and records patient audit events", async () => {
    const fixture = await createTenantFixture();
    const context = contextFor(fixture);

    const first = await call(
      patientRouter.quickRegister,
      {
        ageYears: 34,
        fullName: "Anita Rao",
        phone: "+91 98765 43210",
        sex: "female",
        tenantId: fixture.organizationId
      },
      { context }
    );
    const duplicate = await call(
      patientRouter.quickRegister,
      {
        ageYears: 35,
        fullName: "Anita R",
        phone: "9876543210",
        sex: "female",
        tenantId: fixture.organizationId
      },
      { context }
    );
    const search = await call(
      patientRouter.searchByPhone,
      { phone: "9876543210", tenantId: fixture.organizationId },
      { context }
    );
    const byId = await call(
      patientRouter.byId,
      { id: first.id, tenantId: fixture.organizationId },
      { context }
    );

    expect(first.duplicateWarnings).toEqual([]);
    expect(duplicate.duplicateWarnings).toEqual([
      { patientId: first.id, reason: "same_phone_similar_name" }
    ]);
    const actualPatientIds = search.map((patient) => patient.id);
    actualPatientIds.sort();
    const expectedPatientIds = [duplicate.id, first.id];
    expectedPatientIds.sort();
    expect(actualPatientIds).toEqual(expectedPatientIds);
    expect(byId?.id).toBe(first.id);

    const audits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.tenantId, fixture.organizationId));

    expect(audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "create",
          details: expect.objectContaining({ procedure: "patient.quickRegister" }),
          resourceId: first.id,
          resourceType: "patient"
        }),
        expect.objectContaining({
          action: "search",
          details: expect.objectContaining({ procedure: "patient.searchByPhone", resultCount: 2 }),
          resourceType: "patient"
        }),
        expect.objectContaining({
          action: "read",
          details: expect.objectContaining({ procedure: "patient.byId", resultCount: 1 }),
          resourceId: first.id,
          resourceType: "patient"
        })
      ])
    );
  });

  it("rejects quick-registering a patient with a future date of birth", async () => {
    expect.assertions(1);
    const fixture = await createTenantFixture();

    await expectOrpcCode(
      call(
        patientRouter.quickRegister,
        {
          dateOfBirth: "2999-01-01",
          fullName: "Future Born",
          phone: "9876500000",
          sex: "unknown",
          tenantId: fixture.organizationId
        },
        { context: contextFor(fixture) }
      ),
      "BAD_REQUEST"
    );
  });

  it("normalizes trunk-zero Indian phone numbers before duplicate checks and search", async () => {
    const fixture = await createTenantFixture();
    const context = contextFor(fixture);

    const first = await call(
      patientRouter.quickRegister,
      {
        ageYears: 34,
        fullName: "Leena Das",
        phone: "09876543211",
        sex: "female",
        tenantId: fixture.organizationId
      },
      { context }
    );
    const duplicate = await call(
      patientRouter.quickRegister,
      {
        ageYears: 35,
        fullName: "Leena D",
        phone: "9876543211",
        sex: "female",
        tenantId: fixture.organizationId
      },
      { context }
    );
    const search = await call(
      patientRouter.searchByPhone,
      { phone: "+91 98765 43211", tenantId: fixture.organizationId },
      { context }
    );

    expect(duplicate.duplicateWarnings).toEqual([
      { patientId: first.id, reason: "same_phone_similar_name" }
    ]);
    const actualPatientIds = search.map((patient) => patient.id);
    actualPatientIds.sort();
    const expectedPatientIds = [duplicate.id, first.id];
    expectedPatientIds.sort();
    expect(actualPatientIds).toEqual(expectedPatientIds);
  });

  it("rejects patient phone searches below the minimum phone length", async () => {
    const fixture = await createTenantFixture();

    await expect(
      call(
        patientRouter.searchByPhone,
        { phone: "12345", tenantId: fixture.organizationId },
        { context: contextFor(fixture) }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("issues tokens, shows queue and practitioner day lists, and advances encounter lifecycle", async () => {
    const fixture = await createTenantFixture({ role: "front_desk,practitioner" });
    const context = contextFor(fixture);
    const patient = await call(
      patientRouter.quickRegister,
      {
        ageYears: 41,
        fullName: "Rohan Mehta",
        phone: "9999990000",
        sex: "male",
        tenantId: fixture.organizationId
      },
      { context }
    );

    const checkIn = await call(
      queueRouter.checkIn,
      {
        facilityId: fixture.facilityId,
        patientId: patient.id,
        practitionerId: fixture.practitionerId,
        tenantId: fixture.organizationId
      },
      { context }
    );
    const board = await call(
      queueRouter.board,
      {
        facilityId: fixture.facilityId,
        tenantId: fixture.organizationId
      },
      { context }
    );
    const repeatedBoard = await call(
      queueRouter.board,
      {
        facilityId: fixture.facilityId,
        tenantId: fixture.organizationId
      },
      { context }
    );
    const practitionerDay = await call(
      queueRouter.practitionerDay,
      {
        practitionerId: fixture.practitionerId,
        tenantId: fixture.organizationId
      },
      { context }
    );
    await expectOrpcCode(
      call(
        queueRouter.updateStatus,
        { status: "done", tenantId: fixture.organizationId, tokenId: checkIn.token.id },
        { context }
      ),
      "BAD_REQUEST"
    );

    const inConsult = await call(
      queueRouter.startConsult,
      { tenantId: fixture.organizationId, tokenId: checkIn.token.id },
      { context }
    );
    const done = await call(
      queueRouter.updateStatus,
      { status: "done", tenantId: fixture.organizationId, tokenId: checkIn.token.id },
      { context }
    );

    const tokenDate = todayInTimeZone("Asia/Kolkata");
    expect(checkIn.encounter.status).toBe("planned");
    expect(checkIn.token.sequence).toBe(1);
    expect(checkIn.token.status).toBe("waiting");
    expect(checkIn.token.tokenDate).toBe(tokenDate);
    expect(board.map((token) => token.id)).toEqual([checkIn.token.id]);
    expect(repeatedBoard.map((token) => token.id)).toEqual([checkIn.token.id]);
    expect(practitionerDay.map((token) => token.id)).toEqual([checkIn.token.id]);
    expect(inConsult.status).toBe("in_consult");
    expect(done.status).toBe("done");

    const [encounter] = await db
      .select()
      .from(encounters)
      .where(eq(encounters.id, checkIn.encounter.id))
      .limit(1);
    expect(encounter?.status).toBe("finished");
    expect(encounter?.startedAt).toBeInstanceOf(Date);
    expect(encounter?.finishedAt).toBeInstanceOf(Date);

    const audits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.tenantId, fixture.organizationId));

    const boardSearchAudits = audits.filter(
      (audit) => audit.action === "search" && auditDetailProcedure(audit.details) === "queue.board"
    );
    const patientSurfaceBoardAudits = audits.filter(
      (audit) =>
        audit.action === "search" &&
        audit.resourceType === "patient" &&
        auditDetailProcedure(audit.details) === "queue.board"
    );
    expect(boardSearchAudits).toHaveLength(2);
    expect(patientSurfaceBoardAudits).toEqual([]);

    expect(audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "read",
          details: expect.objectContaining({ procedure: "queue.checkIn", resultCount: 1 }),
          resourceId: patient.id,
          resourceType: "patient"
        }),
        expect.objectContaining({
          action: "create",
          details: expect.objectContaining({ procedure: "queue.checkIn" }),
          resourceId: checkIn.encounter.id,
          resourceType: "encounter"
        }),
        expect.objectContaining({
          action: "create",
          details: expect.objectContaining({ procedure: "queue.checkIn", sequence: 1 }),
          resourceId: checkIn.token.id,
          resourceType: "token"
        }),
        expect.objectContaining({
          action: "search",
          details: expect.objectContaining({ procedure: "queue.board", resultCount: 1, tokenDate }),
          resourceType: "token"
        }),
        expect.objectContaining({
          action: "search",
          details: expect.objectContaining({ procedure: "queue.practitionerDay", resultCount: 1 }),
          resourceType: "token"
        }),
        expect.objectContaining({
          action: "update",
          details: expect.objectContaining({
            procedure: "queue.startConsult",
            status: "in_consult"
          }),
          resourceId: checkIn.token.id,
          resourceType: "token"
        }),
        expect.objectContaining({
          action: "update",
          details: expect.objectContaining({ status: "in_progress" }),
          resourceId: checkIn.encounter.id,
          resourceType: "encounter"
        }),
        expect.objectContaining({
          action: "update",
          details: expect.objectContaining({ procedure: "queue.updateStatus", status: "done" }),
          resourceId: checkIn.token.id,
          resourceType: "token"
        }),
        expect.objectContaining({
          action: "update",
          details: expect.objectContaining({ status: "finished" }),
          resourceId: checkIn.encounter.id,
          resourceType: "encounter"
        })
      ])
    );
  });

  it("rejects moving a waiting token into consult through front-desk status updates", async () => {
    const fixture = await createTenantFixture();
    const context = contextFor(fixture);
    const patient = await call(
      patientRouter.quickRegister,
      {
        ageYears: 38,
        fullName: "Arjun Iyer",
        phone: "9999990002",
        sex: "male",
        tenantId: fixture.organizationId
      },
      { context }
    );
    const checkIn = await call(
      queueRouter.checkIn,
      {
        facilityId: fixture.facilityId,
        patientId: patient.id,
        practitionerId: fixture.practitionerId,
        tenantId: fixture.organizationId
      },
      { context }
    );

    const untypedClientStatus = "in_consult" as never;
    await expectOrpcCode(
      call(
        queueRouter.updateStatus,
        {
          status: untypedClientStatus,
          tenantId: fixture.organizationId,
          tokenId: checkIn.token.id
        },
        { context }
      ),
      "BAD_REQUEST"
    );

    const board = await call(
      queueRouter.board,
      {
        facilityId: fixture.facilityId,
        tenantId: fixture.organizationId
      },
      { context }
    );

    expect(board).toEqual([
      expect.objectContaining({
        id: checkIn.token.id,
        status: "waiting"
      })
    ]);
  });

  it("treats updating a token to its current status as a read", async () => {
    const fixture = await createTenantFixture();
    const context = contextFor(fixture);
    const patient = await call(
      patientRouter.quickRegister,
      {
        ageYears: 41,
        fullName: "Dev Nair",
        phone: "9999990001",
        sex: "male",
        tenantId: fixture.organizationId
      },
      { context }
    );
    const checkIn = await call(
      queueRouter.checkIn,
      {
        facilityId: fixture.facilityId,
        patientId: patient.id,
        practitionerId: fixture.practitionerId,
        tenantId: fixture.organizationId
      },
      { context }
    );

    const unchanged = await call(
      queueRouter.updateStatus,
      { status: "waiting", tenantId: fixture.organizationId, tokenId: checkIn.token.id },
      { context }
    );

    expect(unchanged).toMatchObject({
      id: checkIn.token.id,
      sequence: checkIn.token.sequence,
      status: "waiting"
    });

    const audits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.tenantId, fixture.organizationId));

    expect(audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "read",
          details: expect.objectContaining({
            procedure: "queue.updateStatus",
            resultCount: 1
          }),
          resourceId: checkIn.token.id,
          resourceType: "token"
        })
      ])
    );
  });

  it("rejects reassigning active or completed tokens but reassigns waiting tokens", async () => {
    const fixture = await createTenantFixture({ role: "front_desk,practitioner" });
    const context = contextFor(fixture);
    const [secondPractitioner] = await db
      .insert(practitioners)
      .values({
        displayName: `Phase 1 Second Practitioner ${randomUUID()}`,
        registrationCouncil: "NMC",
        registrationNumber: randomUUID(),
        specialties: ["general_medicine"],
        tenantId: fixture.organizationId
      })
      .returning();
    if (!secondPractitioner) {
      throw new Error("Failed to create second test Practitioner");
    }

    const activePatient = await call(
      patientRouter.quickRegister,
      {
        ageYears: 45,
        fullName: "Neel Kapoor",
        phone: "9000000001",
        sex: "male",
        tenantId: fixture.organizationId
      },
      { context }
    );
    const activeCheckIn = await call(
      queueRouter.checkIn,
      {
        facilityId: fixture.facilityId,
        patientId: activePatient.id,
        practitionerId: fixture.practitionerId,
        tenantId: fixture.organizationId
      },
      { context }
    );

    const activeToken = await call(
      queueRouter.startConsult,
      { tenantId: fixture.organizationId, tokenId: activeCheckIn.token.id },
      { context }
    );
    expect(activeToken.status).toBe("in_consult");
    await expectOrpcCode(
      call(
        queueRouter.reassign,
        {
          practitionerId: secondPractitioner.id,
          tenantId: fixture.organizationId,
          tokenId: activeCheckIn.token.id
        },
        { context }
      ),
      "BAD_REQUEST"
    );

    const completedToken = await call(
      queueRouter.updateStatus,
      { status: "done", tenantId: fixture.organizationId, tokenId: activeCheckIn.token.id },
      { context }
    );
    expect(completedToken.status).toBe("done");
    await expectOrpcCode(
      call(
        queueRouter.reassign,
        {
          practitionerId: secondPractitioner.id,
          tenantId: fixture.organizationId,
          tokenId: activeCheckIn.token.id
        },
        { context }
      ),
      "BAD_REQUEST"
    );

    const waitingPatient = await call(
      patientRouter.quickRegister,
      {
        ageYears: 37,
        fullName: "Isha Verma",
        phone: "9000000002",
        sex: "female",
        tenantId: fixture.organizationId
      },
      { context }
    );
    const waitingCheckIn = await call(
      queueRouter.checkIn,
      {
        facilityId: fixture.facilityId,
        patientId: waitingPatient.id,
        practitionerId: fixture.practitionerId,
        tenantId: fixture.organizationId
      },
      { context }
    );
    const reassigned = await call(
      queueRouter.reassign,
      {
        practitionerId: secondPractitioner.id,
        tenantId: fixture.organizationId,
        tokenId: waitingCheckIn.token.id
      },
      { context }
    );

    expect(reassigned.practitionerId).toBe(secondPractitioner.id);
    expect(reassigned.sequence).toBe(1);
    expect(reassigned.status).toBe("waiting");
  });

  it("returns tenant membership for staff and denies non-members", async () => {
    const tenantA = await createTenantFixture({ role: "front_desk" });
    const tenantB = await createTenantFixture({ role: "front_desk" });

    const membership = await call(
      tenantRouter.membership,
      { tenantId: tenantA.organizationId },
      { context: contextFor(tenantA) }
    );

    expect(membership.displayName).toBe(tenantA.organizationDisplayName);
    expect(membership.roles).toContain("front_desk");
    expect(membership.tenantId).toBe(tenantA.organizationId);
    await expectOrpcCode(
      call(
        tenantRouter.membership,
        { tenantId: tenantA.organizationId },
        { context: contextFor(tenantB) }
      ),
      "FORBIDDEN"
    );
  });

  it("denies wrong roles and keeps patient and queue reads tenant-scoped", async () => {
    const tenantA = await createTenantFixture();
    const tenantB = await createTenantFixture({ role: "practitioner" });
    const billing = await createTenantFixture({ role: "billing" });
    const contextA = contextFor(tenantA);
    const contextB = contextFor(tenantB);

    const patient = await call(
      patientRouter.quickRegister,
      {
        ageYears: 29,
        fullName: "Maya Shah",
        phone: "8888880000",
        sex: "female",
        tenantId: tenantA.organizationId
      },
      { context: contextA }
    );
    const checkIn = await call(
      queueRouter.checkIn,
      {
        facilityId: tenantA.facilityId,
        patientId: patient.id,
        practitionerId: tenantA.practitionerId,
        tenantId: tenantA.organizationId
      },
      { context: contextA }
    );

    const hiddenPatient = await call(
      patientRouter.byId,
      { id: patient.id, tenantId: tenantB.organizationId },
      { context: contextB }
    );
    const hiddenSearch = await call(
      patientRouter.searchByPhone,
      { phone: "8888880000", tenantId: tenantB.organizationId },
      { context: contextB }
    );
    const hiddenBoard = await call(
      queueRouter.board,
      { tenantId: tenantB.organizationId },
      { context: contextB }
    );

    expect(hiddenPatient).toBeNull();
    expect(hiddenSearch).toEqual([]);
    expect(hiddenBoard).toEqual([]);
    await expectOrpcCode(
      call(
        patientRouter.quickRegister,
        {
          ageYears: 30,
          fullName: "Denied User",
          phone: "7777770000",
          sex: "unknown",
          tenantId: billing.organizationId
        },
        { context: contextFor(billing) }
      ),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(
        queueRouter.startConsult,
        { tenantId: tenantB.organizationId, tokenId: checkIn.token.id },
        { context: contextB }
      ),
      "NOT_FOUND"
    );
  });
});
