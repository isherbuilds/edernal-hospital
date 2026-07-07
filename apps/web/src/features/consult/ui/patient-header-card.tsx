import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { type ConsultWorkspaceOutput } from "@tsu-stack/api/routers/consult/queries";
import { Button } from "@tsu-stack/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@tsu-stack/ui/components/card";
import { Textarea } from "@tsu-stack/ui/components/textarea";
import { cn } from "@tsu-stack/ui/lib/utils";

import { useUpdatePatientAllergiesMutation } from "@/features/consult/api/update-patient-allergies.mutation";
import {
  formatPatientAgeDob,
  formatSex,
  getErrorMessage
} from "@/features/consult/ui/consult-form.helpers";

export function HeaderCard({
  canEditAllergies,
  encounterId,
  tenantId,
  workspace
}: {
  canEditAllergies: boolean;
  encounterId: string;
  tenantId: string;
  workspace: ConsultWorkspaceOutput;
}) {
  const updateAllergies = useUpdatePatientAllergiesMutation({ encounterId });
  const [allergiesDraft, setAllergiesDraft] = useState(workspace.patient.allergies);
  const [isEditingAllergies, setIsEditingAllergies] = useState(false);
  const allergyText = workspace.patient.allergies.trim();

  async function saveAllergies(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await updateAllergies.mutateAsync({
        allergies: allergiesDraft,
        patientId: workspace.patient.id,
        tenantId
      });
      toast.success("Allergies updated.");
      setIsEditingAllergies(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update allergies."));
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle className="text-2xl">{workspace.patient.fullName}</CardTitle>
            <CardDescription>
              {formatPatientAgeDob(workspace.patient.ageYears, workspace.patient.dateOfBirth)} ·{" "}
              {formatSex(workspace.patient.sex)} · {workspace.patient.phone}
            </CardDescription>
          </div>
          <div className="grid gap-2 text-sm lg:min-w-64">
            <div className="flex items-center justify-between gap-4 rounded-xl bg-muted px-3 py-2">
              <span className="text-muted-foreground">Token</span>
              <span className="font-mono text-base font-medium">
                {workspace.token ? `#${workspace.token.sequence}` : "No token"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl bg-muted px-3 py-2">
              <span className="text-muted-foreground">Practitioner</span>
              <span className="font-medium">{workspace.practitioner.displayName}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "flex flex-col gap-3 rounded-2xl border p-4",
            allergyText.length > 0
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-warning/40 bg-warning/10 text-foreground"
          )}
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium">Allergies / adverse reactions</p>
              {isEditingAllergies ? null : (
                <p className="mt-1 text-sm">
                  {allergyText.length > 0 ? allergyText : "No known allergies recorded"}
                </p>
              )}
            </div>
            {canEditAllergies && !isEditingAllergies ? (
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() => setIsEditingAllergies(true)}
              >
                Edit allergies
              </Button>
            ) : null}
          </div>
          {isEditingAllergies ? (
            <form className="flex flex-col gap-3" onSubmit={saveAllergies}>
              <Textarea
                aria-label="Allergy text"
                className="min-h-24 bg-background text-foreground"
                value={allergiesDraft}
                onChange={(event) => setAllergiesDraft(event.currentTarget.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button disabled={updateAllergies.isPending} type="submit">
                  {updateAllergies.isPending ? "Saving…" : "Save allergies"}
                </Button>
                <Button
                  disabled={updateAllergies.isPending}
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAllergiesDraft(workspace.patient.allergies);
                    setIsEditingAllergies(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
