# HMS Coding Readiness Pack

This pack answers whether Arogya OS is ready to start coding and identifies the minimum additional ADRs/specs needed before real patient data enters the system.

## Files

1. `HMS-Coding-Readiness-Decision-v1.md` — start/hold decision and engineering checklist.
2. `ADR-008-MVP-Deployment-Model.md` — Arogya-managed isolated pilot tenant decision.
3. `ADR-009-Authorization-Model-RBAC-ABAC-RLS.md` — role, attribute, tenant, and database authorization model.
4. `ADR-010-PHI-Data-Lifecycle-Consent-Retention.md` — consent, retention, deletion, PHI inventory.
5. `ADR-011-Audit-Provenance-Observability.md` — audit events, AI provenance, PHI-safe logs/traces.
6. `ADR-012-Integration-Reliability-Contracts.md` — outbox, idempotency, retries, DLQ, adapter contracts.
7. `ADR-013-Clinical-Safety-and-eRx-Controls.md` — medication safety and AI clinical safety boundaries.
8. `HMS-Phase0-Implementation-Gates-v1.md` — coding and pilot gates.

## Recommended adoption order

Accept these before real PHI:

1. ADR-008
2. ADR-009
3. ADR-010
4. ADR-011
5. Phase 0 Implementation Gates

Accept these before external integrations and e-Rx pilot:

6. ADR-012
7. ADR-013

