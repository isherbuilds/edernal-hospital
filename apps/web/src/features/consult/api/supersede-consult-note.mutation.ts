import { useMutation } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type ConsultNoteOutput } from "@tsu-stack/api/routers/consult/queries";

import { useInvalidateConsultWorkspace } from "./get-consult-workspace.query";

export type SupersedeConsultNoteMutationResult = ConsultNoteOutput;

export function useSupersedeConsultNoteMutation() {
  const invalidateWorkspace = useInvalidateConsultWorkspace();

  return useMutation(
    orpc.consult.supersedeNote.mutationOptions({
      onSuccess: (note, variables) => invalidateWorkspace(variables.tenantId, note.encounterId)
    })
  );
}
