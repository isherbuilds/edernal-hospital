# ADR-010: PHI Data Lifecycle, Consent, and Retention

**Status:** Proposed for acceptance before real PHI or audio ingestion  
**Date:** 2026-07-03  
**Decision owners:** Compliance Owner, Clinical Advisor, Platform Lead, Product Lead

---

## Context

Arogya OS will process demographics, identifiers, clinical notes, prescriptions, lab documents, invoices, claims, audio recordings, transcripts, AI drafts, audit logs, exports, and external messages. The existing PRD requires consent-gated recording, audio deletion after configurable retention, ABDM consent, audit trail, backups, and data export. These requirements need a concrete data lifecycle.

---

## Decision

Arogya OS will define PHI lifecycle controls before storing real pilot data:

1. Every data asset is classified before implementation.
2. Consent is explicit and scoped to purpose.
3. Audio retention is minimal by default.
4. AI drafts are preliminary and traceable.
5. External sharing requires a valid consent/share policy.
6. Deletion/correction requests follow a documented legal-retention-aware process.
7. Backups, exports, logs, and events are treated as PHI-bearing surfaces where applicable.

---

## Data classification

| Asset | Classification | Storage pattern | Default retention |
|---|---|---|---|
| Patient demographics | PHI/PII | FHIR `Patient` + projections | Clinical/legal retention policy |
| ABHA/MRN/phone | PHI/identifier | FHIR identifiers + indexed projection | Clinical/legal retention policy |
| Clinical note | PHI | FHIR `Composition` | Clinical/legal retention policy |
| Prescription | PHI/clinical safety | FHIR `MedicationRequest` | Clinical/legal retention policy |
| Orders | PHI/financial | FHIR `ServiceRequest` | Clinical/legal retention policy |
| Lab PDFs/scans | PHI | Object store + `DocumentReference` | Clinical/legal retention policy |
| Audio recording | Highly sensitive PHI | Object store, encrypted | Default delete after signoff unless configured |
| Transcript | PHI | Encrypted object/resource reference | Delete or seal according to configured policy |
| AI draft | PHI/preliminary | FHIR preliminary resource + provenance | Retain as clinical draft only if signed/accepted policy requires |
| Invoice/GST | PHI/financial | Ledger tables + FHIR reference | Tax/legal retention policy |
| Claim package | PHI/financial | Object store + claim resources | Payer/legal retention policy |
| Audit logs | Sensitive operational metadata, may contain PHI references | Append-only audit store | Long retention, WORM export where required |
| Application logs/traces | Must be non-PHI | Observability platform | Short operational retention |
| Exports | PHI | Encrypted object, short-lived signed link | Short TTL unless legal/offboarding process requires |
| Backups | PHI | Encrypted backup store | Backup retention schedule; deletion by expiry |

---

## Consent types

### Encounter audio consent

Required before recording starts.

Consent attributes:

```text
patient_id
encounter_id
consent_type = audio_recording
language
consent_text_version
captured_by
capture_channel = verbal/tablet/form
status = granted|refused|withdrawn
valid_from
valid_until?
audio_retention_policy_id
```

If consent is refused or withdrawn, recording UI must be disabled. Templates/dictation without recording should remain available.

### ABDM sharing consent

External record sharing requires ABDM/HIE-CM consent artefact or equivalent internal share policy. Consent must be checked at the time of share and before retry/re-drive.

### WhatsApp/SMS patient communication consent

Sending links/messages to patient communication channels requires patient communication consent and verified destination.

### Claims/payment purpose

Billing and claim workflows may access payer-required documents under `purpose_of_use = payment`, but every access must be auditable and limited to required documents.

---

## Retention decisions

1. Audio default retention: delete after clinician signoff and quality window, unless a pilot agreement configures otherwise.
2. Audio used for model evaluation must be explicitly consented, de-identified where feasible, and stored separately from operational audio.
3. Transcripts are PHI and must not be used as casual debug artifacts.
4. Preliminary AI drafts must not be externally shared.
5. Audit logs must not store raw transcript, raw audio, diagnosis text, full prescription text, or document body.
6. Exports expire by default and require manifest/checksum.
7. Backups retain deleted PHI until backup expiry unless legal process requires special handling.

---

## Deletion and correction model

Clinical systems require immutability for medico-legal integrity, but privacy obligations require correction/remediation. Arogya OS will implement:

1. **Correction by versioning:** incorrect clinical facts are corrected with new FHIR resource versions.
2. **Sealing:** prior versions containing wrong sensitive PHI may be restricted from normal views.
3. **Cryptographic deletion:** audio, transcripts, temporary extracts, and exports can be deleted by destroying object keys or deleting encrypted objects.
4. **Backup expiry:** deleted data persists in backups only until backup retention expiry, documented in policy.
5. **Audit proof:** deletion event records object identifier, actor, policy, timestamp, and result, but not the deleted payload.

---

## Implementation requirements

- Consent table/resource maps to FHIR `Consent` where applicable.
- Recording API checks consent before stream initialization and on reconnect.
- Object store uses tenant-scoped encryption keys.
- Deletion worker is idempotent and emits audit event.
- PHI inventory must be updated for every new table/topic/object.
- Data migration scripts must preserve provenance and import source.
- Non-production environments must use synthetic or formally de-identified data.

---

## Acceptance criteria

Before real PHI pilot:

1. Consent capture implemented for audio.
2. Consent checked at recording start and reconnect.
3. Audio object encryption verified.
4. Audio deletion job tested end to end.
5. Audit proof generated for deletion.
6. PHI inventory exists and is reviewed by engineering lead.
7. Backup/restore test completed in isolated environment.
8. Non-production data policy acknowledged by engineers.

