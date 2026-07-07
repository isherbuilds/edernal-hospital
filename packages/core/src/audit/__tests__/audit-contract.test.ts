import { describe, expect, it } from "vite-plus/test";

import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  AuditActionSchema,
  AuditEventSchema,
  AuditResourceTypeSchema
} from "#@/audit/index";

describe("audit contract", () => {
  it("parses supported audit actions and resource types", () => {
    expect(AUDIT_ACTIONS.map((action) => AuditActionSchema.parse(action))).toEqual(AUDIT_ACTIONS);
    expect(AUDIT_RESOURCE_TYPES.map((resource) => AuditResourceTypeSchema.parse(resource))).toEqual(
      AUDIT_RESOURCE_TYPES
    );
  });

  it("includes doctor-loop audit registry members", () => {
    expect(AUDIT_ACTIONS).toContain("sign");
    expect(AUDIT_RESOURCE_TYPES).toEqual(
      expect.arrayContaining(["consult_note", "prescription", "formulary_item", "note_template"])
    );
  });

  it("accepts transport-safe audit details", () => {
    const parsed = AuditEventSchema.parse({
      action: "create",
      actorUserId: "user_1",
      details: {
        code: "OPD",
        resultCount: 1,
        resourceIds: ["id_1"]
      },
      id: "018f3af2-2fd8-7b36-95a8-329aa08f7624",
      occurredAt: "2026-07-04T00:00:00.000Z",
      resourceId: "facility_1",
      resourceType: "facility",
      tenantId: "018f3af2-2fd8-7b36-95a8-329aa08f7625"
    });

    expect(parsed.details.resultCount).toBe(1);
  });
});
