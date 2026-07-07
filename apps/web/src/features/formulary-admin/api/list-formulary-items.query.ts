import { useQuery } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type FormularyItemOutput } from "@tsu-stack/api/routers/formulary/queries";

export type ListFormularyItemsResult = FormularyItemOutput[];

export const formularyItemsQueryKeys = {
  list(tenantId: string) {
    return orpc.formulary.list.key({ input: { tenantId } });
  }
};

export function listFormularyItemsQueryOptions(tenantId: string) {
  return orpc.formulary.list.queryOptions({ input: { tenantId } });
}

export function useListFormularyItemsQuery(tenantId: string, enabled: boolean) {
  return useQuery({
    ...listFormularyItemsQueryOptions(tenantId),
    enabled
  });
}
