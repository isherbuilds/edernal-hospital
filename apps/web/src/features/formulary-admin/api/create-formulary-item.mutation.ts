import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";

import { getErrorMessage } from "@/shared/lib/get-error-message";

import { formularyItemsQueryKeys } from "./list-formulary-items.query";

export function createFormularyItemMutationOptions() {
  return orpc.formulary.create.mutationOptions();
}

export function useCreateFormularyItemMutation(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.formulary.create.mutationOptions({
      onError: (error) => {
        toast.error(
          getErrorMessage(error, "Failed to create formulary item.", {
            CONFLICT: "A formulary item with this name, strength, and form already exists."
          })
        );
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: formularyItemsQueryKeys.list(tenantId)
        });
      }
    })
  );
}
