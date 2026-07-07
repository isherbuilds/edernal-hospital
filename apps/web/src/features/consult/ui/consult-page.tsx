import { Card, CardContent } from "@tsu-stack/ui/components/card";

import { getErrorMessage } from "@/shared/lib/get-error-message";
import { useTenantGate } from "@/shared/lib/use-tenant-gate";
import { Container } from "@/shared/ui/container";
import { TenantGateCard } from "@/shared/ui/tenant-gate-card";

import { useGetConsultWorkspaceQuery } from "@/features/consult/api/get-consult-workspace.query";
import { useListNoteTemplatesQuery } from "@/features/consult/api/list-note-templates.query";
import { EmptyState, LoadingState } from "@/features/consult/ui/consult-ui";
import { NotePane } from "@/features/consult/ui/note-pane";
import { HeaderCard } from "@/features/consult/ui/patient-header-card";
import { PrescriptionPane } from "@/features/consult/ui/prescription-pane";

export function ConsultPage({ encounterId }: { encounterId: string }) {
  const {
    membership,
    organizationOptions,
    organizationsPending,
    roles,
    setTenantId,
    tenantId,
    tenantReady
  } = useTenantGate();
  const membershipPending = tenantReady && membership.isPending;
  const canViewConsult = roles.includes("practitioner") || roles.includes("hospital_admin");

  const workspace = useGetConsultWorkspaceQuery(
    { encounterId, tenantId },
    { enabled: tenantReady && canViewConsult }
  );

  const workspaceData = workspace.data;
  const canWriteClinical = Boolean(workspaceData?.canWriteClinical);
  // patient.updateAllergies is open to practitioner + hospital_admin (not owner-gated),
  // so allergy editing follows view access, not the owner-only clinical-write rule.
  const canEditAllergies = canViewConsult;

  const noteTemplates = useListNoteTemplatesQuery(tenantId, {
    enabled: tenantReady && canViewConsult && canWriteClinical
  });

  return (
    <Container className="flex flex-col gap-6 py-8">
      <TenantGateCard
        description="Choose the organization for this encounter. The server verifies membership before PHI is loaded."
        manualInputId="consult-tenant-id"
        membershipError={membership.error}
        membershipPending={membershipPending}
        noOrganizationsDescription="No organizations were listed for this session. Use the manual fallback if an administrator supplied an organization ID."
        organizationOptions={organizationOptions}
        organizationsPending={organizationsPending}
        tenantId={tenantId}
        title="Consult workspace"
        onTenantChange={setTenantId}
      />

      {!tenantReady ? (
        <EmptyState
          description="Choose the tenant that owns this encounter to open the consult workspace."
          title="Select an organization"
        />
      ) : membershipPending ? (
        <LoadingState label="Checking your clinical role…" />
      ) : membership.error ? (
        <EmptyState
          description="The server could not verify your role for this organization."
          title="Membership could not be loaded"
        />
      ) : !canViewConsult ? (
        <EmptyState
          description="Consult workspaces require the practitioner or hospital admin role."
          title="Not allowed"
        />
      ) : workspace.isPending ? (
        <LoadingState label="Loading consult workspace…" />
      ) : workspace.error ? (
        <EmptyState
          description={getErrorMessage(workspace.error, "The encounter could not be loaded.")}
          title="Consult workspace unavailable"
        />
      ) : workspaceData ? (
        <>
          <HeaderCard
            key={`${workspaceData.patient.id}:${workspaceData.patient.updatedAt}`}
            canEditAllergies={canEditAllergies}
            encounterId={encounterId}
            tenantId={tenantId}
            workspace={workspaceData}
          />

          {!canWriteClinical ? (
            <Card className="border-warning/40 bg-warning/10">
              <CardContent className="text-sm text-foreground">
                This consult is read-only for you. Saving, signing, and correction are available
                only to the encounter practitioner; hospital admins can review and print signed
                prescriptions.
              </CardContent>
            </Card>
          ) : null}

          <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <NotePane
              key={
                workspaceData.consultNote
                  ? `${workspaceData.consultNote.id}:${workspaceData.consultNote.updatedAt}`
                  : `empty-note:${workspaceData.encounter.id}`
              }
              canWriteClinical={canWriteClinical}
              encounterId={encounterId}
              note={workspaceData.consultNote}
              templates={noteTemplates.data ?? []}
              templatesPending={noteTemplates.isPending}
              tenantId={tenantId}
            />

            <PrescriptionPane
              key={
                workspaceData.prescription
                  ? `${workspaceData.prescription.id}:${workspaceData.prescription.updatedAt}:${workspaceData.prescription.lines.length}`
                  : `empty-prescription:${workspaceData.encounter.id}`
              }
              canWriteClinical={canWriteClinical}
              encounterId={encounterId}
              prescription={workspaceData.prescription}
              tenantId={tenantId}
            />
          </section>
        </>
      ) : null}
    </Container>
  );
}
