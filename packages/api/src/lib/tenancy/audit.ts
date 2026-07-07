import { type AuditAction, type AuditDetails, type AuditResourceType } from "@tsu-stack/core/audit";
import { PHI_FIELD_BANLIST } from "@tsu-stack/core/phi";

type AuditWriteAction = Extract<AuditAction, "create" | "update" | "delete" | "sign">;

type AuditInput = {
  action: AuditAction;
  details?: AuditDetails;
  requestId?: string;
  resourceId?: string | null;
  resourceType: AuditResourceType;
};

type AuditReadInput = Omit<AuditInput, "action"> & {
  resultCount: number;
};

type AuditRecord = Required<
  Pick<AuditInput, "action" | "details" | "resourceId" | "resourceType">
> &
  Pick<AuditInput, "requestId">;

export type TenantAudit = {
  print: (input: Omit<AuditInput, "action">) => Promise<void>;
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

function redactAuditDetails(details: AuditDetails): AuditDetails {
  const redacted = { ...details };
  for (const field of PHI_FIELD_BANLIST) {
    if (field in redacted) {
      redacted[field] = "[REDACTED]";
    }
  }
  return redacted;
}

export function createTenantAudit({ insert, procedure }: CreateTenantAuditOptions): TenantAudit {
  function record(input: AuditInput) {
    return insert({
      action: input.action,
      details: addProcedureDetails(procedure, redactAuditDetails(input.details ?? {})),
      requestId: input.requestId,
      resourceId: input.resourceId ?? null,
      resourceType: input.resourceType
    });
  }

  function recordRead(action: "read" | "search", input: AuditReadInput) {
    return record({
      ...input,
      action,
      details: {
        ...input.details,
        resultCount: input.resultCount
      }
    });
  }

  return {
    read: (input) => recordRead("read", input),
    search: (input) => recordRead("search", input),
    print: (input) => record({ ...input, action: "print" }),
    write: (input) => record(input)
  };
}
