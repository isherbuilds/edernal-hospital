import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type ConsultNoteOutput } from "@tsu-stack/api/routers/consult/queries";

import { consultWorkspaceQueryKeys } from "./get-consult-workspace.query";

export type SignConsultNoteMutationResult = ConsultNoteOutput;

export function signConsultNoteMutationOptions() {
  return orpc.consult.signNote.mutationOptions();
}

export function useSignConsultNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.consult.signNote.mutationOptions({
      onSuccess: async (note, variables) => {
        await queryClient.invalidateQueries({
          queryKey: consultWorkspaceQueryKeys.byEncounter(variables.tenantId, note.encounterId)
        });
      }
    })
  );
}
