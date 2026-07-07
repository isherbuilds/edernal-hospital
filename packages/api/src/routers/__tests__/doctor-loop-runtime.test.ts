import { randomUUID } from "node:crypto";
import process from "node:process";

import { call } from "@orpc/server";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { type AuthSession } from "@tsu-stack/auth/index";
import { PHI_FIELD_BANLIST } from "@tsu-stack/core/phi";
import { and, asc, checkIsDbReady, db, eq, inArray, sql } from "@tsu-stack/db";
import {
  auditEvents,
  consultNotes,
  encounters,
  facilities,
  formularyItems,
  member,
  organization,
  patients,
  prescriptionLines,
  prescriptions,
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
  organizationLegalName: string;
  practitionerId: string;
  userId: string;
};

type EncounterFixture = TenantFixture & {
  encounterId: string;
  patientAllergies: string;
  patientId: string;
  tokenId: string;
};

type TenantUser = {
  practitionerId?: string;
  userId: string;
};

type AuditRow = typeof auditEvents.$inferSelect;

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

const bannedAuditDetailKeys = Object.fromEntries(
  [
    ...PHI_FIELD_BANLIST,
    "advice",
    "complaints",
    "diagnosisCode",
    "diagnosisText",
    "dose",
    "duration",
    "findings",
    "followUp",
    "frequency",
    "instructions",
    "medicationText",
    "vitals"
  ].map((key) => [key, true] as const)
) as Record<string, true>;
const allowedAuditDetailStringKeys: Record<string, true> = {
  artifactStatus: true,
  newStatus: true,
  previousStatus: true,
  procedure: true,
  scope: true,
  status: true
};
const allowedAuditDetailStringValues: Record<string, true> = {
  "consult.printPrescription": true,
  "consult.saveNote": true,
  "consult.savePrescription": true,
  "consult.signNote": true,
  "consult.signPrescription": true,
  "consult.supersedeNote": true,
  "consult.supersedePrescription": true,
  "consult.workspace": true,
  consult_workspace: true,
  preliminary: true,
  signed: true,
  superseded: true
};

function remember(fixture: TenantFixture) {
  created.organizationIds.add(fixture.organizationId);
  created.userIds.add(fixture.userId);
}

function rememberUser(userId: string) {
  created.userIds.add(userId);
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

async function deleteClinicalArtifactsForOrganizations(organizationIds: string[]) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1783186182781)`);
    await tx.execute(
      sql`ALTER TABLE "consult_notes" DISABLE TRIGGER "consult_notes_prevent_signed_delete"`
    );
    await tx.execute(
      sql`ALTER TABLE "prescriptions" DISABLE TRIGGER "prescriptions_prevent_signed_delete"`
    );
    await tx.execute(
      sql`ALTER TABLE "prescription_lines" DISABLE TRIGGER "prescription_lines_prevent_signed_parent_mutation"`
    );

    try {
      await tx
        .delete(prescriptionLines)
        .where(inArray(prescriptionLines.tenantId, organizationIds));
      await tx
        .delete(prescriptions)
        .where(
          and(
            inArray(prescriptions.tenantId, organizationIds),
            sql`${prescriptions.supersedesPrescriptionId} IS NOT NULL`
          )
        );
      await tx.delete(prescriptions).where(inArray(prescriptions.tenantId, organizationIds));
      await tx
        .delete(consultNotes)
        .where(
          and(
            inArray(consultNotes.tenantId, organizationIds),
            sql`${consultNotes.supersedesConsultNoteId} IS NOT NULL`
          )
        );
      await tx.delete(consultNotes).where(inArray(consultNotes.tenantId, organizationIds));
      await tx.delete(formularyItems).where(inArray(formularyItems.tenantId, organizationIds));
    } finally {
      await tx.execute(
        sql`ALTER TABLE "prescription_lines" ENABLE TRIGGER "prescription_lines_prevent_signed_parent_mutation"`
      );
      await tx.execute(
        sql`ALTER TABLE "prescriptions" ENABLE TRIGGER "prescriptions_prevent_signed_delete"`
      );
      await tx.execute(
        sql`ALTER TABLE "consult_notes" ENABLE TRIGGER "consult_notes_prevent_signed_delete"`
      );
    }
  });
}

async function cleanup() {
  const organizationIds = [...created.organizationIds];
  const userIds = [...created.userIds];

  if (organizationIds.length > 0) {
    await deleteAuditEventsForOrganizations(organizationIds);
    await deleteClinicalArtifactsForOrganizations(organizationIds);
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

function roleSetIncludes(role: string, expected: string) {
  return role
    .split(",")
    .map((value) => value.trim())
    .includes(expected);
}

async function createTenantFixture(input: { role?: string } = {}): Promise<TenantFixture> {
  const role = input.role ?? "practitioner";
  const suffix = randomUUID();
  const organizationId = `org_${suffix}`;
  const userId = `user_${suffix}`;
  const organizationDisplayName = `Doctor Loop Tenant ${suffix}`;
  const organizationLegalName = `Doctor Loop Tenant ${suffix} Private Limited`;

  await db.insert(authUser).values({
    email: `${suffix}@doctor-loop.test`,
    emailVerified: true,
    id: userId,
    name: `Doctor Loop ${role}`
  });

  await db.insert(organization).values({
    defaultTimezone: "Asia/Kolkata",
    displayName: organizationDisplayName,
    id: organizationId,
    legalName: organizationLegalName,
    name: `Doctor Loop ${suffix}`,
    slug: `doctor-loop-${suffix}`
  });

  await db.insert(member).values({
    displayNameOverride: `Doctor Loop ${role}`,
    employeeCode: `DL-${role}`,
    id: `member_${suffix}`,
    organizationId,
    role,
    userId
  });

  const [facility] = await db
    .insert(facilities)
    .values({
      address: {
        city: "Bengaluru",
        country: "IN",
        line1: "1 Pilot Road",
        postalCode: "560001",
        state: "KA"
      },
      code: "MAIN",
      gstin: `29ABCDE${suffix.slice(0, 4).toUpperCase()}1Z5`,
      name: `Doctor Loop Facility ${suffix}`,
      tenantId: organizationId
    })
    .returning();
  if (!facility) {
    throw new Error("Failed to create test Facility");
  }

  const [practitioner] = await db
    .insert(practitioners)
    .values({
      displayName: `Doctor Loop Practitioner ${suffix}`,
      registrationCouncil: "NMC",
      registrationNumber: suffix,
      specialties: ["general_medicine"],
      tenantId: organizationId,
      userId: roleSetIncludes(role, "practitioner") ? userId : null
    })
    .returning();
  if (!practitioner) {
    throw new Error("Failed to create test Practitioner");
  }

  const fixture = {
    facilityId: facility.id,
    organizationDisplayName,
    organizationId,
    organizationLegalName,
    practitionerId: practitioner.id,
    userId
  };
  remember(fixture);
  return fixture;
}

async function createTenantUser(
  fixture: TenantFixture,
  input: { linkPractitioner?: boolean; role: string }
): Promise<TenantUser> {
  const suffix = randomUUID();
  const userId = `user_${suffix}`;

  await db.insert(authUser).values({
    email: `${suffix}@doctor-loop.test`,
    emailVerified: true,
    id: userId,
    name: `Doctor Loop ${input.role}`
  });
  rememberUser(userId);

  await db.insert(member).values({
    displayNameOverride: `Doctor Loop ${input.role}`,
    employeeCode: `DL-${input.role}-${suffix.slice(0, 8)}`,
    id: `member_${suffix}`,
    organizationId: fixture.organizationId,
    role: input.role,
    userId
  });

  if (!input.linkPractitioner) {
    return { userId };
  }

  const [practitioner] = await db
    .insert(practitioners)
    .values({
      displayName: `Doctor Loop Alternate Practitioner ${suffix}`,
      registrationCouncil: "NMC",
      registrationNumber: `alt_${suffix}`,
      specialties: ["general_medicine"],
      tenantId: fixture.organizationId,
      userId
    })
    .returning();
  if (!practitioner) {
    throw new Error("Failed to create alternate Practitioner");
  }

  return { practitionerId: practitioner.id, userId };
}

function contextFor(user: TenantUser): OrpcContext {
  return {
    logger,
    session: {
      session: {
        activeOrganizationId: null,
        id: `session_${randomUUID()}`,
        userId: user.userId
      },
      user: {
        id: user.userId
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

async function createConsultEncounterFixture(): Promise<EncounterFixture> {
  const fixture = await createTenantFixture({ role: "practitioner" });
  const suffix = randomUUID();

  const [patient] = await db
    .insert(patients)
    .values({
      ageYears: 42,
      allergies: "Known allergy text for print payload",
      fullName: `Doctor Loop Patient ${suffix}`,
      phone: "+91 90000 10000",
      phoneNormalized: "9000010000",
      sex: "female",
      tenantId: fixture.organizationId
    })
    .returning();
  if (!patient) {
    throw new Error("Failed to create test Patient");
  }

  const [encounter] = await db
    .insert(encounters)
    .values({
      facilityId: fixture.facilityId,
      patientId: patient.id,
      practitionerId: fixture.practitionerId,
      startedAt: new Date(),
      status: "in_progress",
      tenantId: fixture.organizationId
    })
    .returning();
  if (!encounter) {
    throw new Error("Failed to create test Encounter");
  }

  const [token] = await db
    .insert(tokens)
    .values({
      encounterId: encounter.id,
      facilityId: fixture.facilityId,
      patientId: patient.id,
      practitionerId: fixture.practitionerId,
      sequence: 1,
      status: "in_consult",
      tenantId: fixture.organizationId,
      tokenDate: todayInTimeZone("Asia/Kolkata")
    })
    .returning();
  if (!token) {
    throw new Error("Failed to create test Token");
  }

  return {
    ...fixture,
    encounterId: encounter.id,
    patientAllergies: patient.allergies,
    patientId: patient.id,
    tokenId: token.id
  };
}

async function createFormularyItem(fixture: TenantFixture) {
  const [item] = await db
    .insert(formularyItems)
    .values({
      defaultDoseText: "Dose text",
      form: "tablet",
      name: `Formulary ${randomUUID()}`,
      strength: "500 mg",
      tenantId: fixture.organizationId
    })
    .returning();
  if (!item) {
    throw new Error("Failed to create test Formulary Item");
  }
  return item;
}

function baseNoteInput(fixture: EncounterFixture) {
  return {
    advice: "Advice text",
    complaints: "Complaint text",
    diagnosisCode: "DX-1",
    diagnosisText: "Diagnosis text",
    encounterId: fixture.encounterId,
    findings: "Finding text",
    followUp: "Follow-up text",
    tenantId: fixture.organizationId,
    vitals: {
      pulseBpm: 72,
      spo2Percent: 98
    }
  };
}

function replacementNoteInput(fixture: EncounterFixture) {
  return {
    advice: "Replacement advice text",
    complaints: "Replacement complaint text",
    diagnosisCode: "DX-2",
    diagnosisText: "Replacement diagnosis text",
    encounterId: fixture.encounterId,
    findings: "Replacement finding text",
    followUp: "Replacement follow-up text",
    tenantId: fixture.organizationId,
    vitals: {
      pulseBpm: 76,
      spo2Percent: 97
    }
  };
}

function prescriptionInput(
  fixture: EncounterFixture,
  formularyItemId: string,
  freeTextMedication: string
) {
  return {
    encounterId: fixture.encounterId,
    lines: [
      {
        dose: "1 tablet",
        duration: "3 days",
        formularyItemId,
        frequency: "twice daily",
        instructions: "after food",
        medicationText: "Formulary medication snapshot"
      },
      {
        dose: "5 ml",
        duration: "2 days",
        frequency: "nightly",
        instructions: "as directed",
        medicationText: freeTextMedication
      }
    ],
    tenantId: fixture.organizationId
  };
}

function replacementPrescriptionInput(fixture: EncounterFixture) {
  return {
    encounterId: fixture.encounterId,
    lines: [
      {
        dose: "1 capsule",
        duration: "5 days",
        frequency: "once daily",
        instructions: "with water",
        medicationText: "Replacement medication snapshot"
      }
    ],
    tenantId: fixture.organizationId
  };
}

function auditDetailProcedure(details: unknown): string | null {
  if (!details || typeof details !== "object" || !("procedure" in details)) {
    return null;
  }

  const procedure = details.procedure;
  return typeof procedure === "string" ? procedure : null;
}

async function auditsForTenant(tenantId: string): Promise<AuditRow[]> {
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.tenantId, tenantId))
    .orderBy(asc(auditEvents.occurredAt));
}

function expectConsultAuditDetailsArePhiFree(audits: AuditRow[]) {
  const consultAudits = audits.filter((audit) =>
    auditDetailProcedure(audit.details)?.startsWith("consult.")
  );
  expect(consultAudits.length).toBeGreaterThan(0);
  for (const audit of consultAudits) {
    expectAuditDetailValue(audit.details);
  }
}

function expectAuditDetailValue(value: unknown, keyPath: string[] = []) {
  if (value == null || typeof value === "boolean" || typeof value === "number") {
    return;
  }

  if (typeof value === "string") {
    const key = keyPath.at(-1);
    expect(key ? allowedAuditDetailStringKeys[key] === true : false).toBe(true);
    expect(allowedAuditDetailStringValues[value] === true).toBe(true);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      expectAuditDetailValue(item, keyPath);
    }
    return;
  }

  expect(typeof value).toBe("object");
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    expect(bannedAuditDetailKeys[key] === true).toBe(false);
    if (typeof nested === "string") {
      expect(allowedAuditDetailStringKeys[key] === true).toBe(true);
    }
    expectAuditDetailValue(nested, [...keyPath, key]);
  }
}

async function checkDoctorLoopSchemaReady(): Promise<boolean> {
  try {
    await db
      .select({ id: consultNotes.id, tenantId: consultNotes.tenantId })
      .from(consultNotes)
      .limit(0);
    await db
      .select({ id: prescriptions.id, tenantId: prescriptions.tenantId })
      .from(prescriptions)
      .limit(0);
    await db
      .select({ id: prescriptionLines.id, tenantId: prescriptionLines.tenantId })
      .from(prescriptionLines)
      .limit(0);
    await db
      .select({ id: formularyItems.id, tenantId: formularyItems.tenantId })
      .from(formularyItems)
      .limit(0);
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
  throw new Error("Doctor loop runtime tests require a reachable DATABASE_URL in CI");
}
const isSchemaReady = isDbReady && (await checkDoctorLoopSchemaReady());
if (isDbReady && !isSchemaReady && process.env.CI) {
  throw new Error(
    "Doctor loop runtime tests require the Phase 2 migrated DATABASE_URL schema in CI"
  );
}
const describeWithDb = isSchemaReady ? describe : describe.skip;

describeWithDb("doctor loop consult runtime", () => {
  it("opens a practitioner workspace with patient allergies, current artifacts, and a PHI-free read audit", async () => {
    const fixture = await createConsultEncounterFixture();
    const context = contextFor(fixture);

    const workspace = await call(
      appRouter.consult.workspace,
      { encounterId: fixture.encounterId, tenantId: fixture.organizationId },
      { context }
    );

    expect(workspace.encounter).toEqual(
      expect.objectContaining({
        id: fixture.encounterId,
        patientId: fixture.patientId,
        practitionerId: fixture.practitionerId,
        status: "in_progress"
      })
    );
    expect(workspace.patient).toEqual(
      expect.objectContaining({
        allergies: fixture.patientAllergies,
        id: fixture.patientId
      })
    );
    expect(workspace.practitioner).toEqual(
      expect.objectContaining({
        id: fixture.practitionerId,
        registrationCouncil: "NMC"
      })
    );
    expect(workspace.token).toEqual(expect.objectContaining({ id: fixture.tokenId }));
    expect(workspace.consultNote).toBeNull();
    expect(workspace.prescription).toBeNull();
    expect(workspace.canWriteClinical).toBe(true);

    const audits = await auditsForTenant(fixture.organizationId);
    expect(audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "read",
          details: expect.objectContaining({ procedure: "consult.workspace" }),
          resourceId: fixture.encounterId,
          resourceType: "encounter"
        })
      ])
    );
    expectConsultAuditDetailsArePhiFree(audits);
  });

  it("rejects front-desk users before exposing the consult workspace", async () => {
    expect.assertions(1);
    const fixture = await createConsultEncounterFixture();
    const frontDesk = await createTenantUser(fixture, { role: "front_desk" });

    await expectOrpcCode(
      call(
        appRouter.consult.workspace,
        { encounterId: fixture.encounterId, tenantId: fixture.organizationId },
        { context: contextFor(frontDesk) }
      ),
      "FORBIDDEN"
    );
  });

  it("marks the workspace read-only for non-owner practitioners and hospital admins", async () => {
    expect.assertions(4);
    const fixture = await createConsultEncounterFixture();
    const alternatePractitioner = await createTenantUser(fixture, {
      linkPractitioner: true,
      role: "practitioner"
    });
    const hospitalAdmin = await createTenantUser(fixture, { role: "hospital_admin" });

    const alternateWorkspace = await call(
      appRouter.consult.workspace,
      { encounterId: fixture.encounterId, tenantId: fixture.organizationId },
      { context: contextFor(alternatePractitioner) }
    );
    expect(alternateWorkspace.encounter.id).toBe(fixture.encounterId);
    expect(alternateWorkspace.canWriteClinical).toBe(false);

    const adminWorkspace = await call(
      appRouter.consult.workspace,
      { encounterId: fixture.encounterId, tenantId: fixture.organizationId },
      { context: contextFor(hospitalAdmin) }
    );
    expect(adminWorkspace.encounter.id).toBe(fixture.encounterId);
    expect(adminWorkspace.canWriteClinical).toBe(false);
  });

  it("requires the encounter practitioner identity to save preliminary artifacts", async () => {
    expect.assertions(3);
    const fixture = await createConsultEncounterFixture();
    const alternatePractitioner = await createTenantUser(fixture, {
      linkPractitioner: true,
      role: "practitioner"
    });
    const hospitalAdmin = await createTenantUser(fixture, { role: "hospital_admin" });

    await expectOrpcCode(
      call(appRouter.consult.saveNote, baseNoteInput(fixture), {
        context: contextFor(alternatePractitioner)
      }),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(appRouter.consult.savePrescription, replacementPrescriptionInput(fixture), {
        context: contextFor(alternatePractitioner)
      }),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(appRouter.consult.saveNote, baseNoteInput(fixture), {
        context: contextFor(hospitalAdmin)
      }),
      "FORBIDDEN"
    );
  });

  it("denies hospital-admin-only clinical writes even when linked to the encounter practitioner", async () => {
    expect.assertions(1);
    const fixture = await createConsultEncounterFixture();
    const ownerContext = contextFor(fixture);
    const hospitalAdmin = await createTenantUser(fixture, { role: "hospital_admin" });
    const createdNote = await call(appRouter.consult.saveNote, baseNoteInput(fixture), {
      context: ownerContext
    });

    await db
      .update(practitioners)
      .set({ userId: hospitalAdmin.userId })
      .where(
        and(
          eq(practitioners.tenantId, fixture.organizationId),
          eq(practitioners.id, fixture.practitionerId)
        )
      );

    await expectOrpcCode(
      call(
        appRouter.consult.signNote,
        { consultNoteId: createdNote.id, tenantId: fixture.organizationId },
        { context: contextFor(hospitalAdmin) }
      ),
      "FORBIDDEN"
    );
  });

  it("saves, updates, signs, raw-mutation-protects, and supersedes consult notes with PHI-free audit details", async () => {
    const fixture = await createConsultEncounterFixture();
    const context = contextFor(fixture);

    const createdNote = await call(appRouter.consult.saveNote, baseNoteInput(fixture), { context });
    const updatedNote = await call(
      appRouter.consult.saveNote,
      { ...baseNoteInput(fixture), advice: "Updated advice text", diagnosisCode: null },
      { context }
    );
    const signedNote = await call(
      appRouter.consult.signNote,
      { consultNoteId: createdNote.id, tenantId: fixture.organizationId },
      { context }
    );

    expect(createdNote).toEqual(
      expect.objectContaining({
        complaints: "Complaint text",
        encounterId: fixture.encounterId,
        patientId: fixture.patientId,
        practitionerId: fixture.practitionerId,
        signedAt: null,
        signedByUserId: null,
        status: "preliminary"
      })
    );
    expect(updatedNote).toEqual(
      expect.objectContaining({
        advice: "Updated advice text",
        diagnosisCode: null,
        id: createdNote.id,
        status: "preliminary"
      })
    );
    expect(signedNote).toEqual(
      expect.objectContaining({
        id: createdNote.id,
        signedAt: expect.any(String),
        signedByUserId: fixture.userId,
        status: "signed"
      })
    );

    await expectOrpcCode(
      call(appRouter.consult.saveNote, replacementNoteInput(fixture), { context }),
      "CONFLICT"
    );
    await expect(
      db.execute(
        sql`UPDATE "consult_notes" SET "complaints" = 'blocked raw mutation' WHERE "id" = ${signedNote.id}`
      )
    ).rejects.toThrow(/Failed query/);

    const replacementNote = await call(
      appRouter.consult.supersedeNote,
      { consultNoteId: signedNote.id, tenantId: fixture.organizationId },
      { context }
    );
    expect(replacementNote).toEqual(
      expect.objectContaining({
        complaints: "Complaint text",
        advice: "Updated advice text",
        encounterId: fixture.encounterId,
        signedAt: null,
        signedByUserId: null,
        status: "preliminary",
        supersedesConsultNoteId: signedNote.id
      })
    );

    const [oldNote] = await db
      .select()
      .from(consultNotes)
      .where(eq(consultNotes.id, signedNote.id))
      .limit(1);
    expect(oldNote?.status).toBe("superseded");
    expect(oldNote?.signedByUserId).toBe(fixture.userId);

    const workspace = await call(
      appRouter.consult.workspace,
      { encounterId: fixture.encounterId, tenantId: fixture.organizationId },
      { context }
    );
    expect(workspace.consultNote).toEqual(
      expect.objectContaining({
        id: replacementNote.id,
        status: "preliminary",
        supersedesConsultNoteId: signedNote.id
      })
    );

    const audits = await auditsForTenant(fixture.organizationId);
    expect(audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "create",
          details: expect.objectContaining({ procedure: "consult.saveNote" }),
          resourceId: createdNote.id,
          resourceType: "consult_note"
        }),
        expect.objectContaining({
          action: "update",
          details: expect.objectContaining({ procedure: "consult.saveNote" }),
          resourceId: createdNote.id,
          resourceType: "consult_note"
        }),
        expect.objectContaining({
          action: "sign",
          details: expect.objectContaining({ procedure: "consult.signNote", status: "signed" }),
          resourceId: createdNote.id,
          resourceType: "consult_note"
        }),
        expect.objectContaining({
          action: "update",
          details: expect.objectContaining({
            procedure: "consult.supersedeNote",
            status: "superseded"
          }),
          resourceId: signedNote.id,
          resourceType: "consult_note"
        }),
        expect.objectContaining({
          action: "create",
          details: expect.objectContaining({ procedure: "consult.supersedeNote" }),
          resourceId: replacementNote.id,
          resourceType: "consult_note"
        })
      ])
    );
    expectConsultAuditDetailsArePhiFree(audits);
  });

  it("requires the encounter practitioner identity to sign and supersede notes", async () => {
    const fixture = await createConsultEncounterFixture();
    const ownerContext = contextFor(fixture);
    const alternatePractitioner = await createTenantUser(fixture, {
      linkPractitioner: true,
      role: "practitioner"
    });
    const hospitalAdmin = await createTenantUser(fixture, { role: "hospital_admin" });

    const createdNote = await call(appRouter.consult.saveNote, baseNoteInput(fixture), {
      context: ownerContext
    });

    await expectOrpcCode(
      call(
        appRouter.consult.signNote,
        { consultNoteId: createdNote.id, tenantId: fixture.organizationId },
        { context: contextFor(alternatePractitioner) }
      ),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(
        appRouter.consult.signNote,
        { consultNoteId: createdNote.id, tenantId: fixture.organizationId },
        { context: contextFor(hospitalAdmin) }
      ),
      "FORBIDDEN"
    );

    const signedNote = await call(
      appRouter.consult.signNote,
      { consultNoteId: createdNote.id, tenantId: fixture.organizationId },
      { context: ownerContext }
    );

    await expectOrpcCode(
      call(
        appRouter.consult.supersedeNote,
        { consultNoteId: signedNote.id, tenantId: fixture.organizationId },
        { context: contextFor(alternatePractitioner) }
      ),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(
        appRouter.consult.supersedeNote,
        { consultNoteId: signedNote.id, tenantId: fixture.organizationId },
        { context: contextFor(hospitalAdmin) }
      ),
      "FORBIDDEN"
    );

    const [noteAfterDeniedAttempts] = await db
      .select()
      .from(consultNotes)
      .where(eq(consultNotes.id, signedNote.id))
      .limit(1);
    expect(noteAfterDeniedAttempts?.status).toBe("signed");
  });

  it("saves replacement prescription lines, requires signed-only print, raw-protects signed prescriptions, prints, and supersedes with PHI-free audits", async () => {
    const fixture = await createConsultEncounterFixture();
    const context = contextFor(fixture);
    const formularyItem = await createFormularyItem(fixture);

    const createdPrescription = await call(
      appRouter.consult.savePrescription,
      prescriptionInput(fixture, formularyItem.id, "Free-text medication snapshot"),
      { context }
    );
    const replacedPrescription = await call(
      appRouter.consult.savePrescription,
      replacementPrescriptionInput(fixture),
      { context }
    );

    expect(createdPrescription).toEqual(
      expect.objectContaining({
        encounterId: fixture.encounterId,
        patientId: fixture.patientId,
        practitionerId: fixture.practitionerId,
        signedAt: null,
        signedByUserId: null,
        status: "preliminary"
      })
    );
    expect(createdPrescription.lines).toEqual([
      expect.objectContaining({
        formularyItemId: formularyItem.id,
        medicationText: "Formulary medication snapshot",
        sequence: 1
      }),
      expect.objectContaining({
        formularyItemId: null,
        medicationText: "Free-text medication snapshot",
        sequence: 2
      })
    ]);
    expect(replacedPrescription).toEqual(
      expect.objectContaining({
        id: createdPrescription.id,
        status: "preliminary"
      })
    );
    expect(replacedPrescription.lines).toEqual([
      expect.objectContaining({
        medicationText: "Replacement medication snapshot",
        sequence: 1
      })
    ]);

    await expectOrpcCode(
      call(
        appRouter.consult.printPrescription,
        { prescriptionId: createdPrescription.id, tenantId: fixture.organizationId },
        { context }
      ),
      "BAD_REQUEST"
    );

    const signedPrescription = await call(
      appRouter.consult.signPrescription,
      { prescriptionId: createdPrescription.id, tenantId: fixture.organizationId },
      { context }
    );
    expect(signedPrescription).toEqual(
      expect.objectContaining({
        id: createdPrescription.id,
        signedAt: expect.any(String),
        signedByUserId: fixture.userId,
        status: "signed"
      })
    );

    await expectOrpcCode(
      call(appRouter.consult.savePrescription, replacementPrescriptionInput(fixture), { context }),
      "CONFLICT"
    );

    const [signedLine] = await db
      .select()
      .from(prescriptionLines)
      .where(eq(prescriptionLines.prescriptionId, signedPrescription.id))
      .limit(1);
    expect(signedLine).toEqual(
      expect.objectContaining({ medicationText: "Replacement medication snapshot" })
    );

    await expect(
      db.execute(
        sql`UPDATE "prescriptions" SET "signed_by_user_id" = 'blocked raw prescription mutation' WHERE "id" = ${signedPrescription.id}`
      )
    ).rejects.toThrow(/Failed query/);
    await expect(
      db.execute(
        sql`UPDATE "prescription_lines" SET "medication_text" = 'blocked raw line mutation' WHERE "id" = ${signedLine?.id}`
      )
    ).rejects.toThrow(/Failed query/);

    const printed = await call(
      appRouter.consult.printPrescription,
      { prescriptionId: signedPrescription.id, tenantId: fixture.organizationId },
      { context }
    );
    expect(printed).toEqual(
      expect.objectContaining({
        facility: expect.objectContaining({
          address: expect.objectContaining({ line1: "1 Pilot Road" }),
          gstin: expect.any(String),
          name: expect.any(String)
        }),
        patient: expect.objectContaining({
          allergies: fixture.patientAllergies,
          id: fixture.patientId
        }),
        practitioner: expect.objectContaining({
          id: fixture.practitionerId,
          registrationCouncil: "NMC",
          registrationNumber: expect.any(String)
        }),
        prescription: expect.objectContaining({
          id: signedPrescription.id,
          status: "signed"
        }),
        tenant: expect.objectContaining({
          displayName: fixture.organizationDisplayName,
          legalName: fixture.organizationLegalName
        })
      })
    );
    expect(printed.prescription.lines).toEqual([
      expect.objectContaining({
        medicationText: "Replacement medication snapshot",
        sequence: 1
      })
    ]);

    const replacementPrescription = await call(
      appRouter.consult.supersedePrescription,
      { prescriptionId: signedPrescription.id, tenantId: fixture.organizationId },
      { context }
    );
    expect(replacementPrescription).toEqual(
      expect.objectContaining({
        encounterId: fixture.encounterId,
        signedAt: null,
        signedByUserId: null,
        status: "preliminary",
        supersedesPrescriptionId: signedPrescription.id
      })
    );
    expect(replacementPrescription.lines).toEqual([
      expect.objectContaining({
        medicationText: "Replacement medication snapshot",
        sequence: 1
      })
    ]);

    const [oldPrescription] = await db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.id, signedPrescription.id))
      .limit(1);
    expect(oldPrescription?.status).toBe("superseded");
    await expectOrpcCode(
      call(
        appRouter.consult.printPrescription,
        { prescriptionId: signedPrescription.id, tenantId: fixture.organizationId },
        { context }
      ),
      "BAD_REQUEST"
    );

    const audits = await auditsForTenant(fixture.organizationId);
    expect(audits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "create",
          details: expect.objectContaining({ procedure: "consult.savePrescription" }),
          resourceId: createdPrescription.id,
          resourceType: "prescription"
        }),
        expect.objectContaining({
          action: "update",
          details: expect.objectContaining({ procedure: "consult.savePrescription" }),
          resourceId: createdPrescription.id,
          resourceType: "prescription"
        }),
        expect.objectContaining({
          action: "sign",
          details: expect.objectContaining({
            procedure: "consult.signPrescription",
            status: "signed"
          }),
          resourceId: signedPrescription.id,
          resourceType: "prescription"
        }),
        expect.objectContaining({
          action: "print",
          details: expect.objectContaining({ procedure: "consult.printPrescription" }),
          resourceId: signedPrescription.id,
          resourceType: "prescription"
        }),
        expect.objectContaining({
          action: "update",
          details: expect.objectContaining({
            procedure: "consult.supersedePrescription",
            status: "superseded"
          }),
          resourceId: signedPrescription.id,
          resourceType: "prescription"
        }),
        expect.objectContaining({
          action: "create",
          details: expect.objectContaining({ procedure: "consult.supersedePrescription" }),
          resourceId: replacementPrescription.id,
          resourceType: "prescription"
        })
      ])
    );
    expectConsultAuditDetailsArePhiFree(audits);
  });

  it("requires the encounter practitioner identity to sign prescriptions", async () => {
    expect.assertions(2);
    const fixture = await createConsultEncounterFixture();
    const context = contextFor(fixture);
    const alternatePractitioner = await createTenantUser(fixture, {
      linkPractitioner: true,
      role: "practitioner"
    });
    const hospitalAdmin = await createTenantUser(fixture, { role: "hospital_admin" });

    const createdPrescription = await call(
      appRouter.consult.savePrescription,
      replacementPrescriptionInput(fixture),
      { context }
    );

    await expectOrpcCode(
      call(
        appRouter.consult.signPrescription,
        { prescriptionId: createdPrescription.id, tenantId: fixture.organizationId },
        { context: contextFor(alternatePractitioner) }
      ),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(
        appRouter.consult.signPrescription,
        { prescriptionId: createdPrescription.id, tenantId: fixture.organizationId },
        { context: contextFor(hospitalAdmin) }
      ),
      "FORBIDDEN"
    );
  });

  it("denies cross-tenant consult operations before leaking workspace, note, prescription, or print data", async () => {
    expect.assertions(8);
    const ownerFixture = await createConsultEncounterFixture();
    const outsiderFixture = await createTenantFixture({ role: "practitioner" });
    const outsiderContext = contextFor(outsiderFixture);
    const ownerContext = contextFor(ownerFixture);
    const ownerNote = await call(appRouter.consult.saveNote, baseNoteInput(ownerFixture), {
      context: ownerContext
    });
    const ownerPrescription = await call(
      appRouter.consult.savePrescription,
      replacementPrescriptionInput(ownerFixture),
      { context: ownerContext }
    );
    const signedOwnerNote = await call(
      appRouter.consult.signNote,
      { consultNoteId: ownerNote.id, tenantId: ownerFixture.organizationId },
      { context: ownerContext }
    );
    const signedOwnerPrescription = await call(
      appRouter.consult.signPrescription,
      { prescriptionId: ownerPrescription.id, tenantId: ownerFixture.organizationId },
      { context: ownerContext }
    );

    await expectOrpcCode(
      call(
        appRouter.consult.workspace,
        { encounterId: ownerFixture.encounterId, tenantId: ownerFixture.organizationId },
        { context: outsiderContext }
      ),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(appRouter.consult.saveNote, baseNoteInput(ownerFixture), { context: outsiderContext }),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(
        appRouter.consult.signNote,
        { consultNoteId: signedOwnerNote.id, tenantId: ownerFixture.organizationId },
        { context: outsiderContext }
      ),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(appRouter.consult.savePrescription, replacementPrescriptionInput(ownerFixture), {
        context: outsiderContext
      }),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(
        appRouter.consult.signPrescription,
        { prescriptionId: signedOwnerPrescription.id, tenantId: ownerFixture.organizationId },
        { context: outsiderContext }
      ),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(
        appRouter.consult.supersedeNote,
        { consultNoteId: signedOwnerNote.id, tenantId: ownerFixture.organizationId },
        { context: outsiderContext }
      ),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(
        appRouter.consult.supersedePrescription,
        { prescriptionId: signedOwnerPrescription.id, tenantId: ownerFixture.organizationId },
        { context: outsiderContext }
      ),
      "FORBIDDEN"
    );
    await expectOrpcCode(
      call(
        appRouter.consult.printPrescription,
        { prescriptionId: signedOwnerPrescription.id, tenantId: ownerFixture.organizationId },
        { context: outsiderContext }
      ),
      "FORBIDDEN"
    );
  });
});
