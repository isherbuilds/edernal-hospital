import { useQuery } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type PrescriptionPrintOutput } from "@tsu-stack/api/routers/consult/queries";

export type PrescriptionPrintQueryInput = {
  prescriptionId: string;
  tenantId: string;
};

export type PrescriptionPrintQueryResult = PrescriptionPrintOutput;

export const prescriptionPrintQueryKeys = {
  byId(tenantId: string, prescriptionId: string) {
    return orpc.consult.printPrescription.key({
      input: {
        prescriptionId,
        tenantId
      }
    });
  }
};

export function getPrescriptionPrintQueryOptions(input: PrescriptionPrintQueryInput) {
  return orpc.consult.printPrescription.queryOptions({ input });
}

export function useGetPrescriptionPrintQuery(
  input: PrescriptionPrintQueryInput,
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    ...getPrescriptionPrintQueryOptions(input),
    enabled: options.enabled ?? true,
    retry: false
  });
}
