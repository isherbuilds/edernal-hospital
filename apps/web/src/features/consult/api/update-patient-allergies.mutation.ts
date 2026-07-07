import { useMutation } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type PatientOutput } from "@tsu-stack/api/routers/patient/queries";

import { useInvalidateConsultWorkspace } from "./get-consult-workspace.query";

export type UpdatePatientAllergiesMutationResult = PatientOutput;

export function useUpdatePatientAllergiesMutation({ encounterId }: { encounterId: string }) {
  const invalidateWorkspace = useInvalidateConsultWorkspace();

  return useMutation(
    orpc.patient.updateAllergies.mutationOptions({
      onSuccess: (_patient, variables) => invalidateWorkspace(variables.tenantId, encounterId)
    })
  );
}
