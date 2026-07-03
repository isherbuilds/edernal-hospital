# ⚠️ This folder is superseded

As of 2026-07-03 the canonical documentation lives in [`docs/`](../../docs/README.md) (+ [`CONTEXT.md`](../../CONTEXT.md) at the repo root). The files here were the input to a grilling/refactor session and are kept as **reference material only**. Where they conflict with `docs/`, `docs/` wins.

## What happened to each document

| Old document | Disposition |
|---|---|
| HMS-Coding-Readiness-Decision-v1 | Replaced by [ROADMAP.md](../../docs/ROADMAP.md) phase gates + standing rules. Its "3-pod team" assumption was wrong (solo founder). |
| HMS-Phase0-Implementation-Gates-v1 (Gates 0–5) | Collapsed into ROADMAP phase exit gates. Gate 2 (audio) → Phase 6; Gate 3 (e-Rx) → Phase 8; Gate 4 (external sharing) → Phase 7. |
| ADR-008 / ADR-8 (two conflicting deployment drafts) | Reconciled by [ADR-0003](../../docs/adr/0003-single-vps-single-postgres-rls.md): single VPS, one Postgres, RLS day one. Dedicated-DB-per-tenant dropped for pilot. |
| ADR-009 (RBAC+ABAC+RLS) | Core survives in [ADR-0004](../../docs/adr/0004-pilot-trust-envelope.md): roles + deny-by-default + RLS are in the Trust Envelope. ABAC/purpose-of-use engine and break-glass moved to the Risk Register. |
| ADR-010 (PHI lifecycle/consent/retention) | Audio-consent machinery deferred with the scribe (Phase 6). Encryption/backup/deletion basics live in the Trust Envelope. |
| ADR-011 (audit/provenance/observability) | Audit-event write path + PHI-safe logging survive (Trust Envelope). Hash-chaining/Merkle seals → Risk Register. AI provenance → Phase 6. |
| ADR-012 (integration reliability/outbox) | Deferred to the start of Phase 7 — the first real async external consumer. Pattern preserved as written. |
| ADR-013 (clinical safety / e-Rx) | Re-timed by [ADR-0005](../../docs/adr/0005-defer-abdm-typed-rx-paper-equivalent.md): pilot prints typed Rx with paper-equivalent safety; the safety engine is Phase 8. |
| HMS-MVP-Launch-Strategy-v2 | Stance ("certification later, trust controls now") survives; specifics replaced by [PILOT-SCOPE.md](../../docs/PILOT-SCOPE.md). |
| HMS-Minimum-Viable-Compliance-Spec-v1 (MVC-01..20) | Trimmed to the eight-control Trust Envelope + Risk Register in [ADR-0004](../../docs/adr/0004-pilot-trust-envelope.md). |
| HMS-MVP-Backlog-Cutline-v1 | Cutline logic survives in PILOT-SCOPE "Explicitly out" + ROADMAP "Parked indefinitely". Sprint-planning rule survives as ROADMAP standing rule 4. |
| HMS-Phase0-Revised-MVP-Sprints-v2 | Replaced by ROADMAP Phases 0–5 (the sprint plan assumed 3 pods and an AI-scribe-centered Phase 0). |
| arogya_drizzle_schema_pack/ | **Reference menu, not an adoption target** ([ADR-0002](../../docs/adr/0002-relational-first-fhir-at-the-seam.md)). Reused: RLS SQL pattern (`002`/`003`), enum/column-group ideas, table shapes — pulled in per phase, simplified. Not adopted: FHIR-canonical store, 125-table breadth, `"latest"` deps. |
| arogya_mvp_decision_pack/README | Superseded by [docs/README.md](../../docs/README.md). |

## Implementation Baseline v2 (`Arogya-OS-Implementation-Baseline-v2/`)

Added 2026-07-03 after the session. The **PRD stays alive as the vision layer** (see the hierarchy in [docs/README.md](../../docs/README.md)); everything else here is reference. Per-ADR dispositions:

| Baseline item | Disposition |
|---|---|
| HMS-PRD-v1 (both copies) | **Alive — long-term vision.** Execution deviations: solo founder (not 3 pods), workflow-first pilot (ambient scribe is Phase 6, not Phase 0), pilot timeline replaces M1–M18 phasing until validated. |
| ADR-1: FHIR-native JSONB store | Superseded *for now* by [ADR-0002](../../docs/adr/0002-relational-first-fhir-at-the-seam.md) — lost on timing, not merit; re-open trigger recorded there. |
| ADR-2: Shared-schema multi-tenancy + RLS | **Alive, simplified** into [ADR-0003](../../docs/adr/0003-single-vps-single-postgres-rls.md) (per-tenant envelope keys → Risk Register). |
| ADR-3: Scribe STT bake-off + kill criterion | Deferred intact to Roadmap Phase 6. The bake-off design and ≥70%-signed kill criterion are kept verbatim. |
| ADR-4: Edge offline for reg+billing | Deferred; pilot accepts downtime with paper fallback ([ADR-0003](../../docs/adr/0003-single-vps-single-postgres-rls.md)). Its >2%-offline-hours telemetry trigger is adopted as the re-open condition. |
| ADR-5: Config packs, no geo-logic in core | Directionally alive, not built at pilot. Pilot discipline: keep GST/identifier/terminology specifics in config *tables*, not hardcoded in logic — the pack service comes with geography #2. |
| ADR-6: Kafka-compatible event bus | Deferred; its own escape hatch (Postgres-based queue) is the plan. Transactional outbox arrives at the start of Roadmap Phase 7 (first real async external consumer). |
| ADR-7: Human sign-off boundary for AI | **Fully alive from day one** — the Preliminary→Signed state machine in Phase 2 is this ADR, built before any AI exists so Phase 6 lands on enforced rails. |
| ADR-8 / HMS-ADRs-v2 | Reconciled into [ADR-0003](../../docs/adr/0003-single-vps-single-postgres-rls.md). |
| HMS-System-Design + v2 Amendment | Reference architecture for the multi-team future. Adopted now: cross-cutting concerns as libraries not services, outbox-before-broker, no-browser-PHI rule, audit-in-transaction. The 5-deployable-unit split waits for a team. |
| HMS-Roadmap-and-Phase0-Sprints | Replaced by [docs/ROADMAP.md](../../docs/ROADMAP.md) (pod-based sprint math doesn't survive a solo founder). |
| 02-current-baseline copies of the MVP-pack docs | Condensed variants of the `arogya_mvp_decision_pack/` files — same dispositions as above. |
