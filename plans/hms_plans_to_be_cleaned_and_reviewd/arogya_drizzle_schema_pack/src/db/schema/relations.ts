import { relations } from "drizzle-orm";
import { user, session, account, twoFactor, organization, member, invitation, team, teamMember, passkey, apikey } from "./auth.generated";
import {
  tenants,
  facilities,
  departments,
  practitioners,
  practitionerRoles,
  userTenantProfiles,
  roleDefinitions,
  rolePermissions,
  userRoleAssignments,
  tenantKeyVersions,
} from "./iam";
import {
  fhirResourceVersions,
  fhirResourceCurrent,
  patientProjections,
  patientIdentifiers,
  encounterProjections,
  documentReferences,
  objectBlobs,
  patientConsents,
} from "./fhir";
import { appointmentBooks, appointments, queueBoards, queueTokens, prescriptionDrafts, prescriptionLines, medicationSafetyChecks } from "./clinical";
import { serviceCatalogs, tariffPlans, tariffItems, invoices, invoiceLines, payments, refunds, claims, claimDocuments } from "./revenue";
import { aiModelProviders, aiModels, scribeSessions, scribeAudioChunks, transcripts, aiGenerations, aiArtifactReviews } from "./ai";
import { auditEvents, fhirProvenanceRecords, tenantExportJobs } from "./audit";
import { integrationConnections, integrationMessages, webhookSubscriptions, webhookDeliveries } from "./integrations";
import { edgeDevices, offlineQueues } from "./offline";
import { outboxEvents, backgroundJobs } from "./outbox";
import { migrationSources, migrationMappings, migrationRuns, migrationRunRows } from "./migration";

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  tenantProfiles: many(userTenantProfiles),
  organizationMemberships: many(member),
  passkeys: many(passkey),
  apiKeys: many(apikey),
  roleAssignments: many(userRoleAssignments),
  twoFactors: many(twoFactor),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
  teams: many(team),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, { fields: [member.organizationId], references: [organization.id] }),
  user: one(user, { fields: [member.userId], references: [user.id] }),
}));

export const teamRelations = relations(team, ({ one, many }) => ({
  organization: one(organization, { fields: [team.organizationId], references: [organization.id] }),
  members: many(teamMember),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  facilities: many(facilities),
  departments: many(departments),
  practitioners: many(practitioners),
  userProfiles: many(userTenantProfiles),
  keyVersions: many(tenantKeyVersions),
  fhirCurrentResources: many(fhirResourceCurrent),
  fhirVersions: many(fhirResourceVersions),
  patients: many(patientProjections),
  encounters: many(encounterProjections),
  invoices: many(invoices),
  claims: many(claims),
  auditEvents: many(auditEvents),
}));

export const facilityRelations = relations(facilities, ({ one, many }) => ({
  tenant: one(tenants, { fields: [facilities.tenantId], references: [tenants.id] }),
  departments: many(departments),
  appointmentBooks: many(appointmentBooks),
  queueBoards: many(queueBoards),
  invoices: many(invoices),
}));

export const departmentRelations = relations(departments, ({ one }) => ({
  tenant: one(tenants, { fields: [departments.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [departments.facilityId], references: [facilities.id] }),
}));

export const practitionerRelations = relations(practitioners, ({ one, many }) => ({
  tenant: one(tenants, { fields: [practitioners.tenantId], references: [tenants.id] }),
  user: one(user, { fields: [practitioners.userId], references: [user.id] }),
  roles: many(practitionerRoles),
  encounters: many(encounterProjections),
}));

export const practitionerRoleRelations = relations(practitionerRoles, ({ one }) => ({
  tenant: one(tenants, { fields: [practitionerRoles.tenantId], references: [tenants.id] }),
  practitioner: one(practitioners, { fields: [practitionerRoles.practitionerId], references: [practitioners.id] }),
  facility: one(facilities, { fields: [practitionerRoles.facilityId], references: [facilities.id] }),
  department: one(departments, { fields: [practitionerRoles.departmentId], references: [departments.id] }),
}));

export const userTenantProfileRelations = relations(userTenantProfiles, ({ one }) => ({
  tenant: one(tenants, { fields: [userTenantProfiles.tenantId], references: [tenants.id] }),
  user: one(user, { fields: [userTenantProfiles.userId], references: [user.id] }),
  homeFacility: one(facilities, { fields: [userTenantProfiles.homeFacilityId], references: [facilities.id] }),
  practitioner: one(practitioners, { fields: [userTenantProfiles.practitionerId], references: [practitioners.id] }),
}));

export const roleDefinitionRelations = relations(roleDefinitions, ({ many }) => ({
  permissions: many(rolePermissions),
  assignments: many(userRoleAssignments),
}));

export const rolePermissionRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roleDefinitions, { fields: [rolePermissions.roleId], references: [roleDefinitions.id] }),
}));

export const fhirResourceVersionRelations = relations(fhirResourceVersions, ({ one }) => ({
  tenant: one(tenants, { fields: [fhirResourceVersions.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [fhirResourceVersions.facilityId], references: [facilities.id] }),
}));

export const fhirResourceCurrentRelations = relations(fhirResourceCurrent, ({ one }) => ({
  tenant: one(tenants, { fields: [fhirResourceCurrent.tenantId], references: [tenants.id] }),
  currentVersion: one(fhirResourceVersions, { fields: [fhirResourceCurrent.currentVersionId], references: [fhirResourceVersions.id] }),
}));

export const patientProjectionRelations = relations(patientProjections, ({ one, many }) => ({
  tenant: one(tenants, { fields: [patientProjections.tenantId], references: [tenants.id] }),
  currentResource: one(fhirResourceCurrent, { fields: [patientProjections.fhirCurrentId], references: [fhirResourceCurrent.id] }),
  identifiers: many(patientIdentifiers),
  documents: many(documentReferences),
  consents: many(patientConsents),
  encounters: many(encounterProjections),
}));

export const patientIdentifierRelations = relations(patientIdentifiers, ({ one }) => ({
  tenant: one(tenants, { fields: [patientIdentifiers.tenantId], references: [tenants.id] }),
}));

export const encounterProjectionRelations = relations(encounterProjections, ({ one, many }) => ({
  tenant: one(tenants, { fields: [encounterProjections.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [encounterProjections.facilityId], references: [facilities.id] }),
  currentResource: one(fhirResourceCurrent, { fields: [encounterProjections.fhirCurrentId], references: [fhirResourceCurrent.id] }),
  practitioner: one(practitioners, { fields: [encounterProjections.practitionerId], references: [practitioners.id] }),
  prescriptions: many(prescriptionDrafts),
  scribeSessions: many(scribeSessions),
  invoices: many(invoices),
}));

export const documentReferenceRelations = relations(documentReferences, ({ one }) => ({
  tenant: one(tenants, { fields: [documentReferences.tenantId], references: [tenants.id] }),
  object: one(objectBlobs, { fields: [documentReferences.objectId], references: [objectBlobs.id] }),
}));

export const appointmentBookRelations = relations(appointmentBooks, ({ one, many }) => ({
  tenant: one(tenants, { fields: [appointmentBooks.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [appointmentBooks.facilityId], references: [facilities.id] }),
  appointments: many(appointments),
}));

export const appointmentRelations = relations(appointments, ({ one, many }) => ({
  tenant: one(tenants, { fields: [appointments.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [appointments.facilityId], references: [facilities.id] }),
  appointmentBook: one(appointmentBooks, { fields: [appointments.appointmentBookId], references: [appointmentBooks.id] }),
  tokens: many(queueTokens),
}));

export const queueBoardRelations = relations(queueBoards, ({ one, many }) => ({
  tenant: one(tenants, { fields: [queueBoards.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [queueBoards.facilityId], references: [facilities.id] }),
  tokens: many(queueTokens),
}));

export const queueTokenRelations = relations(queueTokens, ({ one }) => ({
  tenant: one(tenants, { fields: [queueTokens.tenantId], references: [tenants.id] }),
  queueBoard: one(queueBoards, { fields: [queueTokens.queueBoardId], references: [queueBoards.id] }),
  appointment: one(appointments, { fields: [queueTokens.appointmentId], references: [appointments.id] }),
}));

export const prescriptionDraftRelations = relations(prescriptionDrafts, ({ many }) => ({
  lines: many(prescriptionLines),
  safetyChecks: many(medicationSafetyChecks),
}));

export const invoiceRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, { fields: [invoices.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [invoices.facilityId], references: [facilities.id] }),
  lines: many(invoiceLines),
  payments: many(payments),
  refunds: many(refunds),
  claims: many(claims),
}));

export const invoiceLineRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLines.invoiceId], references: [invoices.id] }),
  serviceCatalog: one(serviceCatalogs, { fields: [invoiceLines.serviceCatalogId], references: [serviceCatalogs.id] }),
}));

export const tariffPlanRelations = relations(tariffPlans, ({ many }) => ({
  items: many(tariffItems),
}));

export const claimRelations = relations(claims, ({ one, many }) => ({
  tenant: one(tenants, { fields: [claims.tenantId], references: [tenants.id] }),
  invoice: one(invoices, { fields: [claims.invoiceId], references: [invoices.id] }),
  documents: many(claimDocuments),
}));

export const aiModelProviderRelations = relations(aiModelProviders, ({ many }) => ({
  models: many(aiModels),
}));

export const aiModelRelations = relations(aiModels, ({ one, many }) => ({
  provider: one(aiModelProviders, { fields: [aiModels.providerId], references: [aiModelProviders.id] }),
  generations: many(aiGenerations),
}));

export const scribeSessionRelations = relations(scribeSessions, ({ one, many }) => ({
  tenant: one(tenants, { fields: [scribeSessions.tenantId], references: [tenants.id] }),
  audioChunks: many(scribeAudioChunks),
  transcripts: many(transcripts),
  generations: many(aiGenerations),
}));

export const aiGenerationRelations = relations(aiGenerations, ({ one, many }) => ({
  model: one(aiModels, { fields: [aiGenerations.modelId], references: [aiModels.id] }),
  scribeSession: one(scribeSessions, { fields: [aiGenerations.scribeSessionId], references: [scribeSessions.id] }),
  reviews: many(aiArtifactReviews),
}));

export const auditEventRelations = relations(auditEvents, ({ one }) => ({
  tenant: one(tenants, { fields: [auditEvents.tenantId], references: [tenants.id] }),
}));

export const provenanceRelations = relations(fhirProvenanceRecords, ({ one }) => ({
  tenant: one(tenants, { fields: [fhirProvenanceRecords.tenantId], references: [tenants.id] }),
}));

export const exportJobRelations = relations(tenantExportJobs, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantExportJobs.tenantId], references: [tenants.id] }),
}));

export const integrationConnectionRelations = relations(integrationConnections, ({ one, many }) => ({
  tenant: one(tenants, { fields: [integrationConnections.tenantId], references: [tenants.id] }),
  messages: many(integrationMessages),
  webhookSubscriptions: many(webhookSubscriptions),
}));

export const webhookSubscriptionRelations = relations(webhookSubscriptions, ({ many }) => ({
  deliveries: many(webhookDeliveries),
}));

export const edgeDeviceRelations = relations(edgeDevices, ({ one, many }) => ({
  tenant: one(tenants, { fields: [edgeDevices.tenantId], references: [tenants.id] }),
  facility: one(facilities, { fields: [edgeDevices.facilityId], references: [facilities.id] }),
  offlineQueues: many(offlineQueues),
}));

export const outboxEventRelations = relations(outboxEvents, ({ one }) => ({
  tenant: one(tenants, { fields: [outboxEvents.tenantId], references: [tenants.id] }),
}));

export const backgroundJobRelations = relations(backgroundJobs, ({ one }) => ({
  tenant: one(tenants, { fields: [backgroundJobs.tenantId], references: [tenants.id] }),
}));

export const migrationSourceRelations = relations(migrationSources, ({ one, many }) => ({
  tenant: one(tenants, { fields: [migrationSources.tenantId], references: [tenants.id] }),
  mappings: many(migrationMappings),
  runs: many(migrationRuns),
}));

export const migrationRunRelations = relations(migrationRuns, ({ one, many }) => ({
  tenant: one(tenants, { fields: [migrationRuns.tenantId], references: [tenants.id] }),
  source: one(migrationSources, { fields: [migrationRuns.sourceId], references: [migrationSources.id] }),
  mapping: one(migrationMappings, { fields: [migrationRuns.mappingId], references: [migrationMappings.id] }),
  rows: many(migrationRunRows),
}));
