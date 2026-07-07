import { relations as authRelations } from "#@/schema/auth.schema";
import { relations } from "#@/schema/relations";

export {
  account,
  invitation,
  member,
  organization,
  session,
  user,
  verification
} from "#@/schema/auth.schema";
export { auditEvents } from "#@/schema/audit.schema";
export {
  clinicalArtifactStatus,
  consultNotes,
  encounterStatus,
  encounters,
  formularyItems,
  noteTemplates,
  patientIdentifiers,
  patients,
  patientSex,
  prescriptionLines,
  prescriptions,
  tokenStatus,
  tokens
} from "#@/schema/clinical.schema";
export { facilities, practitioners, tenantResourceStatus } from "#@/schema/tenancy.schema";

export const databaseRelations = { ...relations, ...authRelations };
