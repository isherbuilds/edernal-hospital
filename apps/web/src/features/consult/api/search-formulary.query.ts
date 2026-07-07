import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type FormularyItemOutput } from "@tsu-stack/api/routers/formulary/queries";

export type FormularySearchQueryInput = {
  query: string;
  tenantId: string;
};

export type FormularySearchQueryResult = FormularyItemOutput[];

export const formularySearchQueryKeys = {
  byQuery(tenantId: string, query: string) {
    return orpc.formulary.search.key({
      input: {
        query,
        tenantId
      }
    });
  }
};

function useDebouncedText(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

export function searchFormularyQueryOptions(input: FormularySearchQueryInput) {
  return orpc.formulary.search.queryOptions({ input });
}

export function useSearchFormularyQuery({
  delayMs = 300,
  enabled = true,
  query,
  tenantId
}: FormularySearchQueryInput & { delayMs?: number; enabled?: boolean }) {
  const debouncedQuery = useDebouncedText(query.trim(), delayMs);
  const canSearch = enabled && tenantId.trim().length > 0 && debouncedQuery.length >= 2;

  return useQuery({
    ...searchFormularyQueryOptions({ query: debouncedQuery, tenantId }),
    enabled: canSearch
  });
}
