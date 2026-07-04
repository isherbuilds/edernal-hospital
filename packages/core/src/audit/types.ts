import { z } from "zod";

import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "#@/audit/constants";

export const AuditActionSchema = z.enum(AUDIT_ACTIONS);

export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditResourceTypeSchema = z.enum(AUDIT_RESOURCE_TYPES);

export type AuditResourceType = z.infer<typeof AuditResourceTypeSchema>;

export const AuditDetailsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])
);

export type AuditDetails = z.infer<typeof AuditDetailsSchema>;

export const AuditEventSchema = z.object({
  action: AuditActionSchema,
  actorUserId: z.string().min(1),
  details: AuditDetailsSchema.default({}),
  id: z.uuid(),
  occurredAt: z.iso.datetime(),
  requestId: z.string().min(1).optional(),
  resourceId: z.string().min(1).nullable(),
  resourceType: AuditResourceTypeSchema,
  tenantId: z.string().min(1)
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
