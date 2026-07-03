# HMS Minimum Viable Compliance Spec v1

**Project:** Arogya OS  
**Date:** July 3, 2026  
**Status:** Required before real patient data/audio pilots  
**Principle:** Certification can be deferred; core safety controls cannot.

---

## 1. Scope

This document defines the minimum technical and operational controls required before the system processes real patient information, clinical notes, prescriptions, audio recordings, billing records, claims, or external records.

This is not a full HIPAA/GDPR/DPDP/ABDM certification program. It is the minimum control envelope for a responsible private beta.

## 2. PHI asset inventory

The engineering team must treat the following as PHI or sensitive data:

| Asset | Examples | Storage locations |
|---|---|---|
| Patient identity | Name, phone, ABHA, MRN, DOB, address, Aadhaar/DL OCR output | FHIR `Patient`, MPI projections, search indexes, import files |
| Clinical chart | Conditions, notes, vitals, allergies, medications, observations | FHIR JSONB resources, projections, caches |
| Audio/transcripts | Consult audio, diarized transcript, model intermediate text | Object storage, STT vendor, AI pipeline queues |
| Prescriptions/orders | Rx, dose, duration, lab orders, procedures | FHIR `MedicationRequest`, `ServiceRequest`, printed/WhatsApp documents |
| Billing/claims | Invoices, discounts, payer docs, PM-JAY/TPA packages | Revenue tables, FHIR `Claim`, object storage |
| Documents | Lab PDFs, scanned records, images, discharge summaries | Object storage, `DocumentReference`, OCR outputs |
| Audit logs | Access records, IP/device/session, export/share events | Audit store, WORM archive |
| Backups/exports | Logical backups, tenant exports, migration files | Backup storage, signed URLs, admin workstations |

## 3. Control gates

### Gate A — Before synthetic demos

Required:

- Repo created with branch protection.
- CI runs tests, lint, migration checks, dependency scan, secret scan.
- Dev/staging/prod environment separation defined.
- No real patient data in developer laptops or dev databases.

### Gate B — Before real patient demographics

Required:

- OIDC auth.
- Tenant resolution.
- RLS or dedicated tenant data boundary.
- RBAC roles for front desk, doctor, billing, admin, support.
- Audit event for every patient create/update/read/search.
- Backup/PITR configured.
- PHI-safe logging enabled.

### Gate C — Before real clinical data

Required:

- ABAC patient-access policy.
- Treating-relationship/context enforcement for doctors.
- Billing role can see minimum necessary clinical attachments only.
- Support/IT admin cannot read clinical payload by default.
- FHIR validation in CI and write path for supported resources.
- `Provenance` or equivalent metadata for AI-generated resources and human sign-off.
- Audit immutability strategy implemented.

### Gate D — Before real audio

Required:

- Per-encounter consent flag.
- Recording UI physically disabled until consent exists.
- Audio object encrypted with tenant-scoped key.
- Audio retention TTL set and deletion job tested.
- Deletion proof written to audit.
- STT/LLM vendor terms reviewed for no-training, retention, region, subprocessors, breach support.
- Transcript/model intermediate retention defined.

### Gate E — Before external sharing

Required:

- External-share consent state machine.
- ABDM/HIE-CM adapter uses idempotency keys and retry/DLQ.
- WhatsApp/SMS document links are short-lived and do not expose PHI in message preview.
- Export jobs require admin approval and audit.
- No preliminary AI artefact can be sent, printed, billed, claimed, or pushed externally.

## 4. Authorization model

Minimum roles:

| Role | Allowed | Denied by default |
|---|---|---|
| Front desk | Register/search patient, appointments, queue, collect payment status | SOAP notes, diagnoses, full prescription contents except delivery/print status |
| Doctor | Assigned/current patients, chart, draft review/sign, e-Rx | Unassigned patient browsing without break-glass/treatment context |
| Billing executive | Charges, invoices, claims, payer docs, minimal required clinical attachments | Full chart browsing |
| Hospital admin/owner | User management, operational dashboards, audit reports, limited patient access with explicit purpose | Bulk PHI export without approval |
| IT admin | Users/devices/config | Clinical PHI read |
| Arogya support | Tenant metadata, non-PHI logs, feature flags | PHI read unless customer-approved support/break-glass session |
| Patient | Own shareable records through approved channel | Staff/admin endpoints |

### Authorization checks required on every request

```text
tenant_id
facility_id
actor_user_id
actor_role
patient_id
encounter_id if applicable
purpose_of_use
resource_type
resource_id
action: read|search|create|update|delete|export|share|sign|print
consent_state if external share or audio
break_glass_reason if emergency override
```

## 5. Audit-event schema

Minimum fields:

```text
id
tenant_id
facility_id
actor_user_id
actor_role
patient_id nullable
resource_type
resource_id
resource_version nullable
action
decision: allow|deny
purpose_of_use
policy_id
client_app
device_id
source_ip
request_id
trace_id
timestamp_server
hash_prev nullable
metadata_json redacted
```

Requirements:

- Append-only.
- No clinical free text in audit metadata.
- Hash chain or WORM archive for tamper evidence.
- Audit events for denied access attempts.
- Export/share/print/sign/delete always audited.
- Support/break-glass accesses reviewed weekly during pilot.

## 6. Encryption and key management

Minimum:

- TLS for all external traffic.
- mTLS or service identity tokens for internal service calls.
- KMS-backed tenant key material.
- Envelope encryption for audio, documents, exports, and backups.
- Key version stored with encrypted objects.
- Key rotation procedure documented.
- Access to KMS keys logged and alertable.

## 7. Logging and telemetry rules

Never log:

- patient name
- phone number
- ABHA/Aadhaar/DL
- address
- diagnosis
- prescription text
- transcript
- note content
- lab values
- invoice line details tied to patient
- external document contents

Allowed in logs:

- tenant_id
- request_id
- trace_id
- resource_type
- opaque resource_id
- latency
- status code
- policy decision
- error code

## 8. AI safety minimums

- AI output status starts as `preliminary`.
- Human sign-off required for `final`.
- Critical fields require explicit doctor review: drug, dose, frequency, duration, allergy, diagnosis, procedure, investigation order.
- Store model version, prompt/template version, source transcript spans, confidence, and sign-off actor.
- Severe medication-safety alerts block signing until override reason is entered.
- Low-confidence drafts are visibly flagged and cannot silently become final.

## 9. Backup, restore, and export

Required before pilot:

- PITR configured.
- Nightly logical backup.
- One restore drill into isolated environment.
- Backup access restricted and audited.
- Tenant export job design with approval, manifest, checksum, expiry, and audit event.
- No raw production PHI copied into dev.

## 10. Incident response minimum

Before pilot, create a short runbook covering:

1. Suspected unauthorized access.
2. Lost/stolen edge device.
3. Vendor/API breach notice.
4. Ransomware or destructive DB event.
5. Mis-sent WhatsApp/SMS document.
6. Wrong-patient merge or record linkage.
7. AI-generated unsafe prescription draft.

Each runbook must define: detection, containment, responsible owner, evidence to preserve, customer communication path, and corrective action.

## 11. Private beta sign-off checklist

```text
[ ] Security owner assigned.
[ ] Compliance/risk register created.
[ ] PHI inventory reviewed.
[ ] Tenant isolation test passed.
[ ] RBAC/ABAC test suite passed.
[ ] Audit write/read/dashboard smoke test passed.
[ ] Backup restore drill completed.
[ ] Audio consent and retention tested.
[ ] Vendor checklist completed.
[ ] AI human-signoff state machine tested.
[ ] Medication safety blocking-alert flow tested or e-Rx disabled until implemented.
[ ] Support access process documented.
```
