import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type ConsultNoteOutput } from "@tsu-stack/api/routers/consult/queries";

import { consultWorkspaceQueryKeys } from "./get-consult-workspace.query";

export type SaveConsultNoteMutationResult = ConsultNoteOutput;

export function saveConsultNoteMutationOptions() {
  return orpc.consult.saveNote.mutationOptions();
}

export function useSaveConsultNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.consult.saveNote.mutationOptions({
      onSuccess: async (note, variables) => {
        await queryClient.invalidateQueries({
          queryKey: consultWorkspaceQueryKeys.byEncounter(variables.tenantId, note.encounterId)
        });
      }
    })
  );
}
