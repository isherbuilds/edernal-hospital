import { useRef, useState } from "react";
import { toast } from "sonner";

import { type ConsultWorkspaceOutput } from "@tsu-stack/api/routers/consult/queries";
import { type FormularyItemOutput } from "@tsu-stack/api/routers/formulary/queries";
import { useNavigate } from "@tsu-stack/i18n/tanstack-start/hooks/use-navigate";
import { Button } from "@tsu-stack/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@tsu-stack/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@tsu-stack/ui/components/empty";
import { Field, FieldDescription, FieldLabel } from "@tsu-stack/ui/components/field";
import { Input } from "@tsu-stack/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@tsu-stack/ui/components/table";

import { useSavePrescriptionMutation } from "@/features/consult/api/save-prescription.mutation";
import { useSearchFormularyQuery } from "@/features/consult/api/search-formulary.query";
import { useSignPrescriptionMutation } from "@/features/consult/api/sign-prescription.mutation";
import { useSupersedePrescriptionMutation } from "@/features/consult/api/supersede-prescription.mutation";
import {
  buildPrescriptionLines,
  getErrorMessage,
  type PrescriptionLineForm
} from "@/features/consult/ui/consult-form.helpers";
import { ClinicalStatusBadge, ConfirmDialog } from "@/features/consult/ui/consult-ui";

export function PrescriptionPane({
  canWriteClinical,
  encounterId,
  prescription,
  tenantId
}: {
  canWriteClinical: boolean;
  encounterId: string;
  prescription: ConsultWorkspaceOutput["prescription"];
  tenantId: string;
}) {
  const navigate = useNavigate();
  const savePrescription = useSavePrescriptionMutation();
  const signPrescription = useSignPrescriptionMutation();
  const supersedePrescription = useSupersedePrescriptionMutation();
  const [lines, setLines] = useState<PrescriptionLineForm[]>(
    prescription
      ? prescription.lines.map((line) => {
          return {
            dose: line.dose,
            duration: line.duration,
            formularyItemId: line.formularyItemId ?? undefined,
            frequency: line.frequency,
            id: line.id,
            instructions: line.instructions,
            medicationText: line.medicationText
          };
        })
      : []
  );
  const [search, setSearch] = useState("");
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [supersedeDialogOpen, setSupersedeDialogOpen] = useState(false);
  const prescriptionLineId = useRef(0);
  const prescriptionReadOnly = !canWriteClinical || prescription?.status === "signed";
  const formulary = useSearchFormularyQuery({
    enabled: canWriteClinical && !prescriptionReadOnly,
    query: search,
    tenantId
  });
  const isBusy =
    savePrescription.isPending || signPrescription.isPending || supersedePrescription.isPending;

  function addFormularyLine(item: FormularyItemOutput) {
    prescriptionLineId.current += 1;
    setLines((current) => [
      ...current,
      {
        dose: item.defaultDoseText,
        duration: "",
        formularyItemId: item.id,
        frequency: "",
        id: `formulary-${item.id}-${prescriptionLineId.current}`,
        instructions: "",
        medicationText: [item.name, item.strength, item.form].filter(Boolean).join(" ")
      }
    ]);
    setSearch("");
  }

  function addFreeTextLine() {
    prescriptionLineId.current += 1;
    setLines((current) => [
      ...current,
      {
        dose: "",
        duration: "",
        frequency: "",
        id: `free-text-${prescriptionLineId.current}`,
        instructions: "",
        medicationText: ""
      }
    ]);
  }

  async function saveCurrentPrescription() {
    if (!canWriteClinical) {
      toast.error("Saving prescriptions requires the practitioner role.");
      return;
    }
    const parsed = buildPrescriptionLines(lines);
    if (!parsed.ok) {
      toast.error(parsed.message);
      return;
    }
    try {
      await savePrescription.mutateAsync({
        encounterId,
        lines: parsed.value,
        tenantId
      });
      toast.success("Prescription saved as preliminary.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save prescription."));
    }
  }

  async function signCurrentPrescription() {
    if (!prescription || !canWriteClinical) {
      return;
    }
    try {
      await signPrescription.mutateAsync({ prescriptionId: prescription.id, tenantId });
      toast.success("Prescription signed.");
      setSignDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to sign prescription."));
    }
  }

  async function supersedeCurrentPrescription() {
    if (!prescription || !canWriteClinical) {
      return;
    }
    try {
      await supersedePrescription.mutateAsync({ prescriptionId: prescription.id, tenantId });
      toast.success("A preliminary correction prescription is ready.");
      setSupersedeDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create correction prescription."));
    }
  }

  async function openPrintRoute() {
    if (!prescription) {
      return;
    }
    await navigate({
      params: { encounterId },
      search: { prescriptionId: prescription.id },
      to: "/consult/$encounterId/print"
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prescription</CardTitle>
        <CardDescription>
          Compose Prescription lines from formulary quick-picks or free text.
        </CardDescription>
        <CardAction>
          <ClinicalStatusBadge status={prescription?.status ?? "preliminary"} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {canWriteClinical && !prescriptionReadOnly ? (
          <div className="flex flex-col gap-3 rounded-2xl border bg-muted/30 p-3">
            <Field>
              <FieldLabel htmlFor="formulary-search">Formulary search</FieldLabel>
              <Input
                id="formulary-search"
                autoComplete="off"
                placeholder="Search medicines (2+ letters)"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />
              <FieldDescription>
                Click a result to add name, strength, form, and default dose.
              </FieldDescription>
            </Field>
            {search.trim().length >= 2 ? (
              <div className="rounded-xl border bg-background p-2">
                {formulary.isFetching ? (
                  <p className="px-2 py-1 text-sm text-muted-foreground">Searching…</p>
                ) : (formulary.data ?? []).length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {(formulary.data ?? []).map((item) => (
                      <button
                        key={item.id}
                        className="rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                        type="button"
                        onClick={() => addFormularyLine(item)}
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="text-muted-foreground">
                          {item.strength ? ` · ${item.strength}` : ""}
                          {item.form ? ` · ${item.form}` : ""}
                        </span>
                        {item.defaultDoseText ? (
                          <span className="block text-xs text-muted-foreground">
                            Default dose: {item.defaultDoseText}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-2 py-1 text-sm text-muted-foreground">
                    No active formulary matches.
                  </p>
                )}
              </div>
            ) : null}
            <div>
              <Button type="button" variant="outline" onClick={addFreeTextLine}>
                Add free-text line
              </Button>
            </div>
          </div>
        ) : null}

        {lines.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Medication</TableHead>
                <TableHead>Dose</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Instructions</TableHead>
                {prescriptionReadOnly ? null : <TableHead className="w-24">Remove</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, index) => (
                <TableRow key={line.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="min-w-56">
                    <Input
                      aria-label={`Medication ${index + 1}`}
                      readOnly={prescriptionReadOnly}
                      value={line.medicationText}
                      onChange={(event) => {
                        const nextValue = event.currentTarget.value;
                        setLines((current) =>
                          current.map((currentLine) =>
                            currentLine.id === line.id
                              ? { ...currentLine, medicationText: nextValue }
                              : currentLine
                          )
                        );
                      }}
                    />
                  </TableCell>
                  <TableCell className="min-w-40">
                    <Input
                      aria-label={`Dose ${index + 1}`}
                      readOnly={prescriptionReadOnly}
                      value={line.dose}
                      onChange={(event) => {
                        const nextValue = event.currentTarget.value;
                        setLines((current) =>
                          current.map((currentLine) =>
                            currentLine.id === line.id
                              ? { ...currentLine, dose: nextValue }
                              : currentLine
                          )
                        );
                      }}
                    />
                  </TableCell>
                  <TableCell className="min-w-36">
                    <Input
                      aria-label={`Frequency ${index + 1}`}
                      readOnly={prescriptionReadOnly}
                      value={line.frequency}
                      onChange={(event) => {
                        const nextValue = event.currentTarget.value;
                        setLines((current) =>
                          current.map((currentLine) =>
                            currentLine.id === line.id
                              ? { ...currentLine, frequency: nextValue }
                              : currentLine
                          )
                        );
                      }}
                    />
                  </TableCell>
                  <TableCell className="min-w-36">
                    <Input
                      aria-label={`Duration ${index + 1}`}
                      readOnly={prescriptionReadOnly}
                      value={line.duration}
                      onChange={(event) => {
                        const nextValue = event.currentTarget.value;
                        setLines((current) =>
                          current.map((currentLine) =>
                            currentLine.id === line.id
                              ? { ...currentLine, duration: nextValue }
                              : currentLine
                          )
                        );
                      }}
                    />
                  </TableCell>
                  <TableCell className="min-w-52">
                    <Input
                      aria-label={`Instructions ${index + 1}`}
                      readOnly={prescriptionReadOnly}
                      value={line.instructions}
                      onChange={(event) => {
                        const nextValue = event.currentTarget.value;
                        setLines((current) =>
                          current.map((currentLine) =>
                            currentLine.id === line.id
                              ? { ...currentLine, instructions: nextValue }
                              : currentLine
                          )
                        );
                      }}
                    />
                  </TableCell>
                  {prescriptionReadOnly ? null : (
                    <TableCell>
                      <Button
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setLines((current) =>
                            current.filter((currentLine) => currentLine.id !== line.id)
                          )
                        }
                      >
                        Remove
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty className="min-h-44">
            <EmptyHeader>
              <EmptyTitle>No prescription lines</EmptyTitle>
              <EmptyDescription>
                {prescriptionReadOnly
                  ? "No prescription has been recorded for this encounter."
                  : "Search the formulary or add a free-text line to start the Prescription."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        {prescription?.status === "signed" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void openPrintRoute();
            }}
          >
            Print
          </Button>
        ) : null}
        {canWriteClinical && prescription?.status === "signed" ? (
          <Button
            disabled={isBusy}
            type="button"
            variant="outline"
            onClick={() => setSupersedeDialogOpen(true)}
          >
            Correct (new version)
          </Button>
        ) : null}
        {canWriteClinical && prescription?.status !== "signed" ? (
          <>
            <Button
              disabled={isBusy || lines.length === 0}
              type="button"
              onClick={saveCurrentPrescription}
            >
              Save Prescription
            </Button>
            <Button
              disabled={isBusy || !prescription || prescription.status !== "preliminary"}
              type="button"
              variant="outline"
              onClick={() => setSignDialogOpen(true)}
            >
              Sign Prescription
            </Button>
          </>
        ) : null}
      </CardFooter>

      <ConfirmDialog
        confirmLabel="Sign prescription"
        description="Signing makes this prescription immutable and enables the print route."
        isPending={signPrescription.isPending}
        open={signDialogOpen}
        title="Sign prescription?"
        onConfirm={() => {
          void signCurrentPrescription();
        }}
        onOpenChange={setSignDialogOpen}
      />
      <ConfirmDialog
        confirmLabel="Create correction Prescription"
        description="The signed prescription will be superseded and copied into a new preliminary prescription."
        isPending={supersedePrescription.isPending}
        open={supersedeDialogOpen}
        title="Correct signed prescription?"
        onConfirm={() => {
          void supersedeCurrentPrescription();
        }}
        onOpenChange={setSupersedeDialogOpen}
      />
    </Card>
  );
}
