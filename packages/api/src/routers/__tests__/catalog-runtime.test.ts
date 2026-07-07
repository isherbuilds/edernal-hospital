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
  formularyItems,
  member,
  noteTemplates,
  organization,
  patients,
  practitioners,
  tokens,
  user as authUser
} from "@tsu-stack/db/schema";
import { type RequestLogger } from "@tsu-stack/logger/server";

import { type OrpcContext } from "#@/lib/context/types";
import { appRouter } from "#@/routers/index";

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
    await db.delete(noteTemplates).where(inArray(noteTemplates.tenantId, organizationIds));
    await db.delete(formularyItems).where(inArray(formularyItems.tenantId, organizationIds));
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
  const role = input.role ?? "hospital_admin";
  const suffix = randomUUID();
  const organizationId = `org_${suffix}`;
  const userId = `user_${suffix}`;
  const organizationDisplayName = `Catalog Tenant ${suffix}`;

  await db.insert(authUser).values({
    email: `${suffix}@catalog.test`,
    emailVerified: true,
    id: userId,
    name: `Catalog ${role}`
  });

  await db.insert(organization).values({
    defaultTimezone: "Asia/Kolkata",
    displayName: organizationDisplayName,
    id: organizationId,
    legalName: `Catalog Tenant ${suffix} Private Limited`,
    name: `Catalog ${suffix}`,
    slug: `catalog-${suffix}`
  });

  await db.insert(member).values({
    displayNameOverride: `Catalog ${role}`,
    employeeCode: `CAT-${role}`,
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
      name: `Catalog Facility ${suffix}`,
      tenantId: organizationId
    })
    .returning();
  if (!facility) {
    throw new Error("Failed to create test Facility");
  }

  const [practitioner] = await db
    .insert(practitioners)
    .values({
      displayName: `Catalog Practitioner ${suffix}`,
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

function auditDetailProcedure(details: unknown): string | null {
  if (!details || typeof details !== "object" || !("procedure" in details)) {
    return null;
  }

  const procedure = details.procedure;
  return typeof procedure === "string" ? procedure : null;
}

async function checkCatalogSchemaReady(): Promise<boolean> {
  try {
    await db
      .select({ id: formularyItems.id, tenantId: formularyItems.tenantId })
      .from(formularyItems)
      .limit(0);
    await db
      .select({ id: noteTemplates.id, tenantId: noteTemplates.tenantId })
      .from(noteTemplates)
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
  throw new Error("Catalog runtime tests require a reachable DATABASE_URL in CI");
}
const isSchemaReady = isDbReady && (await checkCatalogSchemaReady());
if (isDbReady && !isSchemaReady && process.env.CI) {
  throw new Error(
    "Catalog runtime tests require the Phase 2 catalog migrated DATABASE_URL schema in CI"
  );
}
const describeWithDb = isSchemaReady ? describe : describe.skip;

describeWithDb("catalog runtime", () => {
  it("creates, lists, searches, updates, and audits formulary items", async () => {
    const fixture = await createTenantFixture({ role: "hospital_admin" });
    const context = contextFor(fixture);

    const paracetamol = await call(
      appRouter.formulary.create,
      {
        defaultDoseText: "1 tablet",
        form: "tablet",
        name: "Paracetamol",
        strength: "500 mg",
        tenantId: fixture.organizationId
      },
      { context }
    );
    const amoxicillin = await call(
      appRouter.formulary.create,
      {
        defaultDoseText: "1 capsule",
        form: "capsule",
        name: "Amoxicillin",
        strength: "500 mg",
        tenantId: fixture.organizationId
      },
      { context }
    );

    const matchingSearch = await call(
      appRouter.formulary.search,
      { query: " para ", tenantId: fixture.organizationId },
      { context }
    );
    const initialList = await call(
      appRouter.formulary.list,
      { tenantId: fixture.organizationId },
      { context }
    );
    const inactive = await call(
      appRouter.formulary.update,
      { formularyItemId: paracetamol.id, status: "inactive", tenantId: fixture.organizationId },
      { context }
    );
    const activeSearch = await call(
      appRouter.formulary.search,
      { tenantId: fixture.organizationId },
      { context }
    );
    const adminList = await call(
      appRouter.formulary.list,
      { tenantId: fixture.organizationId },
      { context }
    );

    expect(paracetamol).toEqual({
      defaultDoseText: "1 tablet",
      form: "tablet",
      id: paracetamol.id,
      name: "Paracetamol",
      status: "active",
      strength: "500 mg"
    });
    expect(matchingSearch.map((item) => item.id)).toEqual([paracetamol.id]);
    expect(initialList.map((item) => item.name)).toEqual(["Amoxicillin", "Paracetamol"]);
    expect(inactive.status).toBe("inactive");
    expect(activeSearch.map((item) => item.id)).toEqual([amoxicillin.id]);
    const actualAdminItemIds = adminList.map((item) => item.id);
    actualAdminItemIds.sort();
    const expectedAdminItemIds = [amoxicillin.id, paracetamol.id];
    expectedAdminItemIds.sort();
    expect(actualAdminItemIds).toEqual(expectedAdminItemIds);

    const audits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.tenantId, fixture.organizationId));

    const queryAudit = audits.find(
      (audit) =>
        audit.action === "search" && auditDetailProcedure(audit.details) === "formulary.search"
    );
    expect(queryAudit?.details).not.toEqual(expect.objectContaining({ query: expect.any(String) }));
    expect(audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "create",
          details: expect.objectContaining({ procedure: "formulary.create" }),
          resourceId: paracetamol.id,
          resourceType: "formulary_item"
        }),
        expect.objectContaining({
          action: "search",
          details: expect.objectContaining({ procedure: "formulary.search", resultCount: 1 }),
          resourceType: "formulary_item"
        }),
        expect.objectContaining({
          action: "search",
          details: expect.objectContaining({ procedure: "formulary.list", resultCount: 2 }),
          resourceType: "formulary_item"
        }),
        expect.objectContaining({
          action: "update",
          details: expect.objectContaining({ procedure: "formulary.update" }),
          resourceId: paracetamol.id,
          resourceType: "formulary_item"
        })
      ])
    );
  });

  it("returns CONFLICT for duplicate formulary natural keys", async () => {
    expect.assertions(1);
    const fixture = await createTenantFixture({ role: "hospital_admin" });
    const context = contextFor(fixture);
    const input = {
      form: "tablet",
      name: "Cetirizine",
      strength: "10 mg",
      tenantId: fixture.organizationId
    };

    await call(appRouter.formulary.create, input, { context });
    await expectOrpcCode(call(appRouter.formulary.create, input, { context }), "CONFLICT");
  });

  it("returns CONFLICT when catalog updates collide with unique keys", async () => {
    expect.assertions(2);
    const fixture = await createTenantFixture({ role: "hospital_admin" });
    const context = contextFor(fixture);

    const firstItem = await call(
      appRouter.formulary.create,
      { form: "tablet", name: "Amlodipine", strength: "5 mg", tenantId: fixture.organizationId },
      { context }
    );
    const secondItem = await call(
      appRouter.formulary.create,
      { form: "tablet", name: "Amlodipine", strength: "10 mg", tenantId: fixture.organizationId },
      { context }
    );
    await expectOrpcCode(
      call(
        appRouter.formulary.update,
        {
          form: firstItem.form,
          formularyItemId: secondItem.id,
          name: firstItem.name,
          strength: firstItem.strength,
          tenantId: fixture.organizationId
        },
        { context }
      ),
      "CONFLICT"
    );

    const firstTemplate = await call(
      appRouter.noteTemplate.create,
      { name: "Fever / URI", tenantId: fixture.organizationId },
      { context }
    );
    const secondTemplate = await call(
      appRouter.noteTemplate.create,
      { name: "Hypertension follow-up", tenantId: fixture.organizationId },
      { context }
    );
    await expectOrpcCode(
      call(
        appRouter.noteTemplate.update,
        {
          name: firstTemplate.name,
          noteTemplateId: secondTemplate.id,
          tenantId: fixture.organizationId
        },
        { context }
      ),
      "CONFLICT"
    );
  });

  it("denies formulary wrong-role and cross-tenant access", async () => {
    expect.assertions(6);
    const adminA = await createTenantFixture({ role: "hospital_admin" });
    const adminB = await createTenantFixture({ role: "hospital_admin" });
    const frontDesk = await createTenantFixture({ role: "front_desk" });
    const practitioner = await createTenantFixture({ role: "practitioner" });

    await expectOrpcCode(
      call(
        appRouter.formulary.search,
        { query: "para", tenantId: frontDesk.organizationId },
        { context: contextFor(frontDesk) }
      ),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(
        appRouter.formulary.create,
        { name: "Paracetamol", tenantId: practitioner.organizationId },
        { context: contextFor(practitioner) }
      ),
      "FORBIDDEN"
    );

    const contextA = contextFor(adminA);
    await expectOrpcCode(
      call(appRouter.formulary.search, { tenantId: adminB.organizationId }, { context: contextA }),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(appRouter.formulary.list, { tenantId: adminB.organizationId }, { context: contextA }),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(
        appRouter.formulary.create,
        { name: "Cross Tenant", tenantId: adminB.organizationId },
        { context: contextA }
      ),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(
        appRouter.formulary.update,
        { formularyItemId: randomUUID(), status: "inactive", tenantId: adminB.organizationId },
        { context: contextA }
      ),
      "FORBIDDEN"
    );
  });

  it("creates, lists, updates, and audits note templates", async () => {
    const fixture = await createTenantFixture({ role: "hospital_admin" });
    const context = contextFor(fixture);

    const fever = await call(
      appRouter.noteTemplate.create,
      {
        advice: "Fluids and rest",
        complaints: "Fever with URI symptoms",
        diagnosisText: "Viral URI",
        findings: "Stable vitals",
        followUp: "Review if fever persists",
        name: "Fever / URI",
        specialty: "General Medicine",
        tenantId: fixture.organizationId
      },
      { context }
    );
    const gastro = await call(
      appRouter.noteTemplate.create,
      {
        advice: "Oral rehydration",
        complaints: "Loose stools",
        diagnosisText: "Acute gastroenteritis",
        findings: "No dehydration signs",
        followUp: "Review in 48 hours if needed",
        name: "Acute gastroenteritis",
        tenantId: fixture.organizationId
      },
      { context }
    );

    const activeList = await call(
      appRouter.noteTemplate.list,
      { tenantId: fixture.organizationId },
      { context }
    );
    const inactive = await call(
      appRouter.noteTemplate.update,
      { noteTemplateId: gastro.id, status: "inactive", tenantId: fixture.organizationId },
      { context }
    );
    const activeOnly = await call(
      appRouter.noteTemplate.list,
      { tenantId: fixture.organizationId },
      { context }
    );
    const includeInactive = await call(
      appRouter.noteTemplate.list,
      { includeInactive: true, tenantId: fixture.organizationId },
      { context }
    );

    expect(fever).toEqual({
      advice: "Fluids and rest",
      complaints: "Fever with URI symptoms",
      diagnosisText: "Viral URI",
      findings: "Stable vitals",
      followUp: "Review if fever persists",
      id: fever.id,
      name: "Fever / URI",
      specialty: "General Medicine",
      status: "active"
    });
    expect(activeList.map((template) => template.name)).toEqual([
      "Acute gastroenteritis",
      "Fever / URI"
    ]);
    expect(inactive.status).toBe("inactive");
    expect(activeOnly.map((template) => template.id)).toEqual([fever.id]);
    const actualTemplateIds = includeInactive.map((template) => template.id);
    actualTemplateIds.sort();
    const expectedTemplateIds = [fever.id, gastro.id];
    expectedTemplateIds.sort();
    expect(actualTemplateIds).toEqual(expectedTemplateIds);

    const audits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.tenantId, fixture.organizationId));

    expect(audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "create",
          details: expect.objectContaining({ procedure: "noteTemplate.create" }),
          resourceId: fever.id,
          resourceType: "note_template"
        }),
        expect.objectContaining({
          action: "search",
          details: expect.objectContaining({ procedure: "noteTemplate.list", resultCount: 2 }),
          resourceType: "note_template"
        }),
        expect.objectContaining({
          action: "update",
          details: expect.objectContaining({ procedure: "noteTemplate.update" }),
          resourceId: gastro.id,
          resourceType: "note_template"
        })
      ])
    );
  });

  it("requires hospital_admin to include inactive note templates", async () => {
    const admin = await createTenantFixture({ role: "hospital_admin" });
    const practitioner = await createTenantFixture({ role: "practitioner" });
    const adminContext = contextFor(admin);

    const template = await call(
      appRouter.noteTemplate.create,
      { name: "Hypertension follow-up", tenantId: admin.organizationId },
      { context: adminContext }
    );
    await call(
      appRouter.noteTemplate.update,
      { noteTemplateId: template.id, status: "inactive", tenantId: admin.organizationId },
      { context: adminContext }
    );

    await expectOrpcCode(
      call(
        appRouter.noteTemplate.list,
        { includeInactive: true, tenantId: practitioner.organizationId },
        { context: contextFor(practitioner) }
      ),
      "FORBIDDEN"
    );
    const includeInactive = await call(
      appRouter.noteTemplate.list,
      { includeInactive: true, tenantId: admin.organizationId },
      { context: adminContext }
    );
    expect(includeInactive.map((item) => item.id)).toEqual([template.id]);
  });

  it("returns CONFLICT for duplicate note template names", async () => {
    expect.assertions(1);
    const fixture = await createTenantFixture({ role: "hospital_admin" });
    const context = contextFor(fixture);
    const input = { name: "Fever / URI", tenantId: fixture.organizationId };

    await call(appRouter.noteTemplate.create, input, { context });
    await expectOrpcCode(call(appRouter.noteTemplate.create, input, { context }), "CONFLICT");
  });

  it("returns NOT_FOUND for missing catalog updates in the requested tenant", async () => {
    expect.assertions(2);
    const fixture = await createTenantFixture({ role: "hospital_admin" });
    const context = contextFor(fixture);

    await expectOrpcCode(
      call(
        appRouter.formulary.update,
        { formularyItemId: randomUUID(), status: "inactive", tenantId: fixture.organizationId },
        { context }
      ),
      "NOT_FOUND"
    );
    await expectOrpcCode(
      call(
        appRouter.noteTemplate.update,
        { noteTemplateId: randomUUID(), status: "inactive", tenantId: fixture.organizationId },
        { context }
      ),
      "NOT_FOUND"
    );
  });

  it("denies note template wrong-role and cross-tenant access", async () => {
    expect.assertions(5);
    const adminA = await createTenantFixture({ role: "hospital_admin" });
    const adminB = await createTenantFixture({ role: "hospital_admin" });
    const frontDesk = await createTenantFixture({ role: "front_desk" });
    const practitioner = await createTenantFixture({ role: "practitioner" });

    await expectOrpcCode(
      call(
        appRouter.noteTemplate.list,
        { tenantId: frontDesk.organizationId },
        { context: contextFor(frontDesk) }
      ),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(
        appRouter.noteTemplate.create,
        { name: "Fever / URI", tenantId: practitioner.organizationId },
        { context: contextFor(practitioner) }
      ),
      "FORBIDDEN"
    );

    const contextA = contextFor(adminA);
    await expectOrpcCode(
      call(appRouter.noteTemplate.list, { tenantId: adminB.organizationId }, { context: contextA }),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(
        appRouter.noteTemplate.create,
        { name: "Cross Tenant", tenantId: adminB.organizationId },
        { context: contextA }
      ),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(
        appRouter.noteTemplate.update,
        { noteTemplateId: randomUUID(), status: "inactive", tenantId: adminB.organizationId },
        { context: contextA }
      ),
      "FORBIDDEN"
    );
  });
});
