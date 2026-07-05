import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { STAFF_ROLE } from "@tsu-stack/core/auth";

import { tenantProcedure } from "#@/lib/procedures/factory";
import { withTenantTx } from "#@/lib/tenancy/scoped-db";

import {
  CheckInInputSchema,
  CheckInOutputSchema,
  checkInPatient,
  listQueue,
  QueueListInputSchema,
  QueueTokenOutputSchema,
  QueueTokenReassignInputSchema,
  QueueTokenStatusInputSchema,
  reassignToken,
  updateTokenStatus
} from "./queries";

const queueReaderRoles = [
  STAFF_ROLE.FRONT_DESK,
  STAFF_ROLE.PRACTITIONER,
  STAFF_ROLE.HOSPITAL_ADMIN
] as const;

const queueManagerRoles = [STAFF_ROLE.FRONT_DESK, STAFF_ROLE.HOSPITAL_ADMIN] as const;
const CHECK_IN_SEQUENCE_ATTEMPTS = 3;

export const queueRouter = {
  board: tenantProcedure(QueueListInputSchema, queueReaderRoles)
    .route({
      description: "List Queue tokens for the board in the requested Tenant",
      method: "GET"
    })
    .output(z.array(QueueTokenOutputSchema))
    .handler(({ context, input }) =>
      withTenantTx(context, "queue.board", (scope) =>
        listQueue(scope, input, context.tenant.profile.defaultTimezone ?? undefined)
      )
    ),
  checkIn: tenantProcedure(CheckInInputSchema, queueManagerRoles)
    .route({
      description: "Create an Encounter and issue a daily Practitioner token",
      method: "POST"
    })
    .output(CheckInOutputSchema)
    .handler(async ({ context, input }) => {
      // A CONFLICT aborts the transaction, so retry the whole withTenantTx call instead of retrying inside it.
      for (let attempt = 1; ; attempt += 1) {
        try {
          return await withTenantTx(context, "queue.checkIn", (scope) =>
            checkInPatient(scope, input, context.tenant.profile.defaultTimezone ?? undefined)
          );
        } catch (error) {
          if (
            !(error instanceof ORPCError) ||
            error.code !== "CONFLICT" ||
            attempt >= CHECK_IN_SEQUENCE_ATTEMPTS
          ) {
            throw error;
          }
        }
      }
    }),
  practitionerDay: tenantProcedure(QueueListInputSchema.required({ practitionerId: true }), [
    STAFF_ROLE.PRACTITIONER,
    STAFF_ROLE.HOSPITAL_ADMIN,
    STAFF_ROLE.FRONT_DESK
  ])
    .route({
      description: "List a Practitioner's tokens for the selected day",
      method: "GET"
    })
    .output(z.array(QueueTokenOutputSchema))
    .handler(({ context, input }) =>
      withTenantTx(context, "queue.practitionerDay", (scope) =>
        listQueue(scope, input, context.tenant.profile.defaultTimezone ?? undefined)
      )
    ),
  reassign: tenantProcedure(QueueTokenReassignInputSchema, queueManagerRoles)
    .route({
      description: "Reassign a waiting Queue token to another Practitioner",
      method: "POST"
    })
    .output(QueueTokenOutputSchema)
    .handler(({ context, input }) =>
      withTenantTx(context, "queue.reassign", (scope) => reassignToken(scope, input))
    ),
  startConsult: tenantProcedure(QueueTokenStatusInputSchema.omit({ status: true }), [
    STAFF_ROLE.PRACTITIONER,
    STAFF_ROLE.HOSPITAL_ADMIN
  ])
    .route({
      description: "Move a Queue token into consult and start its Encounter",
      method: "POST"
    })
    .output(QueueTokenOutputSchema)
    .handler(({ context, input }) =>
      withTenantTx(context, "queue.startConsult", (scope) =>
        updateTokenStatus(scope, { ...input, status: "in_consult" })
      )
    ),
  updateStatus: tenantProcedure(QueueTokenStatusInputSchema, queueManagerRoles)
    .route({
      description: "Update Queue token status for front-desk queue management",
      method: "POST"
    })
    .output(QueueTokenOutputSchema)
    .handler(({ context, input }) =>
      withTenantTx(context, "queue.updateStatus", (scope) => updateTokenStatus(scope, input))
    )
};
