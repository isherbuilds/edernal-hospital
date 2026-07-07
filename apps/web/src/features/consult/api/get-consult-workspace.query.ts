import { useQuery, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type ConsultWorkspaceOutput } from "@tsu-stack/api/routers/consult/queries";

export type ConsultWorkspaceQueryInput = {
  encounterId: string;
  tenantId: string;
};

export type ConsultWorkspaceQueryResult = ConsultWorkspaceOutput;

export const consultWorkspaceQueryKeys = {
  byEncounter(tenantId: string, encounterId: string) {
    return orpc.consult.workspace.key({
      input: {
        encounterId,
        tenantId
      }
    });
  }
};

export function useInvalidateConsultWorkspace() {
  const queryClient = useQueryClient();

  return (tenantId: string, encounterId: string) =>
    queryClient.invalidateQueries({
      queryKey: consultWorkspaceQueryKeys.byEncounter(tenantId, encounterId)
    });
}

export function getConsultWorkspaceQueryOptions(input: ConsultWorkspaceQueryInput) {
  return orpc.consult.workspace.queryOptions({ input });
}

export function useGetConsultWorkspaceQuery(
  input: ConsultWorkspaceQueryInput,
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    ...getConsultWorkspaceQueryOptions(input),
    enabled: options.enabled ?? true
  });
}
