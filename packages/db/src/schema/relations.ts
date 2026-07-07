import { defineRelations } from "drizzle-orm";

import { auditEvents } from "#@/schema/audit.schema";
import { organization, user } from "#@/schema/auth.schema";
import {
  consultNotes,
  encounters,
  formularyItems,
  noteTemplates,
  patientIdentifiers,
  patients,
  prescriptionLines,
  prescriptions,
  tokens
} from "#@/schema/clinical.schema";
import { facilities, practitioners } from "#@/schema/tenancy.schema";

const schema = {
  auditEvents,
  consultNotes,
  encounters,
  facilities,
  formularyItems,
  noteTemplates,
  organization,
  patientIdentifiers,
  patients,
  prescriptionLines,
  prescriptions,
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
    consultNotes: {
      encounter: r.one.encounters({
        from: [r.consultNotes.tenantId, r.consultNotes.encounterId],
        to: [r.encounters.tenantId, r.encounters.id]
      }),
      patient: r.one.patients({
        from: [r.consultNotes.tenantId, r.consultNotes.patientId],
        to: [r.patients.tenantId, r.patients.id]
      }),
      practitioner: r.one.practitioners({
        from: [r.consultNotes.tenantId, r.consultNotes.practitionerId],
        to: [r.practitioners.tenantId, r.practitioners.id]
      }),
      supersedesConsultNote: r.one.consultNotes({
        alias: "supersedesConsultNote",
        from: [r.consultNotes.tenantId, r.consultNotes.supersedesConsultNoteId],
        optional: true,
        to: [r.consultNotes.tenantId, r.consultNotes.id]
      }),
      tenant: r.one.organization({
        from: r.consultNotes.tenantId,
        to: r.organization.id
      })
    },
    facilities: {
      tenant: r.one.organization({
        from: r.facilities.tenantId,
        to: r.organization.id
      })
    },
    formularyItems: {
      prescriptionLines: r.many.prescriptionLines({
        from: [r.formularyItems.tenantId, r.formularyItems.id],
        to: [r.prescriptionLines.tenantId, r.prescriptionLines.formularyItemId]
      }),
      tenant: r.one.organization({
        from: r.formularyItems.tenantId,
        to: r.organization.id
      })
    },
    encounters: {
      consultNotes: r.many.consultNotes({
        from: [r.encounters.tenantId, r.encounters.id],
        to: [r.consultNotes.tenantId, r.consultNotes.encounterId]
      }),
      facility: r.one.facilities({
        from: r.encounters.facilityId,
        to: r.facilities.id
      }),
      patient: r.one.patients({
        from: r.encounters.patientId,
        to: r.patients.id
      }),
      prescriptions: r.many.prescriptions({
        from: [r.encounters.tenantId, r.encounters.id],
        to: [r.prescriptions.tenantId, r.prescriptions.encounterId]
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
    noteTemplates: {
      tenant: r.one.organization({
        from: r.noteTemplates.tenantId,
        to: r.organization.id
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
      consultNotes: r.many.consultNotes({
        from: [r.patients.tenantId, r.patients.id],
        to: [r.consultNotes.tenantId, r.consultNotes.patientId]
      }),
      encounters: r.many.encounters({
        from: r.patients.id,
        to: r.encounters.patientId
      }),
      identifiers: r.many.patientIdentifiers({
        from: r.patients.id,
        to: r.patientIdentifiers.patientId
      }),
      prescriptions: r.many.prescriptions({
        from: [r.patients.tenantId, r.patients.id],
        to: [r.prescriptions.tenantId, r.prescriptions.patientId]
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
    prescriptionLines: {
      formularyItem: r.one.formularyItems({
        from: [r.prescriptionLines.tenantId, r.prescriptionLines.formularyItemId],
        optional: true,
        to: [r.formularyItems.tenantId, r.formularyItems.id]
      }),
      prescription: r.one.prescriptions({
        from: [r.prescriptionLines.tenantId, r.prescriptionLines.prescriptionId],
        to: [r.prescriptions.tenantId, r.prescriptions.id]
      }),
      tenant: r.one.organization({
        from: r.prescriptionLines.tenantId,
        to: r.organization.id
      })
    },
    prescriptions: {
      encounter: r.one.encounters({
        from: [r.prescriptions.tenantId, r.prescriptions.encounterId],
        to: [r.encounters.tenantId, r.encounters.id]
      }),
      lines: r.many.prescriptionLines({
        from: [r.prescriptions.tenantId, r.prescriptions.id],
        to: [r.prescriptionLines.tenantId, r.prescriptionLines.prescriptionId]
      }),
      patient: r.one.patients({
        from: [r.prescriptions.tenantId, r.prescriptions.patientId],
        to: [r.patients.tenantId, r.patients.id]
      }),
      practitioner: r.one.practitioners({
        from: [r.prescriptions.tenantId, r.prescriptions.practitionerId],
        to: [r.practitioners.tenantId, r.practitioners.id]
      }),
      supersedesPrescription: r.one.prescriptions({
        alias: "supersedesPrescription",
        from: [r.prescriptions.tenantId, r.prescriptions.supersedesPrescriptionId],
        optional: true,
        to: [r.prescriptions.tenantId, r.prescriptions.id]
      }),
      tenant: r.one.organization({
        from: r.prescriptions.tenantId,
        to: r.organization.id
      })
    },
    practitioners: {
      consultNotes: r.many.consultNotes({
        from: [r.practitioners.tenantId, r.practitioners.id],
        to: [r.consultNotes.tenantId, r.consultNotes.practitionerId]
      }),
      prescriptions: r.many.prescriptions({
        from: [r.practitioners.tenantId, r.practitioners.id],
        to: [r.prescriptions.tenantId, r.prescriptions.practitionerId]
      }),
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
