import { type AuditAction, type AuditDetails, type AuditResourceType } from "@tsu-stack/core/audit";
import { PHI_FIELD_BANLIST } from "@tsu-stack/core/phi";

type AuditWriteAction = Extract<AuditAction, "create" | "update" | "delete">;

type AuditInput = {
  action: AuditAction;
  details?: AuditDetails;
  requestId?: string;
  resourceId?: string | null;
  resourceType: AuditResourceType;
};

type AuditReadInput = Omit<AuditInput, "action"> & {
  resultCount: number;
  /**
   * Suppresses repeat read/search events for the same actor + procedure +
   * resource within the window. Intended for polling endpoints (queue board)
   * whose steady-state traffic would otherwise drown the audit trail.
   * Tracking is in-memory per process, so restarts fail open to MORE events,
   * never fewer. Decision dated 2026-07-04; revisit at the Phase 4 Trust
   * Envelope audit.
   */
  throttleMs?: number;
};

type AuditRecord = Required<
  Pick<AuditInput, "action" | "details" | "resourceId" | "resourceType">
> &
  Pick<AuditInput, "requestId">;

export type TenantAudit = {
  read: (input: AuditReadInput) => Promise<void>;
  search: (input: AuditReadInput) => Promise<void>;
  write: (input: Omit<AuditInput, "action"> & { action: AuditWriteAction }) => Promise<void>;
};

export type CreateTenantAuditOptions = {
  insert: (record: AuditRecord) => Promise<void>;
  procedure: string;
  /** Stable actor identity (tenant + user) keying read/search throttling. */
  throttleScope?: string;
};

const THROTTLE_MAP_MAX_ENTRIES = 4096;

/** Maps throttle key to the epoch-ms timestamp when suppression expires. */
const throttleExpiry = new Map<string, number>();

function shouldSkipThrottled(key: string, windowMs: number): boolean {
  const now = Date.now();
  const expiresAt = throttleExpiry.get(key);
  if (expiresAt !== undefined && now < expiresAt) {
    return true;
  }

  if (throttleExpiry.size >= THROTTLE_MAP_MAX_ENTRIES) {
    for (const [entryKey, entryExpiresAt] of throttleExpiry) {
      if (entryExpiresAt <= now) {
        throttleExpiry.delete(entryKey);
      }
    }
  }

  throttleExpiry.set(key, now + windowMs);
  return false;
}

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

export function createTenantAudit({
  insert,
  procedure,
  throttleScope
}: CreateTenantAuditOptions): TenantAudit {
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
    if (input.throttleMs) {
      const key = `${throttleScope ?? ""}:${procedure}:${action}:${input.resourceType}:${input.resourceId ?? ""}`;
      if (shouldSkipThrottled(key, input.throttleMs)) {
        return Promise.resolve();
      }
    }

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
    write: (input) => record(input)
  };
}
