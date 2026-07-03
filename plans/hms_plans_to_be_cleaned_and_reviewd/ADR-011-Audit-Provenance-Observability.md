# ADR-011: Audit, Provenance, and PHI-safe Observability

**Status:** Proposed for acceptance before real PHI ingestion  
**Date:** 2026-07-03  
**Decision owners:** Platform Lead, Security Lead, Clinical AI Lead, Compliance Owner

---

## Context

The current architecture requires full audit trail, AI provenance, OpenTelemetry, and PHI redaction. These controls need one consistent design. In healthcare, logs and traces can become a second PHI database if not controlled.

---

## Decision

Arogya OS will implement three separate but linkable evidence streams:

1. **Audit events:** security/compliance record of who accessed or changed PHI.
2. **FHIR provenance:** clinical record lineage for AI drafts, clinician edits, signatures, imports, and corrections.
3. **Operational telemetry:** PHI-safe logs, metrics, and traces for debugging and reliability.

Audit/provenance may reference PHI resources by ID and version, but operational telemetry must not contain PHI payloads.

---

## Audit event schema

Minimum fields:

```text
audit_event_id
tenant_id
facility_id
actor_user_id
actor_role
actor_practitioner_id?
patient_id?
encounter_id?
resource_type?
resource_id?
resource_version?
action = read|search|create|update|delete|export|print|share|sign|break_glass|support_access|login|deny
purpose_of_use = treatment|payment|operations|patient_request|audit|support|emergency|system
policy_id
decision = allow|deny
client_app
device_id
source_ip_hash
request_id
trace_id
timestamp_server
hash_prev?
metadata_json_non_phi
```

---

## Events that must be audited

1. Login/logout and failed login.
2. Patient search.
3. Patient chart read.
4. Clinical document read.
5. Clinical write/update/sign.
6. Prescription draft/finalize/print/share.
7. Order creation/cancellation.
8. Invoice finalization/refund/discount approval.
9. Claim package generation/export/share.
10. ABDM share/revocation handling.
11. WhatsApp/SMS delivery of document links.
12. Data export.
13. Break-glass access.
14. Support/admin PHI access.
15. Authorization deny decisions for sensitive endpoints.

---

## AI provenance requirements

Every AI-generated artefact must persist as preliminary until human signoff and include provenance:

```text
model_provider
model_name
model_version
prompt_template_version
schema_version
source_transcript_id
source_audio_id?
source_span_refs
confidence_by_field
created_by_service
reviewed_by_user_id?
signed_by_practitioner_id?
signed_at?
edit_distance_or_field_edits?
```

FHIR resources affected:

- `Composition`
- `MedicationRequest`
- `ServiceRequest`
- `Observation`
- `Condition`
- `DocumentReference` extracted facts
- `Claim`/claim pre-scrub recommendations

---

## Immutability and tamper evidence

Audit events are append-only. The system should support hash chaining or periodic signed manifests. At minimum, deletion or update of audit rows is prohibited for application roles. Audit export must be tenant-scoped and checksumed.

---

## PHI-safe observability rules

Forbidden in logs, traces, metrics, and error messages:

- Patient name.
- Phone number.
- ABHA/MRN/Aadhaar/DL identifiers.
- Address.
- Diagnosis text.
- Prescription text.
- Transcript text.
- Audio content.
- Lab report body.
- Claim document body.
- Free-text clinical note.

Allowed:

- Request ID.
- Trace ID.
- Tenant ID or tenant pseudonym, based on environment.
- Resource type.
- Resource ID hash if needed.
- Status code.
- Latency.
- Error code.
- Policy ID.
- Queue depth.
- Integration adapter name.

---

## Required dashboards

Before private beta:

1. PHI reads by role and tenant.
2. Denied authorization attempts.
3. Support/admin access events.
4. Break-glass events.
5. Bulk export/download events.
6. Audio deletion success/failure.
7. ABDM/WhatsApp integration failure and re-drive queue.
8. Scribe draft latency and signoff time.
9. Unbilled-order age.
10. Queue registration latency.

---

## Acceptance criteria

- Audit write path exists before first PHI write.
- Every PHI endpoint has audit test coverage.
- Logs/traces pass automated PHI redaction tests.
- AI draft includes provenance metadata.
- Clinician signoff creates provenance and audit events.
- Audit export works per tenant.
- Operational debugging can be performed without raw PHI logs.

