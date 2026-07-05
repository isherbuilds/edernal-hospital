import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { and, asc, eq, sql } from "@tsu-stack/db";
import { encounters, facilities, patients, practitioners, tokens } from "@tsu-stack/db/schema";

import { isUniqueConstraintError } from "#@/lib/db-errors";
import { TenantScopeInputSchema } from "#@/lib/tenancy/scope";
import { type TenantTxScope } from "#@/lib/tenancy/scoped-db";

export const EncounterStatusSchema = z.enum(["planned", "in_progress", "finished"]);
export const TokenStatusSchema = z.enum(["waiting", "in_consult", "done", "skipped"]);

const QueueDateSchema = z.iso.date().optional();

export const CheckInInputSchema = TenantScopeInputSchema.extend({
  facilityId: z.uuid(),
  patientId: z.uuid(),
  practitionerId: z.uuid(),
  tokenDate: QueueDateSchema
});

export const QueueListInputSchema = TenantScopeInputSchema.extend({
  facilityId: z.uuid().optional(),
  practitionerId: z.uuid().optional(),
  tokenDate: QueueDateSchema
});

export const QueueTokenByIdInputSchema = TenantScopeInputSchema.extend({
  tokenId: z.uuid()
});

export const QueueTokenStatusInputSchema = QueueTokenByIdInputSchema.extend({
  status: TokenStatusSchema
});

export const QueueTokenReassignInputSchema = QueueTokenByIdInputSchema.extend({
  practitionerId: z.uuid()
});

export const EncounterOutputSchema = z.object({
  createdAt: z.iso.datetime(),
  facilityId: z.uuid(),
  finishedAt: z.iso.datetime().nullable(),
  id: z.uuid(),
  patientId: z.uuid(),
  practitionerId: z.uuid(),
  startedAt: z.iso.datetime().nullable(),
  status: EncounterStatusSchema,
  updatedAt: z.iso.datetime()
});

export const QueueTokenOutputSchema = z.object({
  createdAt: z.iso.datetime(),
  encounterId: z.uuid(),
  facilityId: z.uuid(),
  id: z.uuid(),
  patientAgeYears: z.number().int().nullable(),
  patientId: z.uuid(),
  patientName: z.string(),
  practitionerId: z.uuid(),
  practitionerName: z.string(),
  sequence: z.number().int(),
  status: TokenStatusSchema,
  tokenDate: z.iso.date(),
  updatedAt: z.iso.datetime()
});

export const CheckInOutputSchema = z.object({
  encounter: EncounterOutputSchema,
  token: QueueTokenOutputSchema
});

export type QueueTokenOutput = z.infer<typeof QueueTokenOutputSchema>;

type EncounterRow = typeof encounters.$inferSelect;
type TokenRow = typeof tokens.$inferSelect;

const DEFAULT_TENANT_TIME_ZONE = "Asia/Kolkata";

function defaultTokenDate(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).format(new Date());
}

function toEncounterOutput(row: EncounterRow): z.infer<typeof EncounterOutputSchema> {
  return EncounterOutputSchema.parse({
    createdAt: row.createdAt.toISOString(),
    facilityId: row.facilityId,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    id: row.id,
    patientId: row.patientId,
    practitionerId: row.practitionerId,
    startedAt: row.startedAt?.toISOString() ?? null,
    status: row.status,
    updatedAt: row.updatedAt.toISOString()
  });
}

function toQueueTokenOutput(row: {
  patientAgeYears: number | null;
  patientName: string;
  practitionerName: string;
  token: TokenRow;
}): QueueTokenOutput {
  return QueueTokenOutputSchema.parse({
    createdAt: row.token.createdAt.toISOString(),
    encounterId: row.token.encounterId,
    facilityId: row.token.facilityId,
    id: row.token.id,
    patientAgeYears: row.patientAgeYears,
    patientId: row.token.patientId,
    patientName: row.patientName,
    practitionerId: row.token.practitionerId,
    practitionerName: row.practitionerName,
    sequence: row.token.sequence,
    status: row.token.status,
    tokenDate: row.token.tokenDate,
    updatedAt: row.token.updatedAt.toISOString()
  });
}

async function nextSequence(scope: TenantTxScope, practitionerId: string, tokenDate: string) {
  const [row] = await scope.tx
    .select({
      sequence: sql<number>`coalesce(max(${tokens.sequence}), 0) + 1`
    })
    .from(tokens)
    .where(
      and(
        eq(tokens.tenantId, scope.tenantId),
        eq(tokens.practitionerId, practitionerId),
        eq(tokens.tokenDate, tokenDate)
      )
    );

  return Number(row?.sequence ?? 1);
}

async function assertTenantReferences(
  scope: TenantTxScope,
  input: { facilityId: string; patientId?: string; practitionerId: string }
) {
  const [facility] = await scope.tx
    .select({ id: facilities.id })
    .from(facilities)
    .where(and(eq(facilities.tenantId, scope.tenantId), eq(facilities.id, input.facilityId)))
    .limit(1);
  const [practitioner] = await scope.tx
    .select({ id: practitioners.id })
    .from(practitioners)
    .where(
      and(eq(practitioners.tenantId, scope.tenantId), eq(practitioners.id, input.practitionerId))
    )
    .limit(1);

  if (!facility || !practitioner) {
    throw new ORPCError("NOT_FOUND", {
      message: "Facility or Practitioner not found in the requested Tenant.",
      status: 404
    });
  }

  if (!input.patientId) {
    return;
  }

  const [patient] = await scope.tx
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.tenantId, scope.tenantId), eq(patients.id, input.patientId)))
    .limit(1);

  if (!patient) {
    throw new ORPCError("NOT_FOUND", {
      message: "Patient not found in the requested Tenant.",
      status: 404
    });
  }
}

async function queueTokenById(scope: TenantTxScope, tokenId: string) {
  const [row] = await scope.tx
    .select({
      patientAgeYears: patients.ageYears,
      patientName: patients.fullName,
      practitionerName: practitioners.displayName,
      token: tokens
    })
    .from(tokens)
    .innerJoin(
      patients,
      and(eq(patients.tenantId, scope.tenantId), eq(patients.id, tokens.patientId))
    )
    .innerJoin(
      practitioners,
      and(eq(practitioners.tenantId, scope.tenantId), eq(practitioners.id, tokens.practitionerId))
    )
    .where(and(eq(tokens.tenantId, scope.tenantId), eq(tokens.id, tokenId)))
    .limit(1);

  return row ? toQueueTokenOutput(row) : null;
}

export async function checkInPatient(
  scope: TenantTxScope,
  input: z.infer<typeof CheckInInputSchema>,
  timeZone = DEFAULT_TENANT_TIME_ZONE
) {
  const tokenDate = input.tokenDate ?? defaultTokenDate(timeZone);
  await assertTenantReferences(scope, input);

  const [encounter] = await scope.tx
    .insert(encounters)
    .values({
      facilityId: input.facilityId,
      patientId: input.patientId,
      practitionerId: input.practitionerId,
      status: "planned",
      tenantId: scope.tenantId
    })
    .returning();

  if (!encounter) {
    throw new Error("Failed to create Encounter");
  }

  const sequence = await nextSequence(scope, input.practitionerId, tokenDate);
  const [token] = await scope.tx
    .insert(tokens)
    .values({
      encounterId: encounter.id,
      facilityId: input.facilityId,
      patientId: input.patientId,
      practitionerId: input.practitionerId,
      sequence,
      status: "waiting",
      tenantId: scope.tenantId,
      tokenDate
    })
    .returning()
    .catch((error: unknown) => {
      if (isUniqueConstraintError(error, "tokens_tenant_id_practitioner_id_date_sequence_unique")) {
        throw new ORPCError("CONFLICT", {
          message: "Token sequence already exists for this Practitioner and date. Retry check-in.",
          status: 409
        });
      }

      throw error;
    });

  if (!token) {
    throw new Error("Failed to create Queue token");
  }

  await scope.audit.read({
    resourceId: input.patientId,
    resourceType: "patient",
    resultCount: 1
  });
  await scope.audit.write({
    action: "create",
    details: {
      status: encounter.status
    },
    resourceId: encounter.id,
    resourceType: "encounter"
  });
  await scope.audit.write({
    action: "create",
    details: {
      sequence,
      status: token.status,
      tokenDate
    },
    resourceId: token.id,
    resourceType: "token"
  });

  const queueToken = await queueTokenById(scope, token.id);
  if (!queueToken) {
    throw new Error("Failed to read created Queue token");
  }

  return CheckInOutputSchema.parse({
    encounter: toEncounterOutput(encounter),
    token: queueToken
  });
}

export async function listQueue(
  scope: TenantTxScope,
  input: z.infer<typeof QueueListInputSchema>,
  timeZone = DEFAULT_TENANT_TIME_ZONE
) {
  const tokenDate = input.tokenDate ?? defaultTokenDate(timeZone);
  const filters = [eq(tokens.tenantId, scope.tenantId), eq(tokens.tokenDate, tokenDate)];
  if (input.facilityId) {
    filters.push(eq(tokens.facilityId, input.facilityId));
  }
  if (input.practitionerId) {
    filters.push(eq(tokens.practitionerId, input.practitionerId));
  }

  const rows = await scope.tx
    .select({
      patientAgeYears: patients.ageYears,
      patientName: patients.fullName,
      practitionerName: practitioners.displayName,
      token: tokens
    })
    .from(tokens)
    .innerJoin(
      patients,
      and(eq(patients.tenantId, scope.tenantId), eq(patients.id, tokens.patientId))
    )
    .innerJoin(
      practitioners,
      and(eq(practitioners.tenantId, scope.tenantId), eq(practitioners.id, tokens.practitionerId))
    )
    .where(and(...filters))
    .orderBy(asc(tokens.practitionerId), asc(tokens.sequence));

  await scope.audit.search({
    details: { tokenDate },
    resourceType: "token",
    resultCount: rows.length
  });

  return rows.map(toQueueTokenOutput);
}

function assertTokenStatusTransition(current: TokenRow["status"], next: TokenRow["status"]) {
  const isAllowed =
    (current === "waiting" && (next === "in_consult" || next === "skipped")) ||
    (current === "in_consult" && next === "done") ||
    (current === "skipped" && next === "waiting");

  if (!isAllowed) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Cannot move Queue token from ${current} to ${next}.`,
      status: 400
    });
  }
}

export async function updateTokenStatus(
  scope: TenantTxScope,
  input: z.infer<typeof QueueTokenStatusInputSchema>
) {
  const [currentToken] = await scope.tx
    .select()
    .from(tokens)
    .where(and(eq(tokens.tenantId, scope.tenantId), eq(tokens.id, input.tokenId)))
    .limit(1);

  if (!currentToken) {
    throw new ORPCError("NOT_FOUND", {
      message: "Queue token not found in the requested Tenant.",
      status: 404
    });
  }

  if (currentToken.status === input.status) {
    const queueToken = await queueTokenById(scope, currentToken.id);
    if (!queueToken) {
      throw new Error("Failed to read unchanged Queue token");
    }
    await scope.audit.read({
      resourceId: currentToken.id,
      resourceType: "token",
      resultCount: 1
    });
    return queueToken;
  }

  assertTokenStatusTransition(currentToken.status, input.status);

  const now = new Date();
  const encounterPatch =
    input.status === "in_consult"
      ? { startedAt: now, status: "in_progress" as const }
      : input.status === "done"
        ? { finishedAt: now, status: "finished" as const }
        : input.status === "waiting"
          ? { finishedAt: null, startedAt: null, status: "planned" as const }
          : null;

  const [token] = await scope.tx
    .update(tokens)
    .set({ status: input.status })
    .where(
      and(
        eq(tokens.tenantId, scope.tenantId),
        eq(tokens.id, input.tokenId),
        eq(tokens.status, currentToken.status),
        eq(tokens.practitionerId, currentToken.practitionerId),
        eq(tokens.sequence, currentToken.sequence)
      )
    )
    .returning();

  if (!token) {
    throw new ORPCError("CONFLICT", {
      message: "Queue token status changed. Reload and retry.",
      status: 409
    });
  }

  if (encounterPatch) {
    const [encounter] = await scope.tx
      .update(encounters)
      .set(encounterPatch)
      .where(and(eq(encounters.tenantId, scope.tenantId), eq(encounters.id, token.encounterId)))
      .returning({ id: encounters.id });

    if (encounter) {
      await scope.audit.write({
        action: "update",
        details: {
          status: encounterPatch.status
        },
        resourceId: token.encounterId,
        resourceType: "encounter"
      });
    }
  }

  await scope.audit.write({
    action: "update",
    details: {
      status: input.status
    },
    resourceId: token.id,
    resourceType: "token"
  });

  const queueToken = await queueTokenById(scope, token.id);
  if (!queueToken) {
    throw new Error("Failed to read updated Queue token");
  }

  return queueToken;
}

export async function reassignToken(
  scope: TenantTxScope,
  input: z.infer<typeof QueueTokenReassignInputSchema>
) {
  const current = await queueTokenById(scope, input.tokenId);
  if (!current) {
    throw new ORPCError("NOT_FOUND", {
      message: "Queue token not found in the requested Tenant.",
      status: 404
    });
  }

  if (current.status !== "waiting" && current.status !== "skipped") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Only waiting or skipped Queue tokens can be reassigned.",
      status: 400
    });
  }

  await assertTenantReferences(scope, {
    facilityId: current.facilityId,
    practitionerId: input.practitionerId
  });
  const sequence = await nextSequence(scope, input.practitionerId, current.tokenDate);

  const [token] = await scope.tx
    .update(tokens)
    .set({
      practitionerId: input.practitionerId,
      sequence,
      status: "waiting"
    })
    .where(
      and(
        eq(tokens.tenantId, scope.tenantId),
        eq(tokens.id, input.tokenId),
        eq(tokens.status, current.status),
        eq(tokens.practitionerId, current.practitionerId),
        eq(tokens.sequence, current.sequence)
      )
    )
    .returning()
    .catch((error: unknown) => {
      if (isUniqueConstraintError(error, "tokens_tenant_id_practitioner_id_date_sequence_unique")) {
        throw new ORPCError("CONFLICT", {
          message:
            "Token sequence already exists for this Practitioner and date. Retry reassignment.",
          status: 409
        });
      }

      throw error;
    });

  if (!token) {
    throw new ORPCError("CONFLICT", {
      message: "Queue token changed. Reload and retry.",
      status: 409
    });
  }

  const [encounter] = await scope.tx
    .update(encounters)
    .set({
      finishedAt: null,
      practitionerId: input.practitionerId,
      startedAt: null,
      status: "planned"
    })
    .where(and(eq(encounters.tenantId, scope.tenantId), eq(encounters.id, token.encounterId)))
    .returning({ id: encounters.id });

  if (encounter) {
    await scope.audit.write({
      action: "update",
      details: {
        status: "planned"
      },
      resourceId: token.encounterId,
      resourceType: "encounter"
    });
  }

  await scope.audit.write({
    action: "update",
    details: {
      sequence,
      status: "waiting"
    },
    resourceId: token.id,
    resourceType: "token"
  });

  const queueToken = await queueTokenById(scope, token.id);
  if (!queueToken) {
    throw new Error("Failed to read reassigned Queue token");
  }

  return queueToken;
}
