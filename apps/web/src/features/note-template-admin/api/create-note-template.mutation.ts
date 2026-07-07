import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";

import { getErrorMessage } from "@/shared/lib/get-error-message";

import { noteTemplatesQueryKeys } from "./list-note-templates.query";

export function createNoteTemplateMutationOptions() {
  return orpc.noteTemplate.create.mutationOptions();
}

export function useCreateNoteTemplateMutation(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.noteTemplate.create.mutationOptions({
      onError: (error) => {
        toast.error(
          getErrorMessage(error, "Failed to create note template.", {
            CONFLICT: "A note template with this name already exists."
          })
        );
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: noteTemplatesQueryKeys.adminList(tenantId)
        });
      }
    })
  );
}
