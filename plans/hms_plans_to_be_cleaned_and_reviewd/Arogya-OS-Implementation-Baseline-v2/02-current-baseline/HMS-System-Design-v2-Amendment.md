# HMS System Design v2 Amendment

**Date:** July 3, 2026  
**Status:** Amendment to `HMS-System-Design.md`  
**Purpose:** Preserve the v1 architecture while correcting the implementation risks found during cross-document review.

---

## 1. What this amendment changes

This amendment does not replace the full System Design. It amends the following sections:

| v1 Section | Amendment |
|---|---|
| High-Level Architecture | Clarify deployable units and trust boundaries. |
| Data Model | Add missing FHIR resources and PHI object model. |
| Offline Tolerance | Remove browser-local PHI persistence. |
| Security & Compliance | Expand RBAC into RBAC + ABAC + audit + consent + key management. |
| Events | Make transactional outbox mandatory before broker. |
| AI Scribe | Add consent, provenance, retention, and vendor controls. |
| e-Rx | Promote medication-safety service from spike to P0 path. |
| Operations | Add backup/restore, incident response, mocks, DLQ, PHI-safe observability. |

## 2. Deployable units

The v1 design says “modular monolith deployed as 3–4 services” but the diagram names many services. For Phase 0, use five deployable units:

```text
1. app-bff
   UI-facing APIs, auth session handling, tenant resolution, screen-optimized endpoints.

2. core-service
   FHIR write/read facade, Patient, Encounter, Appointment, Queue, Chart, e-Rx state machine.

3. revenue-service
   Invoice, GST ledger, payment capture, order-to-bill projection, claim package assembly.

4. ai-worker
   Audio ingest, STT integration, LLM structuring, OCR, AI draft creation.

5. integration-worker
   ABDM, WhatsApp/SMS, payment gateway, NHCX/TPA, HL7/LIS/RIS, retries/DLQ.
```

Cross-cutting modules should be libraries or infrastructure, not separately deployed services in Phase 0:

- authz policy engine;
- audit writer;
- config-pack loader;
- outbox publisher;
- FHIR validator;
- telemetry SDK;
- PHI-safe logging library.

## 3. FHIR/domain resource additions

The v1 key resource list is directionally correct but too narrow for MVP implementation. Add the following first-class resources/contracts:

| Resource / table | Why needed |
|---|---|
| `Appointment` | Scheduling and slot concurrency. |
| `Practitioner` | Doctors/users mapped to clinical identity. |
| `PractitionerRole` | Role/facility/specialty-specific access and ABDM mappings. |
| `DocumentReference` | Lab PDFs, external documents, prescriptions, claim attachments. |
| `Binary` or object pointer | Large files/audio/PDF/image references; avoid inline bloat where possible. |
| `DiagnosticReport` | Lab/radiology reports and OCR-to-structured outputs. |
| `Media` | Audio/image metadata when clinically relevant. |
| `Medication` | Brand/generic/formulary mapping. |
| `DetectedIssue` | Drug interaction/allergy safety warnings and overrides. |
| `Provenance` | AI generation, human edit, sign-off, import lineage. |
| `AuditEvent` or audit-equivalent table | PHI access and disclosure tracking. |
| `ChargeItem` | Order-to-bill capture and revenue leakage detection. |
| `Procedure` | Procedures and billable clinical activities. |
| `Communication` | WhatsApp/SMS delivery status and patient communication trail. |

Non-FHIR domain tables remain acceptable for:

- GST ledger;
- tariff catalog;
- payer contract versions;
- discount approval workflow;
- payment settlement ledger;
- outbox/DLQ;
- tenant export jobs;
- edge sync queue;
- config-pack releases.

## 4. Authorization architecture

Replace “OIDC + RBAC” with:

```text
OIDC authentication
+ tenant/facility resolution
+ RBAC role grant
+ ABAC policy decision
+ Postgres RLS / data-boundary backstop
+ immutable audit event
```

Minimum ABAC attributes:

```text
tenant_id
facility_id
actor_user_id
actor_role
patient_id
encounter_id
resource_type
action
purpose_of_use
current_treatment_relationship
consent_state
break_glass_reason
device_id
```

Policy examples:

- Front desk can search/register patients but cannot read SOAP notes.
- Doctor can read assigned/current patients; unassigned access requires break-glass.
- Billing can read invoices, charge items, claim attachments, and minimum required clinical documents, not full chart by default.
- IT admin can manage users/devices/config but cannot read clinical PHI.
- Arogya support cannot read PHI without customer-approved support session or break-glass.

## 5. Audit architecture

Every API path that touches PHI must write an audit event. Audit writes must happen in the same logical transaction as the PHI decision, or through a fail-closed local outbox.

Mandatory audited actions:

```text
read
search
create
update
sign
print
export
share
delete/seal
break_glass
denied_access
```

Audit store properties:

- append-only;
- hash chained or periodically committed to WORM/object-lock storage;
- redacted metadata only;
- linked to request_id and trace_id;
- dashboard for support access, break-glass, bulk export, after-hours access, and denied access.

## 6. Consent architecture

Add a consent state machine:

```text
draft -> active -> expired
active -> revoked
active -> superseded
```

Consent types:

- per-encounter audio consent;
- ABDM/HIE-CM external sharing consent;
- WhatsApp/SMS delivery consent;
- migration/import consent or hospital authorization;
- support-access consent where applicable.

Audio recording must be physically disabled unless `audio_consent.active == true` for that encounter.

Revocation must emit an event and update downstream sharing state. External integration workers must be idempotent and re-drivable.

## 7. AI scribe architecture amendments

For every AI draft:

- resource status starts as `preliminary`;
- model version stored;
- prompt/template version stored;
- source transcript spans stored;
- confidence stored at field level where possible;
- doctor edits captured as versions;
- sign-off produces final status and `Provenance`;
- low-confidence critical fields require explicit review;
- no preliminary resource can be printed, pushed to ABDM, sent on WhatsApp, billed, claimed, or used as final clinical truth.

Audio storage:

- encrypted object storage;
- per-tenant key hierarchy;
- retention TTL;
- deletion job;
- deletion proof in audit;
- no raw audio in logs/traces/events;
- no vendor training on customer data unless separately approved.

## 8. e-Rx medication safety service

PRD R5 is P0. Therefore the design must include a P0 medication-safety path, not only a spike.

Add `MedicationSafetyService` as a module in `core-service` initially.

Inputs:

- patient allergies;
- active medications;
- proposed medication;
- dose/frequency/duration;
- age/weight/sex if available;
- pregnancy/pediatric flags where captured;
- tenant formulary pack;
- interaction database version.

Outputs:

```text
DetectedIssue {
  severity: severe|moderate|minor|info
  issue_type: drug_drug|drug_allergy|duplicate_therapy|dose_range|contraindication
  evidence_source
  source_version
  affected_medications
  clinician_message
  patient_message_optional
  blocking: true|false
}
```

Signing rule:

- severe issues block sign-off until override reason is entered;
- override is audited;
- non-severe issues are passive and tracked for alert-fatigue review.

## 9. Event and integration reliability

Make the transactional outbox mandatory in Sprint 1. Managed Kafka-compatible broker can follow later.

Minimum event pattern:

```text
FHIR/domain transaction
  -> outbox row committed in same DB transaction
  -> local/in-process projector consumes
  -> broker publisher optional
  -> external integration worker consumes
  -> retry / DLQ / replay UI
```

Required on every external integration:

- idempotency key;
- request/response audit metadata;
- retry with exponential backoff;
- DLQ after bounded attempts;
- replay tool;
- status projection visible to ops/support;
- no PHI in event payload unless necessary.

## 10. Offline/edge amendment

Remove “browser-local” PHI persistence from v1.

Allowed:

- hardened edge agent for registration and billing only;
- encrypted local database/queue;
- device identity;
- mTLS to cloud;
- signed auto-updates;
- queue-depth telemetry;
- remote wipe/deactivation;
- local ULIDs and reserved bill-number ranges;
- conflict workflow for duplicate patients and billing gaps.

Disallowed for v1:

- browser IndexedDB/localStorage containing PHI;
- offline clinical writes;
- offline AI scribe;
- offline ABDM push;
- unencrypted local queues;
- shared terminal accounts.

## 11. Operational amendments

Required before private beta:

- dev/staging/prod separation;
- no production PHI in dev;
- SAST/SCA/secret scan/container scan/IaC scan in CI;
- FHIR validation tests;
- RLS regression tests;
- authz policy tests;
- synthetic tenant isolation tests;
- PITR and restore drill;
- PHI-safe OpenTelemetry attributes;
- mocks for ABDM, WhatsApp, payment, NHCX, STT vendors;
- runbooks for incident, edge loss, outbox replay, backup restore, key rotation, wrong-patient merge.

## 12. Implementation priority

The following must move into Phase 0 P0:

1. Transactional outbox.
2. Audit writer from first PHI write.
3. Authorization policy engine/tests.
4. Audio consent and retention.
5. Tenant-aware backup/restore.
6. PHI-safe logging/telemetry.
7. Medication safety architecture and severe-alert test harness.
8. Migration dry-run harness.
9. Integration retry/DLQ skeleton.

The following can remain deferred:

1. Full WASA closure.
2. Full AND certification closure.
3. Live NHCX claims.
4. Owner NL-Q&A analytics.
5. IPD/pharmacy/LIS replacement.
6. Customer-managed deployment.
