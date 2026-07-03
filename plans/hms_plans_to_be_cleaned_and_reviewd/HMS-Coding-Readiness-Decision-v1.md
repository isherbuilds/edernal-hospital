# HMS Coding Readiness Decision v1

**System:** Arogya OS / HMS  
**Decision date:** 2026-07-03  
**Status:** Accepted as Phase 0 engineering gate  
**Audience:** Founders, engineering leads, clinical advisor, compliance owner

---

## 1. Executive decision

The current PRD, System Design, ADRs, Roadmap, and MVP decision direction are sufficient to start **Phase 0 foundation coding**, but not sufficient to ingest real PHI or launch even a private beta.

The team may start coding now on synthetic data and non-PHI scaffolding. The team must not store real patient data, real consult audio, real prescriptions, or real ABDM/WhatsApp patient payloads until the Minimum Viable Trust controls listed in this document are implemented and tested.

**Position:** Ship fast, but do not defer the trust boundary.

---

## 2. What engineering may start immediately

These workstreams are cleared for immediate implementation:

1. Repository structure, monorepo/service layout, coding standards, local developer environment.
2. CI pipeline with tests, static checks, dependency scanning, and database migration checks.
3. Infrastructure-as-code for dev and staging environments using synthetic data only.
4. FHIR R4 canonical persistence skeleton for `Patient`, `Encounter`, and `Composition`.
5. HAPI/FHIR profile validation harness in CI.
6. Tenant resolution middleware and `tenant_id` propagation across request context.
7. Postgres row-level security proof of concept with automated cross-tenant leakage tests.
8. OIDC authentication integration with test identity provider.
9. Role seed data and deny-by-default API middleware.
10. Quick-register API and UI using synthetic patients.
11. Queue/token service with concurrency and idempotency tests.
12. Transactional outbox table and local event projector.
13. Audit event write path for every synthetic PHI read/write.
14. PHI-safe logging library and redaction tests.
15. Scribe bake-off harness using synthetic or explicitly de-identified audio fixtures.
16. Mock adapters for ABDM, WhatsApp BSP, payment gateway, STT vendors, and NHCX.

---

## 3. What is blocked until additional controls are ready

The following work may be designed but must not process real patient data until the related control spec is approved:

| Blocked capability | Reason blocked | Required unblocker |
|---|---|---|
| Real patient registration | Creates PHI and identity records. | Authorization model, audit event store, retention policy, backup/restore proof. |
| Real consult audio capture | Captures highly sensitive PHI. | Consent/retention spec, object encryption, access audit, deletion proof, vendor DPA/no-training terms. |
| AI-drafted notes from real audio | Clinical safety and provenance risk. | AI provenance, human-signoff state machine, clinical safety checklist. |
| e-Prescription signing | Patient safety risk. | Medication safety ADR, interaction/allergy rule source, override audit. |
| WhatsApp Rx/bill delivery | PHI leaves core system. | Patient communication consent, short-lived document links, template policy, delivery audit. |
| ABDM record sharing | External health-data exchange. | Consent artefact lifecycle, revocation propagation, ABDM mock + sandbox validation. |
| Claims package generation with real docs | May expose diagnoses, reports, and financial data. | Purpose-of-use policy, payer checklist versioning, export/audit controls. |
| Customer support access to tenant data | Insider/access risk. | Support access policy, time-bound approval, break-glass audit, PHI-safe logs. |
| Edge/offline sync on hospital machines | PHI at endpoint. | Secure edge ADR, encrypted local DB, mTLS, signed updates, remote wipe. |

---

## 4. Minimum Viable Trust controls before real PHI

These are not “full compliance”; they are the minimum trust envelope for pilot learning.

### 4.1 Identity and access

- OIDC authentication enabled for all users.
- Tenant resolution is mandatory on every request.
- API authorization is deny-by-default.
- Role-based access exists for front desk, doctor, billing, admin, and support.
- Attribute checks include tenant, facility, role, relationship-to-patient, encounter assignment, purpose of use, and consent state where applicable.
- Postgres RLS is enabled on all PHI tables and projections.
- Automated tests prove cross-tenant reads and writes fail.

### 4.2 PHI data lifecycle

- PHI inventory exists for every table, event, object, log, backup, and export path.
- Audio retention default is post-signoff deletion unless a design partner explicitly configures a longer retention period.
- Audio, PDFs, scans, exports, and transcripts are encrypted with tenant-scoped keys.
- Deletion job emits audit proof without retaining the deleted payload.
- Backups and restores are tested before pilot data enters the system.

### 4.3 Audit and provenance

- Every PHI read, search, create, update, export, print, share, and support access emits an audit event.
- AI drafts include model version, prompt/schema version, source transcript span, confidence, and clinician signoff state.
- Audit logs are append-only and exportable per tenant.
- Logs and traces are PHI-safe by default.

### 4.4 Integration reliability

- Transactional outbox is the only source for async external actions.
- All external calls use idempotency keys.
- Retry policy, dead-letter queue, and manual re-drive are specified before ABDM/WhatsApp/payment production use.
- Integration mocks exist for deterministic CI tests.

### 4.5 Clinical safety

- AI outputs are preliminary until human signoff.
- Severe drug interaction/allergy alerts block signing until explicit override reason is entered.
- Every override is audited.
- Clinical advisor has reviewed the AI note and e-prescription safety flow before pilot.

---

## 5. Engineering gate checklist

A pull request that touches PHI or clinical workflow must answer these questions:

1. Which actor can call this endpoint?
2. Which tenant/facility/patient scope is required?
3. Which purpose of use applies?
4. Does this endpoint read/write/export/share PHI?
5. Which audit event is emitted?
6. Can front desk, billing, doctor, admin, support, and patient roles access it correctly?
7. Does the SQL query rely on RLS as a backstop?
8. Could PHI enter application logs, error messages, traces, metrics, or events?
9. What happens if the downstream adapter fails after the database transaction commits?
10. Is the operation idempotent?
11. Is there a FHIR resource version/provenance impact?
12. What happens during tenant export/offboarding?
13. What happens during backup restore?
14. Does this create a new data retention obligation?
15. Does this affect a clinical safety boundary?

---

## 6. Start/hold decision by sprint

| Sprint workstream | Start now? | Notes |
|---|---:|---|
| Repo, CI, local dev, IaC | Yes | No PHI dependency. |
| FHIR store skeleton | Yes | Use synthetic data. |
| RLS and tenant middleware | Yes | Required before PHI. |
| Quick registration | Yes | Synthetic data first. |
| Queue board | Yes | Synthetic data first. |
| Outbox/events | Yes | Needed before integrations. |
| Audit write path | Yes | Must be in Sprint 1, not Sprint 2. |
| Scribe harness | Yes | Synthetic/de-identified audio only. |
| Real audio capture | No | Wait for consent, retention, encryption, audit, vendor terms. |
| ABDM live/sandbox patient payloads | Design only | Mocks first, then sandbox after consent/audit path. |
| WhatsApp patient delivery | Design only | Use mock delivery first. |
| e-Rx signing | Design only | Wait for medication safety ADR. |
| Edge gateway | Design only | Wait for secure edge ADR. |

---

## 7. Required new ADRs and specs

The following documents should be accepted before private beta:

1. ADR-008: MVP Deployment Model.
2. ADR-009: Authorization Model — RBAC + ABAC + RLS.
3. ADR-010: PHI Data Lifecycle, Consent, and Retention.
4. ADR-011: Audit, Provenance, and PHI-safe Observability.
5. ADR-012: Integration Reliability and Contract Discipline.
6. ADR-013: Clinical Safety and e-Prescription Controls.
7. ADR-014: Secure Edge Gateway and Offline Sync, if offline is included in beta.
8. FHIR Resource Contract and API Surface v1.
9. Phase 0 Implementation Gates and Pilot Readiness Checklist.
10. Incident Response and Support Access Runbook.

---

## 8. Non-negotiables

1. No real patient audio without explicit per-encounter consent.
2. No PHI write without audit event emission.
3. No cross-tenant query without RLS tests.
4. No AI draft reaches patient, ABDM, printed Rx, or claim without human signoff.
5. No external PHI delivery without idempotency, retry, and audit.
6. No support/admin PHI access without time-bound approval and audit.
7. No production data in developer environments.

