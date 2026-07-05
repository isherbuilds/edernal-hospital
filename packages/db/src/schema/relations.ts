import { defineRelations } from "drizzle-orm";

import { auditEvents } from "#@/schema/audit.schema";
import { organization, user } from "#@/schema/auth.schema";
import { encounters, patientIdentifiers, patients, tokens } from "#@/schema/clinical.schema";
import { facilities, practitioners } from "#@/schema/tenancy.schema";

const schema = {
  auditEvents,
  encounters,
  facilities,
  organization,
  patientIdentifiers,
  patients,
  practitioners,
  tokens,
  user
};

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
    encounters: {
      facility: r.one.facilities({
        from: r.encounters.facilityId,
        to: r.facilities.id
      }),
      patient: r.one.patients({
        from: r.encounters.patientId,
        to: r.patients.id
      }),
      practitioner: r.one.practitioners({
        from: r.encounters.practitionerId,
        to: r.practitioners.id
      }),
      tenant: r.one.organization({
        from: r.encounters.tenantId,
        to: r.organization.id
      }),
      token: r.one.tokens({
        from: [r.encounters.tenantId, r.encounters.id],
        optional: true,
        to: [r.tokens.tenantId, r.tokens.encounterId]
      })
    },
    patientIdentifiers: {
      patient: r.one.patients({
        from: r.patientIdentifiers.patientId,
        to: r.patients.id
      }),
      tenant: r.one.organization({
        from: r.patientIdentifiers.tenantId,
        to: r.organization.id
      })
    },
    patients: {
      encounters: r.many.encounters({
        from: r.patients.id,
        to: r.encounters.patientId
      }),
      identifiers: r.many.patientIdentifiers({
        from: r.patients.id,
        to: r.patientIdentifiers.patientId
      }),
      tenant: r.one.organization({
        from: r.patients.tenantId,
        to: r.organization.id
      }),
      tokens: r.many.tokens({
        from: r.patients.id,
        to: r.tokens.patientId
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
    },
    tokens: {
      encounter: r.one.encounters({
        from: [r.tokens.tenantId, r.tokens.encounterId],
        to: [r.encounters.tenantId, r.encounters.id]
      }),
      facility: r.one.facilities({
        from: r.tokens.facilityId,
        to: r.facilities.id
      }),
      patient: r.one.patients({
        from: r.tokens.patientId,
        to: r.patients.id
      }),
      practitioner: r.one.practitioners({
        from: r.tokens.practitionerId,
        to: r.practitioners.id
      }),
      tenant: r.one.organization({
        from: r.tokens.tenantId,
        to: r.organization.id
      })
    }
  };
});
