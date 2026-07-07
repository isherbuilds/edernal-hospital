import { useMutation } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type ConsultNoteOutput } from "@tsu-stack/api/routers/consult/queries";

import { useInvalidateConsultWorkspace } from "./get-consult-workspace.query";

export type SignConsultNoteMutationResult = ConsultNoteOutput;

export function useSignConsultNoteMutation() {
  const invalidateWorkspace = useInvalidateConsultWorkspace();

  return useMutation(
    orpc.consult.signNote.mutationOptions({
      onSuccess: (note, variables) => invalidateWorkspace(variables.tenantId, note.encounterId)
    })
  );
}
