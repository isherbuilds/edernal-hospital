import { describe, expect, it } from "vite-plus/test";

import { createTenantAudit } from "#@/lib/tenancy/audit";

describe("tenant audit", () => {
  it("redacts PHI-like detail fields before insert", async () => {
    const records: unknown[] = [];
    const audit = createTenantAudit({
      insert: async (record) => {
        records.push(record);
      },
      procedure: "patient.probe"
    });

    await audit.write({
      action: "create",
      details: {
        code: "SAFE",
        patientName: "Patient Example",
        policyNumber: "POLICY-1"
      },
      resourceId: "resource_1",
      resourceType: "facility"
    });

    expect(records).toEqual([
      expect.objectContaining({
        details: {
          code: "SAFE",
          patientName: "[REDACTED]",
          policyNumber: "[REDACTED]",
          procedure: "patient.probe"
        }
      })
    ]);
  });
});
