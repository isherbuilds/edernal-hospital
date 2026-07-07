import { useQuery } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type NoteTemplateOutput } from "@tsu-stack/api/routers/note-template/queries";

export type NoteTemplatesQueryResult = NoteTemplateOutput[];

export const noteTemplatesQueryKeys = {
  active(tenantId: string) {
    return orpc.noteTemplate.list.key({
      input: {
        includeInactive: false,
        tenantId
      }
    });
  }
};

export function listNoteTemplatesQueryOptions(tenantId: string) {
  return orpc.noteTemplate.list.queryOptions({
    input: {
      includeInactive: false,
      tenantId
    }
  });
}

export function useListNoteTemplatesQuery(tenantId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    ...listNoteTemplatesQueryOptions(tenantId),
    enabled: options.enabled ?? true
  });
}
