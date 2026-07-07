import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { type NoteTemplateOutput } from "@tsu-stack/api/routers/note-template/queries";
import { Badge } from "@tsu-stack/ui/components/badge";
import { Button } from "@tsu-stack/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@tsu-stack/ui/components/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@tsu-stack/ui/components/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@tsu-stack/ui/components/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@tsu-stack/ui/components/field";
import { Input } from "@tsu-stack/ui/components/input";
import { Spinner } from "@tsu-stack/ui/components/spinner";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@tsu-stack/ui/components/table";
import { Textarea } from "@tsu-stack/ui/components/textarea";

import { useTenantGate } from "@/shared/lib/use-tenant-gate";
import { Container } from "@/shared/ui/container";
import { TenantGateCard } from "@/shared/ui/tenant-gate-card";

import { useCreateNoteTemplateMutation } from "@/features/note-template-admin/api/create-note-template.mutation";
import { useListNoteTemplatesQuery } from "@/features/note-template-admin/api/list-note-templates.query";
import { useUpdateNoteTemplateMutation } from "@/features/note-template-admin/api/update-note-template.mutation";

type NoteTemplateFormState = {
  advice: string;
  complaints: string;
  diagnosisText: string;
  findings: string;
  followUp: string;
  name: string;
  specialty: string;
};

type NoteTemplateContentKey = "advice" | "complaints" | "diagnosisText" | "findings" | "followUp";

const emptyNoteTemplateForm: NoteTemplateFormState = {
  advice: "",
  complaints: "",
  diagnosisText: "",
  findings: "",
  followUp: "",
  name: "",
  specialty: ""
};

const noteTemplateContentFields = [
  {
    key: "complaints",
    label: "Complaints",
    placeholder: "Fever with sore throat for two days"
  },
  {
    key: "findings",
    label: "Findings",
    placeholder: "Temp 38 °C, throat congested, chest clear"
  },
  {
    key: "diagnosisText",
    label: "Diagnosis",
    placeholder: "Viral upper respiratory infection"
  },
  {
    key: "advice",
    label: "Advice",
    placeholder: "Fluids, rest, return if breathlessness or persistent fever"
  },
  {
    key: "followUp",
    label: "Follow-up",
    placeholder: "Review in 3 days if symptoms persist"
  }
] satisfies Array<{ key: NoteTemplateContentKey; label: string; placeholder: string }>;

type NoteTemplateDialogProps = {
  editingTemplate: NoteTemplateOutput | null;
  form: NoteTemplateFormState;
  isSubmitting: boolean;
  nameError: string | null;
  onFormChange: (form: NoteTemplateFormState) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
};

function NoteTemplateDialog({
  editingTemplate,
  form,
  isSubmitting,
  nameError,
  onFormChange,
  onOpenChange,
  onSubmit,
  open
}: NoteTemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editingTemplate ? "Edit note template" : "Add note template"}</DialogTitle>
          <DialogDescription>
            Maintain launch templates that prefill consult note sections for common Encounters.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-6" onSubmit={onSubmit}>
          <FieldGroup className="gap-4">
            <Field data-invalid={nameError ? true : undefined}>
              <FieldLabel htmlFor="note-template-name">Name</FieldLabel>
              <Input
                id="note-template-name"
                autoComplete="off"
                value={form.name}
                onChange={(event) => onFormChange({ ...form, name: event.currentTarget.value })}
                aria-invalid={nameError ? true : undefined}
                placeholder="Fever / URI"
                required
              />
              {nameError ? (
                <FieldDescription role="alert">{nameError}</FieldDescription>
              ) : (
                <FieldDescription>
                  Required. Names must be unique within the tenant.
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="note-template-specialty">Specialty</FieldLabel>
              <Input
                id="note-template-specialty"
                autoComplete="off"
                value={form.specialty}
                onChange={(event) =>
                  onFormChange({ ...form, specialty: event.currentTarget.value })
                }
                placeholder="General medicine"
              />
            </Field>
            {noteTemplateContentFields.map((field) => (
              <Field key={field.key}>
                <FieldLabel htmlFor={`note-template-${field.key}`}>{field.label}</FieldLabel>
                <Textarea
                  id={`note-template-${field.key}`}
                  value={form[field.key]}
                  onChange={(event) =>
                    onFormChange({ ...form, [field.key]: event.currentTarget.value })
                  }
                  placeholder={field.placeholder}
                  rows={4}
                />
              </Field>
            ))}
          </FieldGroup>
          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" disabled={isSubmitting} />}
            >
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {editingTemplate ? "Save changes" : "Create template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NoteTemplateAdminPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NoteTemplateOutput | null>(null);
  const [form, setForm] = useState<NoteTemplateFormState>(emptyNoteTemplateForm);
  const [nameError, setNameError] = useState<string | null>(null);
  const {
    membership,
    organizationOptions,
    organizationsPending,
    roles,
    setTenantId,
    tenantId,
    tenantReady
  } = useTenantGate();
  const canManageTemplates = roles.includes("hospital_admin");
  const noteTemplates = useListNoteTemplatesQuery(tenantId, tenantReady && canManageTemplates);
  const createNoteTemplate = useCreateNoteTemplateMutation(tenantId);
  const updateNoteTemplate = useUpdateNoteTemplateMutation(tenantId);
  const isMutating = createNoteTemplate.isPending || updateNoteTemplate.isPending;
  const listErrorMessage =
    noteTemplates.error instanceof Error && noteTemplates.error.message.trim().length > 0
      ? noteTemplates.error.message
      : "Could not load note templates.";

  function selectTenant(nextTenantId: string) {
    if (nextTenantId === tenantId) {
      return;
    }

    setTenantId(nextTenantId);
    setDialogOpen(false);
    setEditingTemplate(null);
    setForm(emptyNoteTemplateForm);
    setNameError(null);
  }

  function openCreateDialog() {
    setEditingTemplate(null);
    setForm(emptyNoteTemplateForm);
    setNameError(null);
    setDialogOpen(true);
  }

  function openEditDialog(template: NoteTemplateOutput) {
    setEditingTemplate(template);
    setForm({
      advice: template.advice,
      complaints: template.complaints,
      diagnosisText: template.diagnosisText,
      findings: template.findings,
      followUp: template.followUp,
      name: template.name,
      specialty: template.specialty ?? ""
    });
    setNameError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantReady || !canManageTemplates) {
      toast.error("Note template administration requires the hospital admin role.");
      return;
    }

    const name = form.name.trim();
    if (name.length === 0) {
      setNameError("Name is required.");
      return;
    }

    setNameError(null);
    const input = {
      advice: form.advice.trim(),
      complaints: form.complaints.trim(),
      diagnosisText: form.diagnosisText.trim(),
      findings: form.findings.trim(),
      followUp: form.followUp.trim(),
      name,
      specialty: form.specialty.trim(),
      tenantId
    };

    try {
      if (editingTemplate) {
        await updateNoteTemplate.mutateAsync({
          ...input,
          noteTemplateId: editingTemplate.id
        });
        toast.success("Note template updated.");
      } else {
        await createNoteTemplate.mutateAsync(input);
        toast.success("Note template created.");
      }
      setDialogOpen(false);
      setEditingTemplate(null);
      setForm(emptyNoteTemplateForm);
    } catch {
      // The mutation wrapper shows the typed oRPC error toast.
    }
  }

  async function toggleStatus(template: NoteTemplateOutput) {
    if (!tenantReady || !canManageTemplates) {
      toast.error("Note template administration requires the hospital admin role.");
      return;
    }

    const nextStatus = template.status === "active" ? "inactive" : "active";
    try {
      await updateNoteTemplate.mutateAsync({
        noteTemplateId: template.id,
        status: nextStatus,
        tenantId
      });
      toast.success(
        nextStatus === "active" ? "Note template activated." : "Note template deactivated."
      );
    } catch {
      // The mutation wrapper shows the typed oRPC error toast.
    }
  }

  return (
    <Container className="flex flex-col gap-8 py-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Phase 2 admin</p>
        <h1 className="font-display text-4xl">Note templates</h1>
        <p className="max-w-3xl text-muted-foreground">
          Maintain consult note templates that help practitioners start common Encounters faster.
        </p>
      </header>

      <TenantGateCard
        fieldDescription="Client navigation is visible to all signed-in staff; the server still verifies hospital admin membership for every template call."
        manualInputId="note-template-tenant-id"
        membershipError={membership.error}
        membershipPending={tenantReady && membership.isPending}
        membershipPendingText="Checking your organization roles…"
        noOrganizationsDescription="No organizations were listed for this session. Use the manual fallback below if an administrator supplied an organization ID."
        organizationOptions={organizationOptions}
        organizationsPending={organizationsPending}
        tenantId={tenantId}
        variant="section"
        onTenantChange={selectTenant}
      />

      {!tenantReady ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Select an organization</EmptyTitle>
            <EmptyDescription>
              Choose a tenant organization to load note template administration permissions.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : membership.isPending ? (
        <Card>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Checking hospital admin access…
          </CardContent>
        </Card>
      ) : !canManageTemplates ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>not allowed</EmptyTitle>
            <EmptyDescription>
              Note template administration requires the hospital admin role for this organization.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Launch templates</CardTitle>
            <CardDescription>
              {noteTemplates.data?.length ?? 0} templates are configured for this tenant.
            </CardDescription>
            <CardAction>
              <Button type="button" onClick={openCreateDialog} disabled={isMutating}>
                Add template
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {noteTemplates.isPending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                Loading note templates…
              </div>
            ) : noteTemplates.error ? (
              <p className="text-sm text-destructive" role="alert">
                {listErrorMessage}
              </p>
            ) : noteTemplates.data && noteTemplates.data.length > 0 ? (
              <Table>
                <TableCaption>All active and inactive note templates for this tenant.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Specialty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {noteTemplates.data.map((template) => {
                    const statusLabel = template.status === "active" ? "Active" : "Inactive";
                    const toggleLabel = template.status === "active" ? "Deactivate" : "Activate";
                    return (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>{template.specialty ?? "General"}</TableCell>
                        <TableCell>
                          <Badge variant={template.status === "active" ? "secondary" : "outline"}>
                            {statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(template)}
                              disabled={isMutating}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant={template.status === "active" ? "destructive" : "secondary"}
                              size="sm"
                              onClick={() => void toggleStatus(template)}
                              disabled={isMutating}
                            >
                              {toggleLabel}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No note templates</EmptyTitle>
                  <EmptyDescription>
                    Add the first launch template for this tenant.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      )}

      <NoteTemplateDialog
        editingTemplate={editingTemplate}
        form={form}
        isSubmitting={isMutating}
        nameError={nameError}
        onFormChange={setForm}
        onOpenChange={(open) => {
          if (isMutating) {
            return;
          }
          setDialogOpen(open);
        }}
        onSubmit={handleSubmit}
        open={dialogOpen}
      />
    </Container>
  );
}
