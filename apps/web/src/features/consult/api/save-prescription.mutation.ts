import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type PrescriptionOutput } from "@tsu-stack/api/routers/consult/queries";

import { consultWorkspaceQueryKeys } from "./get-consult-workspace.query";

export type SavePrescriptionMutationResult = PrescriptionOutput;

export function savePrescriptionMutationOptions() {
  return orpc.consult.savePrescription.mutationOptions();
}

export function useSavePrescriptionMutation() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.consult.savePrescription.mutationOptions({
      onSuccess: async (prescription, variables) => {
        await queryClient.invalidateQueries({
          queryKey: consultWorkspaceQueryKeys.byEncounter(
            variables.tenantId,
            prescription.encounterId
          )
        });
      }
    })
  );
}
