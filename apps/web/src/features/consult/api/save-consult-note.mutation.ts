import { useMutation } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type ConsultNoteOutput } from "@tsu-stack/api/routers/consult/queries";

import { useInvalidateConsultWorkspace } from "./get-consult-workspace.query";

export type SaveConsultNoteMutationResult = ConsultNoteOutput;

export function useSaveConsultNoteMutation() {
  const invalidateWorkspace = useInvalidateConsultWorkspace();

  return useMutation(
    orpc.consult.saveNote.mutationOptions({
      onSuccess: (note, variables) => invalidateWorkspace(variables.tenantId, note.encounterId)
    })
  );
}
