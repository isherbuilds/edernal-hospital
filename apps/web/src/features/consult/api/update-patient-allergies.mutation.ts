import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type PatientOutput } from "@tsu-stack/api/routers/patient/queries";

import { consultWorkspaceQueryKeys } from "./get-consult-workspace.query";

export type UpdatePatientAllergiesMutationResult = PatientOutput;

export function updatePatientAllergiesMutationOptions() {
  return orpc.patient.updateAllergies.mutationOptions();
}

export function useUpdatePatientAllergiesMutation({ encounterId }: { encounterId: string }) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.patient.updateAllergies.mutationOptions({
      onSuccess: async (_patient, variables) => {
        await queryClient.invalidateQueries({
          queryKey: consultWorkspaceQueryKeys.byEncounter(variables.tenantId, encounterId)
        });
      }
    })
  );
}
