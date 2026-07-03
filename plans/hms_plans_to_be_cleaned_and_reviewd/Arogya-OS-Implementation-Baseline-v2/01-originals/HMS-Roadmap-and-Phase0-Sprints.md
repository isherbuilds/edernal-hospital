# Roadmap + Phase-0 Sprint Plan — Arogya OS

**Date:** July 2, 2026 · Aligned to HMS-PRD-v1 phases and HMS-System-Design.

---

## Part 1 — Roadmap (Now / Next / Later)

### Now (M1–M3 · Phase 0: Foundations)

| Initiative | Owner pod | Why now |
|---|---|---|
| FHIR store + projections + event outbox (ADR-1, 6) | Platform | Everything sits on it; schema review must validate generic Encounter for future IPD |
| Registration/MPI + ABHA M1 sandbox | Core EMR | ABDM cert path is longest lead item; front-desk flow is demo-critical |
| Scheduling + queue board + WhatsApp notifications | Core EMR | Visible value on day 1 of pilot; low risk |
| Scribe bake-off on real consult audio (ADR-3) | Clinical AI | THE product risk; kill criterion decided here |
| Consent + audit + RBAC skeleton (ADR-7) | Platform | Cannot be retrofitted; WASA depends on it |
| Sign 3–5 design partners; collect consented audio corpus | Founders/GTM | Bake-off and Phase-1 both blocked without them |
| Legal: AI-note medico-legal review + consent language | Founders + counsel | PRD blocking question #1 |

### Next (M4–M7 · Phase 1: Private beta)

- Ambient scribe v1 (winning pipeline) end-to-end: consent → draft → sign → bill capture
- e-Rx + interaction/allergy checks; billing + GST + payments; claims assembly + pre-scrub
- ABDM M2 (record linking via HIE-CM); WASA audit underway
- Edge offline gateway for registration/billing (ADR-4)
- Migration importers (patients, tariffs); onboarding playbook v1
- Beta at 5 design-partner hospitals; G1 metric (≥50% doc-time cut) at ≥3 sites

### Later (M8–M12 · Phase 2: GA / then M13–M18 · Phase 3: Expand)

- **GA:** AND certification, hardening, 2-city launch (candidate: NCR + Hyderabad), pricing locked after first 10 sales
- **v1.1 fast follows (P1):** NHCX live for top payers, owner analytics app + NL Q&A, patient WhatsApp assistant, Tamil/Telugu scribe
- **Phase 3:** IPD suite (ADT, nursing, OT) at 3 beta sites; pharmacy/LIS integrations; first non-India pilot via synthetic-pack-validated config pack (ADR-5); dedicated-cluster tier if a chain lands (ADR-2 trigger)

**Roadmap rules:** anything entering "Now" evicts something; IPD pull from design partners does not jump the queue (PRD scope discipline); "Later" items get architectural insurance only (generic Encounter, config packs), no code.

---

## Part 2 — Phase-0 Sprint Plan (Sprints 1–3, 2-week sprints)

**Capacity assumption:** 12 engineers — Clinical AI (4), Core EMR/Billing (4), Platform (4). ~8 productive eng-days per person per sprint (meetings, interviews, setup). Adjust ceremonially if actual team differs.

### Sprint 1 (Weeks 1–2) — "Skeleton + corpus"

**Sprint goal:** a walking skeleton (register a patient → FHIR resource persisted → event emitted → visible in a queue) and the audio-corpus machine running.

| # | Story | Pod | Est. | Priority |
|---|---|---|---|---|
| 1 | Repo/CI/CD, environments, IaC baseline | Platform | 5d | P0 |
| 2 | FHIR resource persistence (Patient, Encounter) + HAPI validator in CI | Platform | 8d | P0 |
| 3 | OIDC auth + tenant resolution + RBAC roles v0 | Platform | 6d | P0 |
| 4 | Quick-register API + web UI (name/phone path only) | Core | 8d | P0 |
| 5 | Token queue service + live board (WebSocket) v0 | Core | 6d | P0 |
| 6 | Consent-gated audio capture app (tablet PWA) → storage | Clinical AI | 8d | P0 |
| 7 | De-identification pipeline for corpus audio | Clinical AI | 6d | P0 |
| 8 | Bake-off harness: scoring scripts (entity-WER, latency, cost) | Clinical AI | 4d | P1 |
| 9 | ABDM sandbox account + ABHA create/verify spike | Core | 4d | P1 |

Stretch: transactional outbox + bus provisioning (pulls from Sprint 2).  
**Risks:** design-partner audio consent paperwork lags → mitigate: legal template ready week 1; corpus collection starts at partner #1 even if #3–5 unsigned.

### Sprint 2 (Weeks 3–4) — "Bake-off live + ABHA real"

**Sprint goal:** all three STT candidates producing scored drafts on real audio; ABHA M1 flows work in sandbox end-to-end.

| # | Story | Pod | Est. | Priority |
|---|---|---|---|---|
| 1 | Integrate STT vendor A + B behind thin interface | Clinical AI | 8d | P0 |
| 2 | Whisper-family fine-tune baseline (self-host candidate) | Clinical AI | 8d | P0 |
| 3 | LLM structuring v0: transcript → SOAP JSON (our schema) | Clinical AI | 8d | P0 |
| 4 | ABHA full lifecycle (create/verify/link) vs sandbox | Core | 8d | P0 |
| 5 | Duplicate detection (fuzzy match) + merge queue v0 | Core | 6d | P0 |
| 6 | Appointment slots + walk-in coexistence rules | Core | 5d | P1 |
| 7 | Event outbox → bus, first consumer (audit log) | Platform | 8d | P0 |
| 8 | Audit-log service (every clinical read/write) | Platform | 6d | P0 |
| 9 | Config-pack service skeleton + synthetic geography pack in CI | Platform | 5d | P1 |

**Risks:** vendor API access/paperwork in India (data-residency terms) → start procurement week 1; fine-tune GPU quota → reserve early.

### Sprint 3 (Weeks 5–6) — "Decision sprint"

**Sprint goal:** bake-off scored and ADR-3 decided (or kill criterion invoked); doctor-facing draft-review UI exists so acceptance rate is measured with real doctors, not proxies.

| # | Story | Pod | Est. | Priority |
|---|---|---|---|---|
| 1 | Draft-review/sign UI on tablet (edit, confidence highlights) | Clinical AI + Core | 10d | P0 |
| 2 | Run scored bake-off with ≥5 doctors, ≥50 audio hours | Clinical AI | 8d | P0 |
| 3 | ADR-3 decision memo + cost model (₹/consult) | Clinical AI lead | 2d | P0 |
| 4 | Terminology service v0 (ICD-10 + drug dictionary pack) | Platform | 6d | P0 |
| 5 | Encounter schema review vs IPD/ER scenarios (PRD P2 insurance) | All leads | 2d | P0 |
| 6 | e-Rx data model + formulary resolution spike | Core | 5d | P1 |
| 7 | WhatsApp BSP integration (token + Rx delivery) v0 | Core | 5d | P1 |
| 8 | WASA prep checklist + CERT-IN vendor selection | Platform | 3d | P1 |

**Exit = Phase-0 gate review:** scribe accuracy bar met (≥70% drafts signed with ≤2 field edits) → proceed to Phase 1 build; else invoke ADR-3 kill criterion and re-plan v1 as dictation-first.

**Ceremonies:** weekly design-partner clinic visit (whole team rotates — everyone watches a live OPD); sprint demo happens *at* a partner hospital from Sprint 3 onward.
