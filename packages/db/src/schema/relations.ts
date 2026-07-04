import { defineRelations } from "drizzle-orm";

import { auditEvents } from "#@/schema/audit.schema";
import { organization, user } from "#@/schema/auth.schema";
import { facilities, practitioners } from "#@/schema/tenancy.schema";

const schema = { auditEvents, facilities, organization, practitioners, user };

export const relations = defineRelations(schema, (r) => {
  return {
    auditEvents: {
      tenant: r.one.organization({
        from: r.auditEvents.tenantId,
        to: r.organization.id
      })
    },
    facilities: {
      tenant: r.one.organization({
        from: r.facilities.tenantId,
        to: r.organization.id
      })
    },
    practitioners: {
      tenant: r.one.organization({
        from: r.practitioners.tenantId,
        to: r.organization.id
      }),
      user: r.one.user({
        from: r.practitioners.userId,
        optional: true,
        to: r.user.id
      })
    }
  };
});
