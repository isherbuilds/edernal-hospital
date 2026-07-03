# ADR-013: Clinical Safety and e-Prescription Controls

**Status:** Proposed for acceptance before e-Rx pilot  
**Date:** 2026-07-03  
**Decision owners:** Clinical Advisor, Product Lead, Clinical AI Lead, Core EMR Lead, Compliance Owner

---

## Context

The PRD makes e-prescription safety checks P0 and requires severe interaction blocking, allergy alerts, override reasons, and audit logging. The existing ADR-7 correctly states that AI outputs require human signoff, but e-Rx safety needs a dedicated clinical safety decision.

---

## Decision

Arogya OS will treat prescription creation and AI-generated clinical artefacts as safety-critical workflows:

1. AI may create only preliminary prescription candidates.
2. Only a clinician assigned to the encounter may finalize a prescription.
3. Every prescription must pass medication safety checks before finalization.
4. Severe drug-drug or allergy interactions block finalization until explicit override reason is entered.
5. Non-severe alerts are passive and designed to reduce alert fatigue.
6. Every safety alert and override is audited.
7. The safety engine stores the source/version of the drug dictionary and interaction rules used at signing time.

---

## Medication safety service

Create a `MedicationSafetyService` with the following inputs:

```text
tenant_id
facility_id
patient_id
encounter_id
current_medications[]
proposed_medications[]
allergies[]
age/sex/weight? where available
pregnancy/lactation flags? where available
renal/hepatic flags? where available later
formulary_pack_version
interaction_rule_version
```

Outputs:

```text
DetectedIssue[]
severity = critical|severe|moderate|minor|info
blocking = true|false
message_doctor
message_patient? optional
source_rule_id
source_version
affected_medication_refs
required_action = review|override_required|dose_review|none
```

---

## Prescription state machine

```text
candidate_ai_created
  -> draft_doctor_editing
  -> safety_check_pending
  -> blocked_severe_alert
  -> override_entered
  -> signed_final
  -> printed_or_shared
  -> cancelled_or_superseded
```

Rules:

- AI cannot transition beyond `candidate_ai_created`.
- Doctor must review drug, dose, route, frequency, duration, and allergy conflicts.
- Severe alerts require override reason.
- Signed prescription is immutable except by creating a corrected/superseding prescription.
- Printed/WhatsApp/ABDM output only allowed after `signed_final`.

---

## Required FHIR mapping

- `MedicationRequest` for prescription orders.
- `Medication` or medication codeable concept for formulary mapping.
- `AllergyIntolerance` for allergies.
- `DetectedIssue` for interaction/allergy safety findings.
- `Provenance` for AI generation and clinician signoff.
- `AuditEvent` for safety alert, override, signing, print/share.

---

## Minimum drug dictionary requirements

Before e-Rx pilot:

1. Brand-to-generic mapping for launch formulary.
2. Common dose forms and strengths.
3. Route/frequency normalization.
4. Allergy ingredient mapping.
5. Interaction rule source/version.
6. Update procedure and rollback.
7. Clinical review of severe/critical rule examples.

---

## Alert governance

To avoid alert fatigue:

- Critical/severe: blocking by default.
- Moderate: visible but non-blocking unless hospital policy configures otherwise.
- Minor/info: passive, collapsible, not interruptive.
- Override reasons use structured choices plus optional note.
- Monitor override rate by doctor/drug/rule.
- Review noisy rules monthly during beta.

---

## AI safety hazards to track

1. Wrong patient context.
2. Wrong drug due to speech recognition error.
3. Wrong dose/frequency/duration.
4. Omitted allergy.
5. Omitted current medication.
6. Hallucinated diagnosis/order.
7. Language/code-switch transcription error.
8. Pediatric/geriatric dose sensitivity.
9. Similar-sounding brand names.
10. Doctor signs without review because UI over-trusts AI.

---

## Acceptance criteria

Before e-Rx pilot:

1. Severe drug interaction test blocks signing.
2. Allergy interaction test blocks signing.
3. Override requires reason and emits audit event.
4. Non-severe alert is passive.
5. AI-created prescription cannot be printed/shared before signoff.
6. MedicationSafetyService stores rule version in result.
7. Clinical advisor signs off initial rule set.
8. Regression test suite includes top launch specialty prescriptions.

