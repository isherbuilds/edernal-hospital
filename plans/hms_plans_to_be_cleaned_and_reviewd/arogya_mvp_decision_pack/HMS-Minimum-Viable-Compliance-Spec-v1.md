# HMS Minimum Viable Compliance Spec v1

**Product:** Arogya OS  
**Date:** 2026-07-02  
**Status:** Proposed engineering gate  
**Scope:** Controls required before Arogya OS handles real patient data, real clinical audio, real prescriptions, real bills, or real claims.

---

## 1. Purpose

This document defines **minimum viable compliance** for the MVP. It is intentionally smaller than a full HIPAA/GDPR/DPDP/WASA/AND compliance program, but it is not optional. It defines the minimum engineering controls needed to avoid creating irreversible privacy, security, and medico-legal debt while still moving fast.

The principle is:

> We can defer external certification. We cannot defer the controls that prevent patient data leakage, unauthorized access, missing audit trails, unsafe AI output, or unrecoverable data loss.

---

## 2. Enforcement rule

No real PHI, patient documents, prescriptions, bills, claims, ABHA-linked records, or real consult audio may enter any Arogya environment unless all **P0 controls** in this document are implemented or explicitly risk-accepted by founders in writing.

Synthetic data may be used before this gate.

---

## 3. P0 control matrix

| ID | Control | Required implementation | Acceptance test |
|---|---|---|---|
| MVC-01 | Environment separation | Separate dev, staging, demo, and prod/pilot environments. Dev/demo must use synthetic data only. | Attempt to import PHI into dev/demo is blocked by policy and monitored. |
| MVC-02 | Identity | OIDC-based login; no shared accounts; MFA required for Arogya admins and hospital admins. | Login audit shows unique actor for every action. |
| MVC-03 | Tenant isolation | Every tenant-scoped row/object/event carries `tenant_id`; for pilot tenants use dedicated DB/schema or equivalent hard boundary plus tenant-specific KMS key. | Automated test proves Tenant A cannot read/search/export Tenant B resources through API or direct DB role. |
| MVC-04 | Role and purpose enforcement | RBAC + ABAC policy engine: actor role, facility, patient relationship, encounter context, purpose-of-use. | Front desk cannot read SOAP notes; billing cannot browse full chart; doctor cannot access unrelated patient without break-glass. |
| MVC-05 | Clinical audit | Audit event emitted for every PHI read/search/create/update/export/print/share/sign/delete. | API test fails if protected endpoint does not create audit record. |
| MVC-06 | Immutable audit storage | Audit events append-only; include actor, tenant, patient, resource, action, purpose, decision, request ID, trace ID, device/IP, timestamp. | Attempted update/delete of audit event is blocked except through privileged retention job. |
| MVC-07 | Consent for audio | Per-encounter consent state required before audio capture UI enables recording. | Recording endpoint rejects request without valid consent ID. |
| MVC-08 | Consent for external sharing | ABDM/WhatsApp/document sharing checks consent/patient communication preference before release. | External-share test without consent returns deny and audit event. |
| MVC-09 | Encryption at rest | Database encrypted; object storage encrypted; per-tenant KMS key/envelope encryption for audio, documents, exports, and transcripts. | Object metadata shows tenant key version; decrypt requires service identity and tenant context. |
| MVC-10 | Encryption in transit | TLS 1.2+ externally; TLS 1.3 preferred; mTLS/service identity for internal service-to-service and edge sync. | Security scan shows no plain HTTP PHI route. |
| MVC-11 | PHI-safe logging | Logging SDK redacts or blocks patient name, phone, ABHA, address, diagnosis, prescription text, transcript, document content, and raw FHIR payloads. | Unit test attempts to log PHI fields and confirms redaction/drop. |
| MVC-12 | Backups and restore | PITR configured; nightly logical backup; one restore drill into isolated environment before pilot. | Restore report includes RPO/RTO and checksum validation. |
| MVC-13 | Human sign-off for AI | AI-generated notes/Rx/orders/claims persist as preliminary; store-level state machine blocks external sharing/printing/submission until signed. | Attempt to print/send/share preliminary AI Rx fails. |
| MVC-14 | AI provenance | Every AI draft records model/vendor, model version, prompt/schema version, source transcript/object reference, confidence, and clinician signer. | Signed note has linked provenance record. |
| MVC-15 | Audio retention/deletion | Configurable retention; default delete after sign-off unless pilot agreement states otherwise; deletion proof stored in audit. | Post-signoff audio object enters deletion queue and deletion audit exists. |
| MVC-16 | Vendor data processing | STT/LLM/WhatsApp/SMS/payment vendors cannot receive PHI/audio without signed terms covering retention, training use, subprocessors, breach notice, and region. | Vendor checklist approved before API key enabled in prod/pilot. |
| MVC-17 | Incident response | Severity matrix, breach triage workflow, named on-call, customer notification template, evidence-preservation steps. | Tabletop exercise run before first pilot. |
| MVC-18 | Data export/offboarding | Tenant export job produces FHIR bundles + CSV projections with manifest/checksums and audit. | Export job for synthetic tenant produces validated bundle and manifest. |
| MVC-19 | Security testing in CI | SAST, dependency scan, secret scan, container/IaC scan, authz tests, RLS tests, FHIR validation tests. | Main branch merge blocked on failed P0 security test. |
| MVC-20 | Break-glass access | Emergency access requires reason, patient, actor, expiry; creates high-severity audit event. | Break-glass without reason denied; break-glass dashboard shows event. |

---

## 4. Authorization model

### 4.1 Actor classes

| Actor | Allowed by default | Denied by default |
|---|---|---|
| Front desk | Registration, demographics, ABHA workflow, queue, appointment, payment collection status. | SOAP notes, diagnosis history, prescriptions except delivery/print status, lab values, claims details. |
| Doctor | Assigned/current patient chart, encounter documentation, prescription draft/sign, orders, clinical history. | Unassigned patient chart unless treatment relationship or break-glass. |
| Billing executive | Bill, invoice, payer details, claim package, order-to-bill status. | Full clinical browse not tied to billing/claim purpose. |
| Hospital admin/owner | User management, configuration, aggregates, audit reports, operational dashboards. | Raw PHI browsing unless also assigned clinical role or approved purpose. |
| IT admin | Devices, users, integrations, connectivity, exports with approval. | Clinical note and prescription read access by default. |
| Arogya support | Tenant metadata, health checks, deployment logs without PHI. | PHI access unless customer-approved time-bound support session. |
| Patient | Own shared records, bills, prescriptions, appointment notifications. | Provider/admin endpoints and other patients' data. |

### 4.2 Policy decision inputs

Every protected API call must include or derive:

```text
tenant_id
facility_id
actor_user_id
actor_role
actor_practitioner_id? / staff_id?
patient_id? / encounter_id?
purpose_of_use
request_id
trace_id
device_id
source_ip
consent_id? where relevant
break_glass_reason? where relevant
```

### 4.3 Required automated policy tests

- Front desk cannot read `Composition`.
- Billing cannot read full chart without claim-specific purpose.
- Doctor cannot read unassigned patient without treatment relationship.
- Hospital IT admin cannot read clinical notes.
- Arogya support cannot access PHI without time-bound customer-approved session.
- Patient cannot call staff APIs.
- External share fails without valid consent.
- Preliminary AI output cannot be exported, printed, shared, or submitted.

---

## 5. Audit event schema

Minimum audit payload:

```json
{
  "audit_event_id": "ulid",
  "tenant_id": "tenant_ulid",
  "facility_id": "facility_ulid",
  "actor_user_id": "user_ulid",
  "actor_role": "doctor|front_desk|billing|admin|support|patient",
  "patient_id": "patient_ulid_or_null",
  "encounter_id": "encounter_ulid_or_null",
  "resource_type": "Patient|Encounter|Composition|MedicationRequest|Invoice|...",
  "resource_id": "resource_ulid_or_null",
  "resource_version": "version_or_null",
  "action": "read|search|create|update|sign|export|print|share|delete|break_glass",
  "purpose_of_use": "treatment|payment|operations|patient_request|support|audit|emergency",
  "decision": "allow|deny",
  "policy_id": "policy_version",
  "consent_id": "consent_ulid_or_null",
  "source_ip": "ip",
  "device_id": "device_ulid_or_null",
  "request_id": "request_ulid",
  "trace_id": "otel_trace_id",
  "timestamp_server": "iso8601",
  "hash_prev": "sha256_previous_event_hash"
}
```

Audit logs must not contain raw transcript text, raw note content, full prescription text, full document content, or raw FHIR payloads unless stored as separately access-controlled FHIR `AuditEvent` resources under the same PHI controls.

---

## 6. Consent and retention minimums

| Data class | Default rule |
|---|---|
| Consult audio | Capture only after explicit per-encounter consent. Delete after doctor sign-off unless design-partner agreement defines a bounded evaluation retention period. |
| Transcript | Store only if needed for provenance/review; otherwise retain source spans/metadata and delete raw transcript on configured TTL. |
| AI draft | Preliminary resource retained with provenance; cannot be externally shared until signed. |
| Signed note/Rx/orders | Clinical record retained according to hospital/legal policy; corrections versioned, not silently overwritten. |
| WhatsApp/SMS payloads | No sensitive PHI in message body. Use short-lived authenticated links. |
| Exports | Time-limited signed URL; manifest/checksum; export audit; delete package after expiry. |
| Logs/traces | No PHI. Retain operational logs separately from audit logs. |
| Backups | Encrypted; access restricted; restore tested; backup expiry documented. |

---

## 7. AI-specific safety controls

1. AI-generated content is always preliminary.
2. Critical fields require explicit clinician review: drug, dose, frequency, duration, allergy, diagnosis, procedure, follow-up, investigation order.
3. Low-confidence fields must be visually marked.
4. Human edits must be stored as diff/provenance metadata.
5. Prompt templates and schema versions must be versioned.
6. Uploaded documents/transcripts must be treated as untrusted input to prevent prompt/document injection.
7. No vendor model training on PHI/audio unless separately agreed and documented.
8. Fallback template/dictation mode must be available when scribe fails.

---

## 8. Edge/offline minimum controls

Offline registration/billing is allowed only if:

- Edge device has unique device identity.
- Sync uses mTLS or equivalent strong service authentication.
- Local queue is encrypted.
- Local queue stores the minimum fields needed.
- Bill numbers use reserved series to prevent duplicates.
- Every queued operation has idempotency key.
- Replay creates audit records.
- Device heartbeat and stuck-queue alerts exist.
- Browser-local PHI persistence is prohibited for v1 except encrypted, short-lived, explicitly reviewed cache.

---

## 9. Go/no-go checklist before real patient data

- [ ] Pilot DPA/addendum signed.
- [ ] Consent language approved.
- [ ] Auth, tenant isolation, role policy, and audit tests passing.
- [ ] KMS keys and object encryption configured.
- [ ] PHI-safe logging SDK enforced.
- [ ] Backup/restore tested.
- [ ] Vendor checklist approved for every PHI processor.
- [ ] AI preliminary/final state machine enforced at store layer.
- [ ] Incident runbook reviewed.
- [ ] Support-access process approved.
- [ ] Synthetic end-to-end workflow demo passed.

---

## 10. Non-goals for this spec

This document does not claim full legal compliance, full WASA readiness, full HIPAA certification, full GDPR compliance, or AND certification. It defines the minimum controls required to safely begin MVP learning with design partners.
