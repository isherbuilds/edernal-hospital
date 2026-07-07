import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type PrescriptionOutput } from "@tsu-stack/api/routers/consult/queries";

import { consultWorkspaceQueryKeys } from "./get-consult-workspace.query";

export type SupersedePrescriptionMutationResult = PrescriptionOutput;

export function supersedePrescriptionMutationOptions() {
  return orpc.consult.supersedePrescription.mutationOptions();
}

export function useSupersedePrescriptionMutation() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.consult.supersedePrescription.mutationOptions({
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
