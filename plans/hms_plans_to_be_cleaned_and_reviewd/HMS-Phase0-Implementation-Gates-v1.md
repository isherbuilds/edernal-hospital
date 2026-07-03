# HMS Phase 0 Implementation Gates v1

**System:** Arogya OS / HMS  
**Date:** 2026-07-03  
**Status:** Proposed execution control document

---

## Purpose

This document converts architecture into engineering gates. It is designed to let the team start coding quickly without accidentally crossing into unsafe PHI processing or premature product launch.

---

## Gate 0 — Coding may start

**Goal:** Build foundations with synthetic data.

### Required before Gate 0

- Engineering owner assigned.
- Product owner assigned.
- Compliance/security owner assigned, even if part-time.
- Source repo and branch policy decided.
- Local dev environment standard decided.
- Synthetic data policy accepted.

### Allowed work

- Repo/CI/CD.
- Infrastructure baseline.
- FHIR store skeleton.
- Tenant middleware.
- RLS proof of concept.
- OIDC test login.
- Quick-register synthetic flow.
- Queue synthetic flow.
- Outbox/event skeleton.
- Audit write skeleton.
- Scribe harness on synthetic/de-identified audio.
- Integration mocks.

### Exit criteria

- Register synthetic patient -> persist FHIR `Patient` -> emit event -> appear in queue.
- Cross-tenant RLS test fails as expected.
- Audit event emitted for synthetic patient create/read.
- CI runs tests and scanners.

---

## Gate 1 — Real PHI may enter controlled staging/pilot environment

**Goal:** Safely handle real patient registration and limited real workflows.

### Required controls

- ADR-008 Deployment Model accepted.
- ADR-009 Authorization Model accepted.
- ADR-010 PHI Lifecycle/Consent/Retention accepted.
- ADR-011 Audit/Provenance/Observability accepted.
- PHI inventory exists.
- KMS/object encryption configured.
- RLS enabled on PHI tables and projections.
- Audit events emitted for PHI reads/writes.
- PHI-safe logging tests pass.
- Backup and restore test passes.
- Incident/support access procedure exists.
- Pilot hospital agreement covers data processing and responsibilities.

### Allowed work

- Real patient registration at design partner.
- Real queue operation.
- Limited billing draft without external sharing.
- Real audio capture only if audio-specific consent/deletion path is complete.

### Still blocked

- External ABDM record sharing.
- WhatsApp prescription/bill delivery with PHI.
- e-Rx finalization unless ADR-013 controls are implemented.
- Claims package submission.
- Customer support PHI access without approved support workflow.

---

## Gate 2 — Real audio and AI drafts may be used in pilot

**Goal:** Validate the AI core with real doctors and controlled consent.

### Required controls

- Encounter audio consent implemented.
- Recording UI disabled without consent.
- Audio encrypted at rest.
- Audio deletion job implemented and tested.
- STT/LLM vendor data-processing terms approved.
- AI provenance metadata stored.
- Draft/sign state machine implemented.
- AI preliminary resources cannot be printed/shared/exported.
- Clinical advisor approves pilot safety script.

### Exit criteria

- Real consult audio processed only after consent.
- Draft note generated with source spans/confidence.
- Doctor edit/sign creates provenance and audit events.
- Audio deletion proof exists after retention event.

---

## Gate 3 — e-Rx may be piloted

**Goal:** Allow signed prescriptions with safety checks.

### Required controls

- ADR-013 accepted.
- Medication dictionary versioned.
- Severe drug-drug interaction blocks signing.
- Allergy conflict blocks signing.
- Override requires reason.
- Override audit event emitted.
- Prescription can be printed/shared only after clinician signoff.

### Exit criteria

- At least 20 medication safety regression tests pass.
- Clinical advisor signs off initial rule set.
- Doctor-facing UI highlights critical drug/dose/allergy fields.

---

## Gate 4 — External sharing may be enabled

**Goal:** Allow ABDM, WhatsApp, payment, and claims-related external actions.

### Required controls

- ADR-012 accepted.
- Consent checked at send and retry time.
- Idempotency implemented.
- Retry/DLQ/re-drive implemented.
- Integration mocks in CI.
- Audit events emitted for outbound PHI share.
- Short-lived signed document links implemented.
- External adapter credentials stored in KMS.

### Exit criteria

- ABDM sandbox share succeeds with valid FHIR bundle.
- Consent revocation blocks pending share/retry.
- WhatsApp document link expires correctly.
- Payment callback idempotency test passes.

---

## Gate 5 — Private beta go-live

**Goal:** Use the product at design partner hospitals for real operational feedback.

### Required controls

- Gates 0–4 completed for enabled scope.
- Pilot runbook created.
- On-call rotation defined.
- Support access workflow tested.
- Incident response tabletop completed.
- Tenant export tested.
- Restore drill completed.
- Product analytics are PHI-safe.
- Training/onboarding material ready for front desk, doctors, billing, admin.

### Exit criteria

- Design partner signs pilot acceptance.
- Founder/product owner approves scope cutline.
- Compliance/security owner signs minimum trust checklist.
- Engineering lead confirms rollback plan.

---

## Gate discipline

A scope item that cannot pass its gate must be disabled by feature flag. Pilot learning is valuable, but patient trust is the product foundation.

