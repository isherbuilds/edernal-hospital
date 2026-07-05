import { db } from "@tsu-stack/db";
import { auditEvents } from "@tsu-stack/db/schema";

import { type TenantOrpcContext } from "#@/lib/context/types";
import { createTenantAudit, type TenantAudit } from "#@/lib/tenancy/audit";

export type TenantTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type TenantTxScope = {
  audit: TenantAudit;
  tenantId: string;
  tx: TenantTransaction;
};

export function withTenantTx<T>(
  context: TenantOrpcContext,
  procedure: string,
  execute: (scope: TenantTxScope) => Promise<T>
) {
  return db.transaction(async (tx) => {
    const audit = createTenantAudit({
      insert: async (record) => {
        await tx.insert(auditEvents).values({
          action: record.action,
          actorUserId: context.session.user.id,
          details: record.details,
          requestId: record.requestId ?? context.requestId,
          resourceId: record.resourceId,
          resourceType: record.resourceType,
          tenantId: context.tenant.id
        });
      },
      procedure
    });

    return execute({
      audit,
      tenantId: context.tenant.id,
      tx
    });
  });
}
