# HMS MVP Backlog Cutline v1

**Date:** July 3, 2026  
**Purpose:** Prevent MVP scope creep while preserving architecture for later expansion.

---

## 1. MVP definition

The MVP exists to prove three things:

1. **Doctors will use AI-assisted documentation in real OPD flow.**
2. **Hospitals can capture revenue that is currently missed.**
3. **The system can handle PHI safely enough for private beta and later certification.**

Anything that does not strengthen one of these three proof points should be deferred.

## 2. P0 — Cannot private-beta without

| Area | Include in MVP | Notes |
|---|---|---|
| Registration/MPI | Name/phone quick register, ABHA sandbox/M1, duplicate detection v0, emergency/zero-ID path | Aadhaar/DL OCR can be behind feature flag if not ready. |
| Queue/scheduling | Walk-in tokens, appointment slots, no-double-booking, live queue board | Estimated wait time can be simple. |
| Clinical chart | Patient, Encounter, Composition, MedicationRequest, ServiceRequest, Observation, AllergyIntolerance, DocumentReference basics | Full chart sophistication can grow. |
| AI scribe | Consent-gated audio, STT bake-off, draft SOAP/Rx/orders, doctor edit/sign, preliminary/final state machine | Dictation-first fallback if bake-off fails. |
| e-Rx safety | Severe interaction/allergy blocking path, override reason, audit | Use limited drug database if necessary but do not omit control path. |
| Billing | Service catalog, payer tariff v0, order-to-bill capture, GST invoice v0, payment capture, day close | Accounting integrations can wait. |
| Revenue integrity | Ordered-not-billed queue, nightly leakage digest v0 | AI pre-scrub can start simple/rule-based. |
| ABDM | M1 sandbox, FHIR profile validation, consent model, bundle generation path | Full AND before GA, not first pilot. |
| Security | Tenant isolation, OIDC, RBAC/ABAC, audit, encryption, backup/restore, PHI-safe logs | Non-negotiable for real PHI. |
| Migration | Dry-run importer for patients/tariffs/doctors, validation report | Full importer matrix can wait. |
| Observability | Product SLIs + technical traces with PHI-safe attributes | Needed for pilot learning. |

## 3. P1 — Private beta / fast follow

| Area | Fast-follow scope |
|---|---|
| NHCX | Live submission for supported payers; MVP only needs adapter architecture and claim package. |
| Owner analytics | Mobile dashboard, NL-Q&A, deeper trends. |
| WhatsApp assistant | Booking, payment links, follow-up reminders. MVP only needs delivery of token/Rx/bill links if ready. |
| Additional languages | Tamil/Telugu after Hindi/English/Hinglish base path. |
| Advanced OCR | Lab PDF → trended Observations with human verification. MVP can start with document upload + manual tagging. |
| Full migration suite | Hospital-specific importers, fidelity audit automation. |
| HL7/LIS/RIS | Integration with selected design-partner systems. |
| Edge offline gateway | Registration/billing edge deployment after core flow stabilizes; no browser-local PHI. |

## 4. P2/P3 — Architect for, do not build in MVP

| Area | Reason to defer |
|---|---|
| IPD/ADT/nursing/eMAR/OT/ICU | Triples workflow surface area; OPD wedge must win first. |
| Pharmacy inventory replacement | Operationally deep and distracts from OPD/billing wedge. |
| LIS/RIS/PACS replacement | Integrate first; replacement later. |
| Customer-managed/on-prem deployment | Slows early iteration; use Arogya-managed dedicated tenants first. |
| Marketplace/API platform | Architecture can support later; do not build developer platform now. |
| Global market entry | Keep portability via FHIR/config packs; avoid GTM/certification distraction. |
| Advanced population analytics | Requires separate legal/privacy review. |
| Autonomous clinical decisions | Explicitly out of scope permanently unless future regulatory/safety decision changes. |

## 5. Feature kill/scope rules

A feature stays in MVP only if it satisfies at least one:

```text
[ ] Needed for real OPD workflow.
[ ] Needed for doctor adoption of AI documentation.
[ ] Needed for revenue capture/billing proof.
[ ] Needed for safe PHI handling.
[ ] Needed for ABDM/WASA/GA path and cannot be retrofitted.
```

A feature is deferred if:

```text
[ ] It is mainly enterprise polish.
[ ] It requires a new external dependency not needed for MVP proof.
[ ] It creates a new regulated workflow not central to OPD/billing.
[ ] It adds operational complexity without immediate learning value.
[ ] It can be handled manually during 3–5 design-partner pilots.
```

## 6. MVP release names

### Internal Alpha

Synthetic data only. Demonstrates registration, queue, FHIR persistence, audit, outbox, synthetic scribe draft.

### Design-Partner Pilot 1

Controlled real demographics and limited clinical/audio under minimum viable compliance controls.

### Private Beta

Full OPD wedge at 3–5 design partners: registration, queue, consult draft/sign, e-Rx, billing, order-to-bill, basic ABDM path, basic claims package.

### GA

Hardening, onboarding/migration, ABDM/AND, WASA, support process, pricing, 2-city GTM launch.

## 7. Anti-goals for MVP

- No IPD build.
- No customer-managed deployment.
- No broad analytics lakehouse.
- No marketplace.
- No autonomous clinical decisions.
- No real PHI in dev.
- No browser-local PHI persistence.
- No unmanaged WhatsApp PHI text dumps.
- No preliminary AI artefact sent externally.
