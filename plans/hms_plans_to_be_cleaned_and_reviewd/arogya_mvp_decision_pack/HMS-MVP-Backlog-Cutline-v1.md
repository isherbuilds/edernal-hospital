# HMS MVP Backlog Cutline v1

**Product:** Arogya OS  
**Date:** 2026-07-02  
**Status:** Proposed product/engineering scope control

---

## 1. Purpose

The current PRD correctly describes an ambitious product. The risk is that the team treats too much of it as required for the first MVP. This document defines the cutline between:

1. Pilot MVP
2. Private Beta MVP
3. GA MVP
4. Deferred / architect only

The rule is:

> The first MVP should validate the product loops, not complete the entire hospital operating system.

---

## 2. Pilot MVP — ship this first

### 2.1 Registration and queue

| Capability | Scope |
|---|---|
| Quick registration | Name, phone, age/DOB, sex, basic address optional. |
| Returning patient lookup | Phone lookup and manual confirmation. |
| Token queue | Per-doctor token issue, status, live queue board. |
| Appointment slots | Simple slot creation/check-in if needed by partner; no complex scheduling optimization. |
| ABHA | Sandbox spike only unless production access is ready. |
| Aadhaar/DL OCR | Defer. Manual entry first. |
| Duplicate detection | Basic phone/name/DOB candidate warning. Merge governance later. |

### 2.2 Clinical documentation

| Capability | Scope |
|---|---|
| Consent-gated recording | Required for real audio. |
| Dictation/template fallback | Required. Should be treated as equal path, not failure path. |
| Ambient scribe | Bake-off and controlled pilot only. |
| Draft note | SOAP draft with confidence/low-confidence fields. |
| Draft Rx/orders | Draft-only. No external share until signed. |
| Doctor sign-off | Required. Store-level preliminary/final state machine. |
| Audio retention | Configurable; default delete after sign-off unless agreement says otherwise. |
| Regional languages | Measure; do not commit to broad support in Pilot MVP. |

### 2.3 Billing and revenue capture

| Capability | Scope |
|---|---|
| Service catalog | Simple consult/procedure/lab referral items. |
| Draft bill | Auto-created from encounter/service orders. |
| Payment modes | Cash + manual UPI reference first; gateway integration can follow. |
| GST invoice | Basic invoice numbering/tax support if required by pilot site. |
| Revenue leakage queue | Ordered-not-billed v0. |
| Claims assist | Defer beyond pilot. |
| Discounts approval | Defer or implement manual manager PIN/log only. |

### 2.4 Trust foundation

| Capability | Scope |
|---|---|
| Auth | OIDC, unique users, MFA for admins. |
| Roles | Front desk, doctor, billing, admin, Arogya support. |
| Tenant isolation | Dedicated tenant deployment for pilots; tenant_id everywhere. |
| Audit | Every PHI read/write/search/share/sign/export. |
| Encryption | DB/object/KMS. |
| PHI-safe logs | Required. |
| Backups | PITR and restore drill. |
| Support access | Time-bound, customer-approved, audited. |

---

## 3. Private Beta MVP — add after pilot loop works

| Capability | Scope |
|---|---|
| ABHA full lifecycle | Create/verify/link against sandbox/production path. |
| ABDM M1/M2 readiness | Bundle generation, consent-aware sharing, evidence collection. |
| e-Rx safety v1 | Severe drug-drug/allergy blocking with override reason. |
| WhatsApp delivery | Token, prescription link, bill link; short-lived URLs; consent/preferences. |
| Payment gateway | UPI/card integration and settlement reconciliation. |
| Migration dry-run | Patient/tariff CSV import with validation report. |
| Edge offline | Registration/billing only for one pilot site. |
| Audit reports | Patient access report, user access report, break-glass report. |
| Billing leakage digest | Daily owner email/dashboard v0. |

---

## 4. GA MVP — required for broader paid launch

| Capability | Scope |
|---|---|
| AND/WASA path | External certification/audit complete or remediation accepted. |
| ABDM production flows | M1/M2/M3 as applicable for GA promise. |
| Migration tooling | 50k record migration dry-run and fidelity sampling. |
| e-Rx safety | Tested severe alert + override workflow in production. |
| Claims assist v1 | Claim package assembly and payer checklist pre-scrub; live NHCX only for supported payers as v1.1. |
| GST/billing hardening | Invoice immutability, void/credit note/refund flow, day-close reconciliation. |
| On-call/support | Incident process, SLOs, backup/restore process. |
| Performance | P95 page load target and scribe latency measured. |

---

## 5. Deferred / architect only

| Capability | Defer until | Rationale |
|---|---|---|
| Full IPD suite | Phase 3 | Too much workflow surface. Keep generic Encounter model only. |
| Pharmacy/inventory replacement | Phase 2/3 | Integrate first; replacement later. |
| LIS/RIS/PACS replacement | Phase 2/3 | Integrate with reports/documents first. |
| NHCX live for all payers | v1.1+ | External payer readiness controls timing. |
| Owner NL-Q&A analytics | P1 | Dashboard/digest first. |
| Patient app | P2 | WhatsApp channel first. |
| Customer-managed deployment | v1.1+ enterprise | High support burden; do not fragment MVP. |
| Marketplace/API | P2 | Keep FHIR API internal/ABDM/export-focused first. |
| Global compliance packs | P2 | Keep config-pack seams and synthetic geography test only. |
| Full on-prem EMR | Avoid | Edge queue only; full on-prem slows AI/cloud iteration. |

---

## 6. Non-negotiables that stay in Pilot MVP

These are not “compliance nice-to-haves.” They are required to safely run the product:

1. Tenant isolation.
2. Unique users and role policies.
3. Audit for PHI access and clinical writes.
4. Consent before audio recording.
5. Encryption and KMS.
6. PHI-safe logs and traces.
7. Backups and restore test.
8. AI preliminary/final sign-off boundary.
9. Vendor data-processing approval.
10. Support-access audit.

---

## 7. Sprint-planning rule

Every new P0 request must answer:

1. Which MVP loop does it validate: front desk, doctor, billing, or trust?
2. Can it be measured in a design-partner pilot within two weeks?
3. What existing P0 item is being removed or delayed?
4. Does it increase PHI/security risk?
5. Can it be shipped behind a tenant feature flag?

If the answer is unclear, it is not Pilot MVP.
