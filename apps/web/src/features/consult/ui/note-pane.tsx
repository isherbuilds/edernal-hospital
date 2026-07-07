import { useState } from "react";
import { toast } from "sonner";

import { type ConsultWorkspaceOutput } from "@tsu-stack/api/routers/consult/queries";
import { type NoteTemplateOutput } from "@tsu-stack/api/routers/note-template/queries";
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
import { Field, FieldDescription, FieldLabel } from "@tsu-stack/ui/components/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@tsu-stack/ui/components/select";

import { useSaveConsultNoteMutation } from "@/features/consult/api/save-consult-note.mutation";
import { useSignConsultNoteMutation } from "@/features/consult/api/sign-consult-note.mutation";
import { useSupersedeConsultNoteMutation } from "@/features/consult/api/supersede-consult-note.mutation";
import {
  buildNoteInput,
  emptyNoteForm,
  getErrorMessage,
  noteFormFromOutput,
  type NoteFormState
} from "@/features/consult/ui/consult-form.helpers";
import {
  ClinicalStatusBadge,
  ConfirmDialog,
  TextareaField,
  TextField
} from "@/features/consult/ui/consult-ui";

export function NotePane({
  canWriteClinical,
  encounterId,
  note,
  templates,
  templatesPending,
  tenantId
}: {
  canWriteClinical: boolean;
  encounterId: string;
  note: ConsultWorkspaceOutput["consultNote"];
  templates: NoteTemplateOutput[];
  templatesPending: boolean;
  tenantId: string;
}) {
  const saveNote = useSaveConsultNoteMutation();
  const signNote = useSignConsultNoteMutation();
  const supersedeNote = useSupersedeConsultNoteMutation();
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [form, setForm] = useState<NoteFormState>(note ? noteFormFromOutput(note) : emptyNoteForm);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [supersedeDialogOpen, setSupersedeDialogOpen] = useState(false);
  const noteReadOnly = !canWriteClinical || note?.status === "signed";
  const isBusy = saveNote.isPending || signNote.isPending || supersedeNote.isPending;

  function applySelectedTemplate() {
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template) {
      return;
    }
    setForm((current) => {
      return {
        ...current,
        advice: current.advice.trim().length === 0 ? template.advice : current.advice,
        complaints:
          current.complaints.trim().length === 0 ? template.complaints : current.complaints,
        diagnosisText:
          current.diagnosisText.trim().length === 0
            ? template.diagnosisText
            : current.diagnosisText,
        findings: current.findings.trim().length === 0 ? template.findings : current.findings,
        followUp: current.followUp.trim().length === 0 ? template.followUp : current.followUp
      };
    });
    toast.success("Template applied to empty fields.");
  }

  async function saveConsultNote() {
    if (!canWriteClinical) {
      toast.error("Saving notes requires the practitioner role.");
      return;
    }
    const parsed = buildNoteInput(form);
    if (!parsed.ok) {
      toast.error(parsed.message);
      return;
    }
    try {
      await saveNote.mutateAsync({
        ...parsed.value,
        encounterId,
        tenantId
      });
      toast.success("Consult note saved as preliminary.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save consult note."));
    }
  }

  async function signCurrentNote() {
    if (!note || !canWriteClinical) {
      return;
    }
    const parsed = buildNoteInput(form);
    if (!parsed.ok) {
      toast.error(parsed.message);
      return;
    }
    try {
      const saved = await saveNote.mutateAsync({ ...parsed.value, encounterId, tenantId });
      await signNote.mutateAsync({ consultNoteId: saved.id, tenantId });
      toast.success("Consult note signed.");
      setSignDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to sign consult note."));
    }
  }

  async function supersedeCurrentNote() {
    if (!note || !canWriteClinical) {
      return;
    }
    try {
      await supersedeNote.mutateAsync({ consultNoteId: note.id, tenantId });
      toast.success("A preliminary correction note is ready.");
      setSupersedeDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create correction note."));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clinical note</CardTitle>
        <CardDescription>
          Capture history, vitals, diagnosis, advice, and follow-up.
        </CardDescription>
        <CardAction>
          <ClinicalStatusBadge status={note?.status ?? "preliminary"} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-2xl border bg-muted/30 p-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <Field className="md:flex-1">
              <FieldLabel>Template</FieldLabel>
              <Select
                disabled={noteReadOnly || templatesPending || templates.length === 0}
                value={selectedTemplateId}
                onValueChange={(value) => setSelectedTemplateId(String(value))}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={templatesPending ? "Loading templates…" : "Choose active template"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                        {template.specialty ? ` · ${template.specialty}` : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                {templates.length === 0 && !templatesPending
                  ? "No templates available."
                  : "Apply fills only note fields that are still empty."}
              </FieldDescription>
            </Field>
            <Button
              disabled={noteReadOnly || selectedTemplateId.length === 0}
              type="button"
              variant="outline"
              onClick={applySelectedTemplate}
            >
              Apply
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <TextField
            label="BP"
            readOnly={noteReadOnly}
            value={form.bloodPressure}
            onChange={(value) =>
              setForm((current) => {
                return { ...current, bloodPressure: value };
              })
            }
          />
          <TextField
            inputMode="numeric"
            label="Pulse"
            readOnly={noteReadOnly}
            type="number"
            value={form.pulseBpm}
            onChange={(value) =>
              setForm((current) => {
                return { ...current, pulseBpm: value };
              })
            }
          />
          <TextField
            inputMode="decimal"
            label="Temp °C"
            readOnly={noteReadOnly}
            step="0.1"
            type="number"
            value={form.temperatureCelsius}
            onChange={(value) =>
              setForm((current) => {
                return { ...current, temperatureCelsius: value };
              })
            }
          />
          <TextField
            inputMode="numeric"
            label="SpO₂ %"
            readOnly={noteReadOnly}
            type="number"
            value={form.spo2Percent}
            onChange={(value) =>
              setForm((current) => {
                return { ...current, spo2Percent: value };
              })
            }
          />
          <TextField
            inputMode="decimal"
            label="Weight kg"
            readOnly={noteReadOnly}
            step="0.1"
            type="number"
            value={form.weightKg}
            onChange={(value) =>
              setForm((current) => {
                return { ...current, weightKg: value };
              })
            }
          />
          <TextField
            inputMode="decimal"
            label="Height cm"
            readOnly={noteReadOnly}
            step="0.1"
            type="number"
            value={form.heightCm}
            onChange={(value) =>
              setForm((current) => {
                return { ...current, heightCm: value };
              })
            }
          />
        </div>

        <TextareaField
          label="Complaints"
          readOnly={noteReadOnly}
          value={form.complaints}
          onChange={(value) =>
            setForm((current) => {
              return { ...current, complaints: value };
            })
          }
        />
        <TextareaField
          label="Findings"
          readOnly={noteReadOnly}
          value={form.findings}
          onChange={(value) =>
            setForm((current) => {
              return { ...current, findings: value };
            })
          }
        />
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)]">
          <TextareaField
            label="Diagnosis"
            readOnly={noteReadOnly}
            value={form.diagnosisText}
            onChange={(value) =>
              setForm((current) => {
                return { ...current, diagnosisText: value };
              })
            }
          />
          <TextField
            label="Diagnosis code"
            placeholder="Optional"
            readOnly={noteReadOnly}
            value={form.diagnosisCode}
            onChange={(value) =>
              setForm((current) => {
                return { ...current, diagnosisCode: value };
              })
            }
          />
        </div>
        <TextareaField
          label="Advice"
          readOnly={noteReadOnly}
          value={form.advice}
          onChange={(value) =>
            setForm((current) => {
              return { ...current, advice: value };
            })
          }
        />
        <TextareaField
          label="Follow-up"
          readOnly={noteReadOnly}
          value={form.followUp}
          onChange={(value) =>
            setForm((current) => {
              return { ...current, followUp: value };
            })
          }
        />
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        {canWriteClinical && note?.status === "signed" ? (
          <Button
            disabled={isBusy}
            type="button"
            variant="outline"
            onClick={() => setSupersedeDialogOpen(true)}
          >
            Correct (new version)
          </Button>
        ) : null}
        {canWriteClinical && note?.status !== "signed" ? (
          <>
            <Button disabled={isBusy} type="button" onClick={saveConsultNote}>
              Save preliminary
            </Button>
            <Button
              disabled={isBusy || !note || note.status !== "preliminary"}
              type="button"
              variant="outline"
              onClick={() => setSignDialogOpen(true)}
            >
              Sign
            </Button>
          </>
        ) : null}
      </CardFooter>

      <ConfirmDialog
        confirmLabel="Sign note"
        description="Signing makes this note immutable. Use correction only if a signed note needs a new version."
        isPending={saveNote.isPending || signNote.isPending}
        open={signDialogOpen}
        title="Sign consult note?"
        onConfirm={() => {
          void signCurrentNote();
        }}
        onOpenChange={setSignDialogOpen}
      />
      <ConfirmDialog
        confirmLabel="Create correction note"
        description="The signed note will be superseded and copied into a new preliminary note."
        isPending={supersedeNote.isPending}
        open={supersedeDialogOpen}
        title="Correct signed note?"
        onConfirm={() => {
          void supersedeCurrentNote();
        }}
        onOpenChange={setSupersedeDialogOpen}
      />
    </Card>
  );
}
