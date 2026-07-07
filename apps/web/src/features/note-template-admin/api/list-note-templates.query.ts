import { useQuery } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type NoteTemplateOutput } from "@tsu-stack/api/routers/note-template/queries";

export type ListNoteTemplatesResult = NoteTemplateOutput[];

export const noteTemplatesQueryKeys = {
  adminList(tenantId: string) {
    return orpc.noteTemplate.list.key({ input: { includeInactive: true, tenantId } });
  }
};

export function listNoteTemplatesQueryOptions(tenantId: string) {
  return orpc.noteTemplate.list.queryOptions({
    input: {
      includeInactive: true,
      tenantId
    }
  });
}

export function useListNoteTemplatesQuery(tenantId: string, enabled: boolean) {
  return useQuery({
    ...listNoteTemplatesQueryOptions(tenantId),
    enabled
  });
}
