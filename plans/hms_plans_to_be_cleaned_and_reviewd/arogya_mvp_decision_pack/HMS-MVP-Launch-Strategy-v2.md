# HMS MVP Launch Strategy v2 — Fast Product, Trust Controls from Day Zero

**Product:** Arogya OS  
**Date:** 2026-07-02  
**Status:** Proposed founder/architecture decision  
**Companion documents:** HMS-PRD-v1.md, HMS-System-Design.md, HMS-ADRs.md, HMS-Roadmap-and-Phase0-Sprints.md

---

## 1. Executive decision

We should not try to become “fully compliant” before the first design-partner pilot. That would slow the product too much and delay the feedback loops that matter most: doctor adoption, documentation-time reduction, registration speed, and revenue-capture value.

But we also should not treat compliance/security as something to bolt on later. Arogya OS handles clinical records, prescriptions, claims data, identity data, audio recordings, and AI-generated medical drafts. Once real patient data exists in the system, controls such as audit, consent, tenant isolation, encryption, retention, and role boundaries are no longer optional infrastructure. Retrofitting them later will be more expensive than building them now, and some failures cannot be undone.

The launch strategy is therefore:

> **Ship the MVP fast, but only inside a minimal trust envelope. Defer certification, not controls.**

---

## 2. What “compliance later” can mean safely

The following can be deferred until Private Beta or GA:

| Area | Safe to defer? | Reason |
|---|---:|---|
| Final AND certification | Yes, until GA | Certification is an external milestone; architecture should be ready but final submission can follow product validation. |
| Full WASA closure | Yes, until GA/private beta gate | Run readiness early, but final closure can happen after the MVP stabilizes. |
| Full NHCX live submission | Yes | PRD already treats NHCX live claims as v1.1/P1 because payer readiness is external. |
| Global HIPAA/ONC/GDPR packs | Yes | v1 is India wedge. Keep FHIR/config-pack seams but do not build US/EU certification now. |
| Full enterprise on-prem/customer-cloud deployment | Yes | This slows iteration and support. Build IaC portability, but do not offer it as the default pilot model. |
| Advanced security operations center | Yes | Start with logging, audit, alerts, incident runbook; mature into SOC later. |

The following cannot be deferred once real patient data or real audio is collected:

| Area | Cannot defer because |
|---|---|
| Authentication and strong role boundaries | A front-desk user, doctor, billing user, admin, support user, and patient cannot share broad access. |
| Tenant isolation | A cross-hospital data leak would be existential. |
| Clinical audit trail | Healthcare records without read/write audit are unsafe and hard to defend. |
| Consent for audio and ABDM sharing | The PRD already requires per-encounter recording consent and ABDM consent enforcement. |
| Encryption and key management | Audio, prescriptions, patient identity, claims, and documents are high-sensitivity data. |
| PHI-safe logging | Logs become a shadow PHI database if not controlled from the first sprint. |
| Backup and restore | A hospital cannot lose registration, billing, prescriptions, or signed clinical notes. |
| AI human sign-off boundary | The ADR correctly makes this non-negotiable. No AI draft should become a prescription, ABDM push, claim, or billable clinical artifact without authenticated human action. |

---

## 3. MVP cutline

### 3.1 Pilot MVP — what we need to learn first

The first design-partner pilot should prove four product loops:

1. **Front desk loop:** register patient -> issue token -> patient appears in doctor queue.
2. **Doctor loop:** consult -> consented audio/dictation/template -> AI draft -> doctor edits/signs.
3. **Billing loop:** signed orders/services -> draft bill line -> payment captured or marked payable.
4. **Trust loop:** every PHI read/write has tenant, actor, purpose, consent/audit context, and encrypted storage.

This is enough to start changing the workflow and collecting feedback. It is not necessary to ship full claims, full ABDM M2/M3, full e-Rx safety, owner analytics, multi-city rollout, or customer-managed deployment in the first pilot.

### 3.2 Private Beta MVP

Private Beta should add:

- ABHA create/verify/link in sandbox and then production as ready.
- e-Rx safety v1: severe drug-drug/allergy blocking with override reason.
- Revenue integrity v1: ordered-not-billed queue and daily digest.
- WhatsApp delivery for token, prescription link, and bill link using short-lived URLs.
- Migration dry-run for patient and tariff CSVs.
- Edge offline registration/billing prototype for one site that has known WAN instability.
- WASA readiness evidence collection.

### 3.3 GA MVP

GA should require:

- AND certification path complete or scheduled with a credible external timeline.
- WASA audit closure or accepted remediation plan.
- ABDM M1/M2 production path where applicable.
- Restore drill passed.
- Incident runbook tested.
- RLS/authz/audit test suite mandatory in CI.
- Signed DPA/vendor-processing agreements for all processors touching PHI/audio.

---

## 4. Recommended launch model

### Decision

For the first 3–5 design partners, deploy as:

> **Arogya-managed dedicated tenant, India region, Arogya-controlled operations.**

This means:

- Arogya operates the infrastructure.
- Each design partner receives a logically dedicated deployment boundary: at minimum dedicated database or database/schema, dedicated object-storage prefix/bucket, dedicated KMS key, and tenant-specific audit/export boundaries.
- The app codebase and deployment pipeline remain identical across hospitals.
- No customer-managed infrastructure in the first pilots.

### Why not customer-managed first?

Customer-managed deployment sounds safer, but for an MVP it creates the wrong risks:

- Slower iteration and debugging.
- Inconsistent environments across hospitals.
- Harder observability and incident response.
- Hospital IT teams in the target segment often cannot operate cloud-native software deeply.
- Support access still creates privacy/security obligations.
- Upgrades and migrations become political and operationally expensive.

### Why not pure shared SaaS first?

Shared SaaS is the correct long-term unit economics model, but the first pilots involve real clinical data, immature controls, and high implementation learning. A dedicated-tenant pilot reduces blast radius while preserving the SaaS operating model.

---

## 5. Product principles for the first release

1. **No hero demos with unsafe data.** Demo with synthetic data until the minimum trust controls pass.
2. **Doctors must see value before owners see analytics.** Prioritize scribe/sign-off and queue speed over dashboards.
3. **Billing value must be visible, but not perfect.** Ordered-not-billed detection is enough for early ROI proof; full claims automation can follow.
4. **AI is draft-only.** AI outputs must always be preliminary until a clinician or billing executive signs.
5. **Compliance is implemented as product infrastructure, not paperwork.** Audit, consent, access control, and retention must be part of the system behavior.
6. **Avoid on-prem gravity.** Edge is allowed only for offline registration/billing queueing, not as a full EMR deployment.
7. **One deployment pipeline.** Even dedicated tenants should use the same IaC, migrations, release gates, and observability pattern.
8. **No PHI in logs, prompts, traces, analytics events, or dev databases.** This must be an SDK-level constraint, not a developer guideline.

---

## 6. Design-partner operating model

A design-partner hospital should sign a short pilot addendum covering:

- Use of Arogya OS for limited OPD workflows.
- Explicit patient consent language for audio recording.
- Data processing roles and responsibilities.
- Audio retention policy.
- Whether audio can be used for model evaluation/training; default should be evaluation only unless separately agreed.
- Support-access protocol.
- Incident notification channel.
- Data export/offboarding commitment.
- Named hospital pilot owner and Arogya pilot owner.
- Weekly feedback cadence.

Do not collect real consult audio until this is signed.

---

## 7. Founder-level gates

| Gate | Required before | Exit criteria |
|---|---|---|
| Pre-PHI Gate | Any real patient data/audio | Auth, tenant isolation, audit stub, encryption, PHI-safe logs, backup, consent text, DPA/pilot addendum. |
| Real Audio Gate | Real consult audio collection | Per-encounter consent captured, object encryption, retention/deletion job, access audit, vendor processing terms. |
| Pilot Go-Live Gate | Any hospital operational use | Register/queue/sign/bill loop works; rollback plan; support process; restore drill; incident runbook. |
| Private Beta Gate | 5-hospital beta | e-Rx safety v1, ABHA lifecycle, migration dry-run, revenue leakage queue, audit reports. |
| GA Gate | Paid public launch | AND/WASA plan complete, production ABDM path, audited security controls, customer contracts, uptime/on-call process. |

---

## 8. What to change in the current docs

1. Add ADR-8: Deployment model for MVP and pilots.
2. Change Roadmap Phase 0 to include a pre-PHI Sprint 0/gate.
3. Move audit stub, PHI-safe logging, KMS, backup, and outbox from stretch/later into Sprint 1 P0.
4. Split “ABDM compliance” into architecture readiness now and certification later.
5. Split “e-Rx safety” into Phase 0 data model/safety service design and Private Beta severe-alert enforcement.
6. Move claims live submission out of the first MVP; keep only claim package/pre-scrub architecture.
7. Treat customer-managed deployment as an enterprise option, not MVP default.

---

## 9. Final recommendation

Proceed with implementation, but do it as a **trust-bounded MVP**:

- Build the product loops quickly.
- Run pilots in Arogya-managed dedicated tenants.
- Do not wait for full certification before learning from hospitals.
- Do not touch real PHI/audio before minimum controls are in place.
- Keep the architecture portable enough for future dedicated/customer deployments, but do not operationalize them before product-market feedback.
