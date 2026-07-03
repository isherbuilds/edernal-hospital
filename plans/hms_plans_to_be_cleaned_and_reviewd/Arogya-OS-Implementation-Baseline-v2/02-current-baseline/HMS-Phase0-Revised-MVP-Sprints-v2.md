# HMS Phase-0 Revised MVP Sprints v2

**Date:** July 3, 2026  
**Status:** Supersedes the Phase-0 sprint section of `HMS-Roadmap-and-Phase0-Sprints.md`  
**Goal:** Reach private-beta readiness without slowing MVP discovery or creating a PHI/security retrofit cliff.

---

## 1. Phase-0 principles

1. Build the doctor/front-desk/billing loops early.
2. Do not collect real PHI/audio before the trust boundary exists.
3. Treat audit, consent, authz, and backup as product-enabling infrastructure, not compliance paperwork.
4. Use design-partner hospitals for real workflow feedback, but gate real data capture.
5. Keep certification work parallel; do not make certification the first milestone.

## 2. Revised phase gates

| Gate | Exit criteria |
|---|---|
| Gate 0 — Build readiness | Legal pilot templates, vendor checklist, environment policy, repo/CI plan, product cutline accepted. |
| Gate 1 — Synthetic walking skeleton | Register synthetic patient → FHIR persisted → queue visible → audit event written → outbox event emitted. |
| Gate 2 — Real demographics allowed | Tenant isolation, auth, RBAC/ABAC v0, audit, backup, PHI-safe logs pass. |
| Gate 3 — Real clinical data/audio allowed | Consent state machine, encrypted audio/document storage, retention/deletion, AI preliminary/final state machine, vendor terms pass. |
| Gate 4 — Design-partner private beta | Core OPD loop, doctor draft review/sign, order-to-bill, backup restore, support access controls, incident runbook pass. |

## 3. Sprint 0 — Founder/architecture preflight

**Duration:** 1 week or less  
**Goal:** Remove non-engineering blockers before sprint work depends on them.

| Story | Owner | Priority |
|---|---|---|
| Accept/reject ADR-8 deployment model | Founders + architecture | P0 |
| Accept MVP backlog cutline | Founders + product + engineering | P0 |
| Approve pilot consent language draft | Founders + counsel + clinical advisor | P0 |
| Select design-partner data-sharing/DPA template | Founders + counsel | P0 |
| Create vendor security checklist for STT/LLM/WhatsApp/payment | Compliance + engineering | P0 |
| Decide no-production-PHI-in-dev rule | Engineering leadership | P0 |
| Choose initial cloud region/account structure | Platform | P0 |
| Create risk register and assign owner | Compliance + founders | P0 |

## 4. Sprint 1 — PHI-safe walking skeleton

**Duration:** 2 weeks  
**Goal:** Register a synthetic patient, persist valid FHIR, emit event, show queue, write audit, prove tenant boundary.

| # | Story | Pod | Priority |
|---|---|---|---|
| 1 | Repo, CI/CD, branch protection, environments, IaC baseline | Platform | P0 |
| 2 | Secret scan, SAST/SCA, container/IaC scan in CI | Platform | P0 |
| 3 | FHIR persistence for `Patient`, `Encounter`, `Appointment`; HAPI/FHIR validator in CI | Platform/Core | P0 |
| 4 | Tenant resolution and RLS/dedicated-boundary test harness | Platform | P0 |
| 5 | OIDC auth and base roles | Platform | P0 |
| 6 | Authorization middleware with policy-decision audit | Platform | P0 |
| 7 | Audit writer for PHI create/read/search/update, append-only schema v0 | Platform | P0 |
| 8 | Transactional outbox table and local projector | Platform | P0 |
| 9 | Quick-register API/UI using name + phone path | Core | P0 |
| 10 | Token queue service and live queue board | Core | P0 |
| 11 | Encrypted object-storage bucket/prefix module for future audio/documents | Platform | P0 |
| 12 | PITR/nightly backup configured and restore drill script started | Platform | P0 |
| 13 | Scribe capture UI using synthetic/demo audio only | Clinical AI | P1 |

**Exit:** Gate 1 passed. No real patient data yet.

## 5. Sprint 2 — Consent, ABHA, integration reliability, and safe pilot data

**Duration:** 2 weeks  
**Goal:** Allow controlled real demographics and prepare real clinical/audio capture.

| # | Story | Pod | Priority |
|---|---|---|---|
| 1 | ABHA M1 sandbox create/verify/link spike | Core | P0 |
| 2 | Duplicate detection + merge queue v0 | Core | P0 |
| 3 | Appointment slots + walk-in coexistence + no-double-booking tests | Core | P0 |
| 4 | Consent state machine: audio, WhatsApp, ABDM share | Platform/Core | P0 |
| 5 | Audit dashboard v0 for PHI access, denied access, support access | Platform | P0 |
| 6 | Object storage encryption, TTL deletion job, deletion audit proof | Platform | P0 |
| 7 | Integration retry/DLQ framework with mock WhatsApp/payment/ABDM | Platform | P0 |
| 8 | STT vendor A/B thin interface using synthetic/de-identified audio | Clinical AI | P0 |
| 9 | LLM structuring v0: transcript → SOAP/Rx/order JSON schema | Clinical AI | P0 |
| 10 | Migration dry-run harness for patients/tariffs/doctors CSV | Core | P1 |
| 11 | Medication safety data-source decision and `DetectedIssue` model | Core | P0 |

**Exit:** Gate 2 passed. Real demographics may be used in controlled pilot environment. Real audio still gated.

## 6. Sprint 3 — Real-audio controlled bake-off and doctor review loop

**Duration:** 2 weeks  
**Goal:** Start controlled real-audio bake-off only if consent/vendor/audio gates pass.

| # | Story | Pod | Priority |
|---|---|---|---|
| 1 | Doctor draft-review/sign UI with preliminary/final state machine | Clinical AI + Core | P0 |
| 2 | AI provenance metadata: model version, prompt version, confidence, source span | Clinical AI + Platform | P0 |
| 3 | Real-audio capture pilot with consent, encryption, retention, deletion proof | Clinical AI | P0 |
| 4 | STT bake-off scoring: entity WER, latency, cost, doctor edits | Clinical AI | P0 |
| 5 | Critical-field mandatory review for drugs/dose/allergy/orders | Clinical AI + Core | P0 |
| 6 | e-Rx severe-alert blocking test harness using `DetectedIssue` | Core | P0 |
| 7 | Order-to-bill projection and leakage queue v0 | Revenue/Core | P0 |
| 8 | WhatsApp token/Rx delivery using short-lived document links | Core/Integration | P1 |
| 9 | Restore drill completed for pilot tenant | Platform | P0 |
| 10 | Incident runbook and support-access workflow test | Platform/Compliance | P0 |

**Exit:** Gate 3 passed. Controlled clinical/audio pilot allowed.

## 7. Sprint 4 — Private-beta hardening and ADR-3 decision

**Duration:** 2 weeks  
**Goal:** Decide scribe pipeline and demonstrate the full OPD wedge at one design partner.

| # | Story | Pod | Priority |
|---|---|---|---|
| 1 | Run bake-off across target doctor/language/noise mix | Clinical AI | P0 |
| 2 | ADR-3 decision memo: vendor/self-host/dictation-first | Clinical AI lead | P0 |
| 3 | Full OPD flow: register → queue → consult → sign → orders → bill | All | P0 |
| 4 | Billing draft, GST ledger v0, payment capture, day-close report | Revenue/Core | P0 |
| 5 | Discount approval workflow v0 | Revenue | P0 |
| 6 | Claim package assembly v0, portal-assist only | Revenue | P1 |
| 7 | ABDM M1 flow evidence pack v0 | Integration/Compliance | P0 |
| 8 | WASA prep evidence pack v0 | Platform/Compliance | P1 |
| 9 | Onboarding playbook v0 and training checklist | Product/GTM | P0 |
| 10 | Phase-1 plan recalibration based on pilot telemetry | Founders + leads | P0 |

**Exit:** Private beta can expand to additional design partners if:

```text
[ ] No critical authz/audit/tenant-isolation failures.
[ ] Scribe path chosen or dictation-first fallback accepted.
[ ] Doctor sign-off workflow accepted by at least 3 doctors.
[ ] Registration median ≤60s in pilot simulation or real workflow.
[ ] Order-to-bill zero-silent-drop test passes.
[ ] Backup restore and incident workflow verified.
```

## 8. Changes from original Phase-0 plan

| Original issue | v2 change |
|---|---|
| Real audio too early | Real audio gated until consent, encryption, retention, vendor terms, and audit exist. |
| Audit started in Sprint 2 | Audit starts in Sprint 1 before any PHI path. |
| Outbox was stretch | Transactional outbox is Sprint 1 P0. |
| e-Rx safety was P1 spike | Medication safety architecture is Sprint 2/3 P0. |
| Migration P0 missing from Phase 0 | Migration dry-run harness added. |
| Edge security underspecified | Edge remains later, but browser-local PHI persistence is banned now. |
| Certification prep too vague | Evidence packs added for ABDM/WASA without blocking product learning. |
