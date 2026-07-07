import { useMutation } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type PrescriptionOutput } from "@tsu-stack/api/routers/consult/queries";

import { useInvalidateConsultWorkspace } from "./get-consult-workspace.query";

export type SavePrescriptionMutationResult = PrescriptionOutput;

export function useSavePrescriptionMutation() {
  const invalidateWorkspace = useInvalidateConsultWorkspace();

  return useMutation(
    orpc.consult.savePrescription.mutationOptions({
      onSuccess: (prescription, variables) =>
        invalidateWorkspace(variables.tenantId, prescription.encounterId)
    })
  );
}
