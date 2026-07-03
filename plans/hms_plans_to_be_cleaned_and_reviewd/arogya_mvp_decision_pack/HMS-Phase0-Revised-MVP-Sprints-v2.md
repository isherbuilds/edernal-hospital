# HMS Phase 0 Revised MVP Sprint Plan v2

**Product:** Arogya OS  
**Date:** 2026-07-02  
**Status:** Proposed replacement for current Phase-0 sprint plan  
**Goal:** Get the product into design-partner hands quickly without handling real PHI/audio before minimum controls exist.

---

## 1. Revision principles

1. **Product feedback remains the goal.** The plan still prioritizes registration, queue, scribe, and billing feedback.
2. **Minimum controls move earlier.** Audit, consent, tenant isolation, KMS, PHI-safe logs, and backup are not stretch items.
3. **Certification is not the first milestone.** ABDM/WASA evidence starts early, but final certification is not blocking synthetic demos or controlled pilots.
4. **Real patient data has a gate.** Synthetic data until Pre-PHI Gate passes.
5. **AI is allowed early only as draft.** No preliminary AI resource can print, share, push to ABDM, or submit a claim.
6. **Scope is explicitly cut.** Full claims, full NHCX, full analytics, customer-managed deployment, and broad language support are not Phase 0.

---

## 2. Phase 0 outcomes

By the end of Phase 0, the team should have:

- 3–5 signed design partners.
- One or more dedicated-tenant pilot deployments.
- Patient registration and queue working with real front-desk users.
- Consent-gated audio/dictation/template workflow tested with doctors.
- Scribe bake-off scored on real consented consults if Pre-PHI and Real Audio gates pass.
- Doctor draft-review/sign workflow validated.
- Basic billing auto-capture from signed orders/services.
- Minimum audit, consent, encryption, backup, and role controls live.
- Clear decision on ambient-first vs dictation-first v1.

---

## 3. Sprint 0 — Pre-PHI operating gate

**Duration:** 1 week, can overlap with hiring/procurement/design partner work.  
**Goal:** Make it legal and technically safe to begin controlled data collection.

| Story | Owner | Priority | Exit criteria |
|---|---|---|---|
| Design-partner pilot addendum/DPA template | Founders + counsel | P0 | Approved template covers PHI, audio, retention, support access, incident contact. |
| Audio consent text v0 | Founders + counsel + clinical advisor | P0 | Consent text ready in English/Hindi/local pilot language. |
| Vendor processing checklist | Platform + counsel | P0 | STT/LLM/WhatsApp/SMS/payment vendor approval checklist exists. |
| Deployment profile decision | Founders + Platform | P0 | ADR-8 accepted or revised. |
| PHI data-classification map | Platform + Product | P0 | PHI/PII/financial/log/analytics data classes identified. |
| Synthetic demo data pack | Core | P0 | Registration/queue/consult/billing synthetic data available. |
| Incident runbook v0 | Platform | P0 | Named owner, severity levels, notification path, evidence preservation. |

**Gate:** no real PHI/audio until Sprint 0 artifacts are accepted.

---

## 4. Sprint 1 — PHI-safe walking skeleton

**Goal:** Register a synthetic patient -> persist FHIR Patient/Encounter -> audit event -> queue board -> basic bill shell, all inside tenant boundary.

| Story | Pod | Priority | Acceptance criteria |
|---|---|---|---|
| Repo/CI/CD/environments/IaC | Platform | P0 | Dev/staging/pilot separated; secret scan and dependency scan active. |
| Tenant/deployment skeleton | Platform | P0 | Dedicated-tenant profile provisions DB/schema, object boundary, KMS key. |
| FHIR persistence v0 | Platform | P0 | Patient + Encounter resources validated; resource versions append-only. |
| Authn + tenant resolution | Platform | P0 | OIDC login; tenant context mandatory on protected requests. |
| RBAC/ABAC policy v0 | Platform | P0 | Front desk/doctor/billing/admin roles with automated deny tests. |
| Audit stub | Platform | P0 | Every protected read/write creates audit event. |
| PHI-safe logging SDK | Platform | P0 | Unit tests prove patient identifiers/transcripts are blocked/redacted. |
| Backup/PITR baseline | Platform | P0 | PITR configured; one synthetic restore dry-run. |
| Quick-register UI/API | Core | P0 | Name/phone registration <60s using synthetic data. |
| Token queue/live board | Core | P0 | Token issued and visible within 3s in synthetic workflow. |
| Basic billing shell | Core | P1 | Encounter can open draft bill with visit/consult line. |
| Audio capture shell, disabled without consent | Clinical AI | P0 | Recording endpoint rejects without consent ID; object storage encrypted. |

**Exit:** Pre-PHI Gate can be considered if Sprint 0 legal artifacts also pass.

---

## 5. Sprint 2 — Controlled corpus and real front-desk loop

**Goal:** Start controlled design-partner workflow with minimal real data only after gate; integrate STT candidates behind abstraction.

| Story | Pod | Priority | Acceptance criteria |
|---|---|---|---|
| Dedicated tenant deployment for partner #1 | Platform | P0 | Partner environment deployed with tenant key, backup, audit, logging controls. |
| Consent capture workflow | Core + Clinical AI | P0 | Consent recorded per encounter; no consent means no recording. |
| Audio object lifecycle | Clinical AI + Platform | P0 | Encrypted storage, retention config, deletion queue, deletion audit. |
| STT interface + vendor A/B integration | Clinical AI | P0 | Same transcript schema for both vendors; no PHI sent until vendor approved. |
| Self-host STT baseline or deferred decision | Clinical AI | P1 | Baseline measured or explicitly deferred if GPU/data not ready. |
| LLM structuring v0 | Clinical AI | P0 | Transcript -> constrained SOAP/Rx/orders JSON using synthetic + approved real samples. |
| ABHA M1 sandbox spike | Core | P1 | Create/verify/link flow demonstrated in sandbox. |
| Duplicate detection v0 | Core | P1 | Phone/name/DOB candidate detection and merge queue prototype. |
| Outbox v0 | Platform | P0 | Transactional outbox table and local consumer; managed bus can remain later. |
| Audit report v0 | Platform | P0 | Query by patient, actor, tenant, action, date. |

**Exit:** Real Audio Gate passed for partner #1; STT bake-off data collection begins.

---

## 6. Sprint 3 — MVP doctor and billing loop

**Goal:** Doctor can review/edit/sign AI/template draft; signed orders create bill lines; early product metrics captured.

| Story | Pod | Priority | Acceptance criteria |
|---|---|---|---|
| Draft-review/sign UI | Clinical AI + Core | P0 | Doctor sees draft, confidence markers, source snippets, field edits, final sign action. |
| AI preliminary/final state machine | Platform + Core | P0 | Preliminary resources blocked from print/share/ABDM/claims. |
| Provenance v0 | Clinical AI + Platform | P0 | Model/vendor/version/source span/confidence/signer captured. |
| Billing auto-capture v0 | Core | P0 | Signed ServiceRequest creates draft bill line; no silent drop in test. |
| WhatsApp notification v0 | Core | P1 | Token notification only; no PHI in message body. |
| Scribe bake-off scoring | Clinical AI | P0 | Entity-WER, latency, cost, doctor edit count, acceptance rate tracked. |
| Product telemetry | Platform | P0 | Registration time, queue wait, draft latency, sign-off time, bill capture events. |
| Terminology/drug dictionary seed | Platform + Core | P1 | Minimal drug dictionary pack loaded for prescribed meds in pilot specialties. |

**Exit:** End-to-end partner demo: register -> queue -> consult -> draft -> sign -> bill line -> audit trail.

---

## 7. Sprint 4 — Pilot readiness and safety hardening

**Goal:** Move from demo to controlled operational pilot.

| Story | Pod | Priority | Acceptance criteria |
|---|---|---|---|
| Restore drill | Platform | P0 | Partner tenant restored to isolated environment with checksum report. |
| Incident tabletop | Platform + Founders | P0 | Tabletop run; runbook updated. |
| Support access workflow | Platform | P0 | Customer-approved time-bound support session with audit. |
| e-Rx safety service design | Core + Clinical advisor | P0 | Drug/allergy interaction source selected; severe alert state model defined. |
| e-Rx severe-alert prototype | Core | P1 | Severe interaction blocks signing in synthetic test with override reason. |
| Migration dry-run harness | Core | P1 | Patient/tariff CSV import with validation report and rollback plan. |
| Edge/offline design spike | Platform + Core | P1 | Device identity, local encryption, queue/idempotency design approved. |
| ABDM certification plan | Platform + Compliance | P1 | M1/M2/M3 checklist, sandbox status, WASA vendor shortlist, timeline. |
| Pilot operations playbook | Product + GTM | P0 | Training, feedback, escalation, rollback, success metrics. |

**Exit:** Pilot Go-Live Gate review.

---

## 8. Phase 0 gates

### 8.1 Pre-PHI Gate

Required before real patient data or real audio:

- Signed pilot addendum/DPA.
- Consent language approved.
- Auth/tenant/audit/encryption/logging/backup controls pass.
- Vendor terms approved for any PHI processor.
- Incident runbook exists.

### 8.2 Real Audio Gate

Required before real consult audio:

- Per-encounter consent capture live.
- Audio encrypted with tenant key.
- Retention/deletion job live.
- Audit of audio create/read/delete live.
- Vendor no-training/retention/region terms approved.

### 8.3 Pilot Go-Live Gate

Required before operational pilot:

- End-to-end register/queue/draft/sign/bill loop passes.
- Backup restore drill passes.
- Support access workflow works.
- Rollback plan exists.
- Training materials ready.
- Success metrics instrumented.

---

## 9. Scope explicitly deferred from Phase 0

- Full NHCX live claims submission.
- Full claims automation.
- Owner analytics app/NL Q&A.
- Full patient WhatsApp assistant.
- Customer-managed deployment.
- Full on-prem/offline EMR.
- Full regional-language expansion beyond measurement/architecture.
- Full document OCR-to-structured lab trending.
- Marketplace/API platform.
- IPD workflows.
- Full global compliance packs.

---

## 10. Phase 0 decision outcomes

At the end of Phase 0, choose one:

| Outcome | Criteria | Action |
|---|---|---|
| Ambient-first continues | ≥70% drafts signed with ≤2 major edits; latency/cost acceptable; doctors prefer it. | Proceed to Phase 1 ambient scribe v1. |
| Dictation-first pivot | Ambient unreliable but structured dictation/templates work. | Ship dictation/template-first v1; keep ambient as P1. |
| Workflow-first pivot | Scribe weak but registration/queue/billing value strong. | Ship OPD + billing wedge; keep AI as controlled beta. |
| Stop/rethink | Doctors reject workflow or trust controls block operations. | Re-scope before burning Phase 1. |
