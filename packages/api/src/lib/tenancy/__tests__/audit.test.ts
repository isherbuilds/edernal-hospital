import { describe, expect, it } from "vite-plus/test";

import { createTenantAudit } from "#@/lib/tenancy/audit";

describe("tenant audit", () => {
  it("records sign write actions", async () => {
    const records: unknown[] = [];
    const audit = createTenantAudit({
      insert: async (record) => {
        records.push(record);
      },
      procedure: "consult.sign"
    });

    await audit.write({
      action: "sign",
      details: {
        artifactStatus: "signed"
      },
      resourceId: "note_1",
      resourceType: "consult_note"
    });

    expect(records).toEqual([
      expect.objectContaining({
        action: "sign",
        details: {
          artifactStatus: "signed",
          procedure: "consult.sign"
        },
        resourceId: "note_1",
        resourceType: "consult_note"
      })
    ]);
  });

  it("records print actions with procedure details and PHI redaction", async () => {
    const records: unknown[] = [];
    const audit = createTenantAudit({
      insert: async (record) => {
        records.push(record);
      },
      procedure: "prescription.print"
    });

    await audit.print({
      details: {
        allergies: "Peanuts",
        copyCount: 1
      },
      resourceId: "prescription_1",
      resourceType: "prescription"
    });

    expect(records).toEqual([
      expect.objectContaining({
        action: "print",
        details: {
          allergies: "[REDACTED]",
          copyCount: 1,
          procedure: "prescription.print"
        },
        resourceId: "prescription_1",
        resourceType: "prescription"
      })
    ]);
  });

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
