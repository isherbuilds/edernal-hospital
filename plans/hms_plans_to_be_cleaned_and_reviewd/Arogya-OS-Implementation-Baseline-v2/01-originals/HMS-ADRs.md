# Architecture Decision Records — Arogya OS

Format: Context → Decision → Consequences. Status key: **Accepted** / **Proposed** (needs Phase-0 validation).

---

## ADR-1: FHIR R4-native store on Postgres JSONB — **Accepted**

**Context.** ABDM requires FHIR R4 bundles; global expansion (PRD G5) requires interoperability; and the PRD promises "compliance as configuration." Options: (a) relational schema + FHIR export layer, (b) managed FHIR service (Google Healthcare API / Azure FHIR), (c) HAPI FHIR server, (d) Postgres JSONB resources + relational projections.

**Decision.** (d) — canonical FHIR R4 resources in Postgres JSONB, append-only versions, relational projections for hot paths, FHIR profile validation in CI.

**Consequences.** ✚ One source of truth; export is trivially honest; ABDM/US-Core packs are profile swaps; full control over residency and cost; billing tables can sit beside clinical resources in one transaction boundary. ▬ We own FHIR validation and search tooling (mitigate: use HAPI validator as library); JSONB queries are awkward (mitigate: projections); team must learn FHIR deeply (accepted — it's the product's spine). Fallback if projections proliferate badly: embed HAPI JPA server for the FHIR store proper, keep our services around it.

## ADR-2: Shared-schema multi-tenancy with RLS + per-tenant keys — **Accepted**

**Context.** 25 tenants year 1, target 200+; hospitals are compliance-sensitive; ops team is small.

**Decision.** Single Postgres cluster; `tenant_id` on every row enforced by Postgres row-level security; application-layer tenant resolution at the gateway; per-tenant data-encryption keys (envelope encryption); per-tenant logical export for offboarding.

**Consequences.** ✚ One migration path, cheap tenants, feasible ops at team size. ▬ Blast radius of a bad query is fleet-wide (mitigate: RLS as hard backstop + staging soak); noisy-neighbor risk minimal at our write volume. **Revisit trigger:** first 500-bed chain or first customer contractually demanding physical isolation → offer dedicated-cluster tier.

## ADR-3: Scribe STT/LLM pipeline — vendor bake-off before commitment — **Proposed (Phase-0 gate)**

**Context.** Hinglish + regional-language clinical speech accuracy is the single biggest product risk (PRD blocking question #2). Ambient-scribe market is mature in English (Abridge, Suki et al.) but Indian code-switched clinical audio is not a solved commodity.

**Decision.** Run a 4-week bake-off on ≥50 hours of real (consented, de-identified) OPD audio from design partners: two commercial STT/medical-scribe APIs vs. one self-hosted fine-tuned Whisper-family model. Score: clinical-entity WER (drugs, doses, findings), draft-note acceptance rate by doctors, latency, ₹/consult. LLM structuring layer is ours regardless (prompted/fine-tuned on our schema) — only STT is up for buy-vs-build.

**Consequences.** ✚ Kill criterion honored before GA date is promised; cost known before pricing locked. ▬ 4 weeks of Phase 0 spent on evaluation; dual-integration abstraction needed (accepted: thin STT interface). **Kill criterion:** if no option reaches doctor-acceptable draft quality (≥70% notes signed with ≤2 field edits) by end of Phase 0 + 4 weeks, v1 pivots to dictation-first + structured templates and ambient moves to P1.

## ADR-4: Offline scope limited to registration + billing via edge sync — **Accepted**

**Context.** Hospital WAN outages are routine in tier-2/3 India; PRD R9 requires registration/billing to survive them. Full offline-first EMR (CRDTs, chart merges) is enormously complex and conflicts with a cloud AI pipeline.

**Decision.** Per-hospital edge gateway (containerized, runs on a mini-PC or the reception desktop) handling registration + billing queues with local ULIDs and reserved bill-number series; sync-and-merge on reconnect; clinical chart gets read-only cache; scribe/ABDM are online-only.

**Consequences.** ✚ The workflows that stop a hospital cold keep working; bounded conflict surface (two well-understood flows). ▬ One piece of on-prem software to ship/update (mitigate: auto-updating single container, no local state beyond queue); scribe unavailability during outage must be socialized in sales ("degraded, not down"). **Revisit:** if outage telemetry shows >2% of consult hours offline, invest in on-edge dictation capture with deferred processing.

## ADR-5: Localization via config packs, zero geo-logic in core — **Accepted**

**Context.** PRD dual-track mandate: India wedge, global architecture. The historical failure mode of India-first health IT going global (and vice versa) is hardcoded assumptions (identifiers, tax, consent, terminology).

**Decision.** A config-pack service owns: identifier schemes (ABHA vs MRN vs SSN-adjacent), terminology bundles, tariff/payer catalogs, tax rules (GST module is a pack plugin), consent-flow definitions, document templates, language packs. Core services consume packs via a stable interface; CI includes a "second geography" synthetic pack (fake country) that must always pass — the architectural regression test.

**Consequences.** ✚ Geography = pack + deployment region, per PRD G5; forces clean seams early. ▬ Pack interface design cost up front; risk of over-abstraction (mitigate: build only what India + the synthetic pack need; resist speculative generality). GST ledger stays a first-class Indian pack module rather than pretending FHIR `Invoice` covers it.

## ADR-6: Event bus (managed Kafka-compatible) as integration spine — **Accepted**

**Context.** Revenue-integrity agents, ABDM push, WhatsApp notifications, and future modules (IPD, pharmacy) all react to clinical/billing events. Point-to-point calls would couple pods and make P2 marketplace impossible.

**Decision.** Transactional outbox on the FHIR store → managed Kafka-compatible bus (e.g., MSK/Confluent/Redpanda — pick by cost) → versioned CloudEvents. Consumers idempotent; schema registry from day one.

**Consequences.** ✚ AI agents and integrations subscribe without touching core; audit/replay for free; IPD slots in later. ▬ Ops surface + eventual consistency in projections (accepted; UI hot paths read projections synchronously). **Revisit:** if ops burden bites at small scale, Postgres-based queue (e.g., pgmq) is the simplification path — the outbox pattern keeps that swap cheap.

## ADR-7: Human sign-off boundary for all AI outputs — **Accepted**

**Context.** PRD non-goal: no autonomous clinical decisions. Medico-legal review (blocking question #1) will demand provenance.

**Decision.** Every AI-generated artefact persists as a distinct preliminary-status resource with provenance metadata (model version, confidence, source transcript span). State transition to final requires an authenticated clinician/billing-exec action. No AI writes ever reach ABDM, a printed Rx, or a submitted claim in preliminary state. Enforced at the store layer (state machine), not just UI.

**Consequences.** ✚ Single enforcement point survives new clients/modules; audit story is clean; regulatory posture defensible. ▬ Adds a state machine to every AI-touching resource (accepted, small). This ADR is non-negotiable; any feature request violating it escalates to founders.
