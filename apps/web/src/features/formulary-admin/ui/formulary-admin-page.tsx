import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { type FormularyItemOutput } from "@tsu-stack/api/routers/formulary/queries";
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

import { useTenantGate } from "@/shared/lib/use-tenant-gate";
import { Container } from "@/shared/ui/container";
import { TenantGateCard } from "@/shared/ui/tenant-gate-card";

import { useCreateFormularyItemMutation } from "@/features/formulary-admin/api/create-formulary-item.mutation";
import { useListFormularyItemsQuery } from "@/features/formulary-admin/api/list-formulary-items.query";
import { useUpdateFormularyItemMutation } from "@/features/formulary-admin/api/update-formulary-item.mutation";

type FormularyItemFormState = {
  defaultDoseText: string;
  form: string;
  name: string;
  strength: string;
};

const emptyFormularyItemForm: FormularyItemFormState = {
  defaultDoseText: "",
  form: "",
  name: "",
  strength: ""
};

type FormularyItemDialogProps = {
  editingItem: FormularyItemOutput | null;
  form: FormularyItemFormState;
  isSubmitting: boolean;
  nameError: string | null;
  onFormChange: (form: FormularyItemFormState) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
};

function FormularyItemDialog({
  editingItem,
  form,
  isSubmitting,
  nameError,
  onFormChange,
  onOpenChange,
  onSubmit,
  open
}: FormularyItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Edit formulary item" : "Add formulary item"}</DialogTitle>
          <DialogDescription>
            Maintain the hospital medication quick-pick list used by practitioners during consults.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-6" onSubmit={onSubmit}>
          <FieldGroup className="gap-4">
            <Field data-invalid={nameError ? true : undefined}>
              <FieldLabel htmlFor="formulary-item-name">Name</FieldLabel>
              <Input
                id="formulary-item-name"
                autoComplete="off"
                value={form.name}
                onChange={(event) => onFormChange({ ...form, name: event.currentTarget.value })}
                aria-invalid={nameError ? true : undefined}
                placeholder="Paracetamol"
                required
              />
              {nameError ? (
                <FieldDescription role="alert">{nameError}</FieldDescription>
              ) : (
                <FieldDescription>
                  Required. Duplicate names are allowed only when strength or form differs.
                </FieldDescription>
              )}
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="formulary-item-strength">Strength</FieldLabel>
                <Input
                  id="formulary-item-strength"
                  autoComplete="off"
                  value={form.strength}
                  onChange={(event) =>
                    onFormChange({ ...form, strength: event.currentTarget.value })
                  }
                  placeholder="500 mg"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="formulary-item-form">Form</FieldLabel>
                <Input
                  id="formulary-item-form"
                  autoComplete="off"
                  value={form.form}
                  onChange={(event) => onFormChange({ ...form, form: event.currentTarget.value })}
                  placeholder="Tablet"
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="formulary-item-default-dose">Default dose</FieldLabel>
              <Input
                id="formulary-item-default-dose"
                autoComplete="off"
                value={form.defaultDoseText}
                onChange={(event) =>
                  onFormChange({ ...form, defaultDoseText: event.currentTarget.value })
                }
                placeholder="1 tablet twice daily after food"
              />
              <FieldDescription>
                Optional text copied into prescriptions when this item is quick-picked.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" disabled={isSubmitting} />}
            >
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {editingItem ? "Save changes" : "Create item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FormularyAdminPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FormularyItemOutput | null>(null);
  const [form, setForm] = useState<FormularyItemFormState>(emptyFormularyItemForm);
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
  const canManageFormulary = roles.includes("hospital_admin");
  const formularyItems = useListFormularyItemsQuery(tenantId, tenantReady && canManageFormulary);
  const createFormularyItem = useCreateFormularyItemMutation(tenantId);
  const updateFormularyItem = useUpdateFormularyItemMutation(tenantId);
  const isMutating = createFormularyItem.isPending || updateFormularyItem.isPending;
  const listErrorMessage =
    formularyItems.error instanceof Error && formularyItems.error.message.trim().length > 0
      ? formularyItems.error.message
      : "Could not load formulary items.";

  function selectTenant(nextTenantId: string) {
    if (nextTenantId === tenantId) {
      return;
    }

    setTenantId(nextTenantId);
    setDialogOpen(false);
    setEditingItem(null);
    setForm(emptyFormularyItemForm);
    setNameError(null);
  }

  function openCreateDialog() {
    setEditingItem(null);
    setForm(emptyFormularyItemForm);
    setNameError(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: FormularyItemOutput) {
    setEditingItem(item);
    setForm({
      defaultDoseText: item.defaultDoseText,
      form: item.form,
      name: item.name,
      strength: item.strength
    });
    setNameError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantReady || !canManageFormulary) {
      toast.error("Formulary administration requires the hospital admin role.");
      return;
    }

    const name = form.name.trim();
    if (name.length === 0) {
      setNameError("Name is required.");
      return;
    }

    setNameError(null);
    const input = {
      defaultDoseText: form.defaultDoseText.trim(),
      form: form.form.trim(),
      name,
      strength: form.strength.trim(),
      tenantId
    };

    try {
      if (editingItem) {
        await updateFormularyItem.mutateAsync({
          ...input,
          formularyItemId: editingItem.id
        });
        toast.success("Formulary item updated.");
      } else {
        await createFormularyItem.mutateAsync(input);
        toast.success("Formulary item created.");
      }
      setDialogOpen(false);
      setEditingItem(null);
      setForm(emptyFormularyItemForm);
    } catch {
      // The mutation wrapper shows the typed oRPC error toast.
    }
  }

  async function toggleStatus(item: FormularyItemOutput) {
    if (!tenantReady || !canManageFormulary) {
      toast.error("Formulary administration requires the hospital admin role.");
      return;
    }

    const nextStatus = item.status === "active" ? "inactive" : "active";
    try {
      await updateFormularyItem.mutateAsync({
        formularyItemId: item.id,
        status: nextStatus,
        tenantId
      });
      toast.success(
        nextStatus === "active" ? "Formulary item activated." : "Formulary item deactivated."
      );
    } catch {
      // The mutation wrapper shows the typed oRPC error toast.
    }
  }

  return (
    <Container className="flex flex-col gap-8 py-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Phase 2 admin</p>
        <h1 className="font-display text-4xl">Formulary</h1>
        <p className="max-w-3xl text-muted-foreground">
          Maintain medication quick-picks and default dose text for the consult prescription flow.
        </p>
      </header>

      <TenantGateCard
        fieldDescription="Client navigation is visible to all signed-in staff; the server still verifies hospital admin membership for every formulary call."
        manualInputId="formulary-tenant-id"
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
              Choose a tenant organization to load formulary administration permissions.
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
      ) : !canManageFormulary ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>not allowed</EmptyTitle>
            <EmptyDescription>
              Formulary administration requires the hospital admin role for this organization.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Medication quick-picks</CardTitle>
            <CardDescription>
              {formularyItems.data?.length ?? 0} items are configured for this tenant.
            </CardDescription>
            <CardAction>
              <Button type="button" onClick={openCreateDialog} disabled={isMutating}>
                Add item
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {formularyItems.isPending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                Loading formulary items…
              </div>
            ) : formularyItems.error ? (
              <p className="text-sm text-destructive" role="alert">
                {listErrorMessage}
              </p>
            ) : formularyItems.data && formularyItems.data.length > 0 ? (
              <Table>
                <TableCaption>
                  All active and inactive formulary items for this tenant.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Strength</TableHead>
                    <TableHead>Form</TableHead>
                    <TableHead>Default dose</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formularyItems.data.map((item) => {
                    const statusLabel = item.status === "active" ? "Active" : "Inactive";
                    const toggleLabel = item.status === "active" ? "Deactivate" : "Activate";
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.strength || "—"}</TableCell>
                        <TableCell>{item.form || "—"}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {item.defaultDoseText || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.status === "active" ? "secondary" : "outline"}>
                            {statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(item)}
                              disabled={isMutating}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant={item.status === "active" ? "destructive" : "secondary"}
                              size="sm"
                              onClick={() => void toggleStatus(item)}
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
                  <EmptyTitle>No formulary items</EmptyTitle>
                  <EmptyDescription>
                    Add the first medication quick-pick for this tenant.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      )}

      <FormularyItemDialog
        editingItem={editingItem}
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
