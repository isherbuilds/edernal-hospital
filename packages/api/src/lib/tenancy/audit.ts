import { type AuditAction, type AuditDetails, type AuditResourceType } from "@tsu-stack/core/audit";

type AuditWriteAction = Extract<AuditAction, "create" | "update" | "delete">;

type AuditInput = {
  action: AuditAction;
  details?: AuditDetails;
  resourceId?: string | null;
  resourceType: AuditResourceType;
};

type AuditReadInput = Omit<AuditInput, "action"> & {
  resultCount: number;
};

type AuditRecord = Required<Pick<AuditInput, "action" | "details" | "resourceId" | "resourceType">>;

export type TenantAudit = {
  read: (input: AuditReadInput) => Promise<void>;
  search: (input: AuditReadInput) => Promise<void>;
  write: (input: Omit<AuditInput, "action"> & { action: AuditWriteAction }) => Promise<void>;
};

export type CreateTenantAuditOptions = {
  insert: (record: AuditRecord) => Promise<void>;
  procedure: string;
};

function addProcedureDetails(procedure: string, details?: AuditDetails): AuditDetails {
  return {
    ...details,
    procedure
  };
}

export function createTenantAudit({ insert, procedure }: CreateTenantAuditOptions): TenantAudit {
  function record(input: AuditInput) {
    return insert({
      action: input.action,
      details: addProcedureDetails(procedure, input.details),
      resourceId: input.resourceId ?? null,
      resourceType: input.resourceType
    });
  }

  return {
    read: (input) =>
      record({
        ...input,
        action: "read",
        details: {
          ...input.details,
          resultCount: input.resultCount
        }
      }),
    search: (input) =>
      record({
        ...input,
        action: "search",
        details: {
          ...input.details,
          resultCount: input.resultCount
        }
      }),
    write: (input) => record(input)
  };
}
