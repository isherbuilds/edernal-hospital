# HMS Documentation

The complete doc set. Produced 2026-07-03 from a grilling session over the original planning pack (Arogya Implementation Baseline v2, MVP decision pack, gates, 125-table schema pack), then compacted: everything still alive was folded into the files below; the raw inputs were deleted and live in git history (checkpoint commit `177c068`).

## Document hierarchy

| Layer                     | Where                                                                                                             | Role                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Vision**                | [VISION.md](./VISION.md)                                                                                          | The long-term product (PRD v1): full P0–P2 suite, goals, personas, market thesis. The plan is to build _all_ of it, eventually.     |
| **Execution (canonical)** | [PILOT-SCOPE.md](./PILOT-SCOPE.md) · [ROADMAP.md](./ROADMAP.md) · [adr/](./adr/) · [../CONTEXT.md](../CONTEXT.md) | Current decisions, pilot scope, and roadmap — how we get there with solid foundations, one phase at a time. **Wins all conflicts.** |
| **Reference**             | [reference/schema-menu.md](./reference/schema-menu.md)                                                            | The distilled schema pack: RLS pattern + per-domain table shapes to pull from per phase, simplified.                                |

Nothing in the execution layer is sacred — decisions are working defaults with re-open triggers written into each ADR. What _is_ fixed: foundations come first (tenancy, roles, audit, the Preliminary→Signed state machine, honest data model), because they're the parts that can't be retrofitted.

## Read in this order

1. **[PILOT-SCOPE.md](./PILOT-SCOPE.md)** — what the pilot is, what's cut, success metrics, named risks.
2. **[ROADMAP.md](./ROADMAP.md)** — phase-wise plan with step-by-step checklists, why each phase exists, and exit gates.
3. **[../CONTEXT.md](../CONTEXT.md)** — the glossary. Use these terms in code, UI, and conversation.
4. **[adr/](./adr/)** — decisions and why:
   - [0001](./adr/0001-workflow-first-opd-pilot.md) — workflow-first pilot, AI scribe deferred
   - [0002](./adr/0002-relational-first-fhir-at-the-seam.md) — relational persistence, FHIR as future export seam
   - [0003](./adr/0003-single-vps-single-postgres-rls.md) — single VPS/Coolify, one Postgres, tenant_id + RLS day one
   - [0004](./adr/0004-pilot-trust-envelope.md) — eight-control Trust Envelope + Risk Register
   - [0005](./adr/0005-defer-abdm-typed-rx-paper-equivalent.md) — ABDM deferred; typed Rx with paper-equivalent safety
   - [0006](./adr/0006-coexistence-pilot-no-inventory.md) — coexistence pilot, order routing only, no inventory
   - [0007](./adr/0007-accounting-boundary-books-integration.md) — operational billing in HMS, GL in Tally/edernal-books, one-way export seam, single-owner inventory

## Lineage of the deleted planning inputs

The old `plans/` folder (baseline PRD/ADRs 1–8, system design, MVP pack, compliance spec, gates, sprints) was distilled and removed. Where each still-alive idea went: baseline ADR-1 (FHIR-native store) superseded with re-open trigger in ADR-0002 · ADR-2 (RLS multi-tenancy) simplified into ADR-0003 · ADR-3 (scribe bake-off + ≥70%-signed kill criterion) kept verbatim in ROADMAP Phase 6 · ADR-4 (offline edge) deferred with the >2%-offline-hours trigger in ADR-0003/ROADMAP · ADR-5 (config packs) survives as ROADMAP standing rule 6 · ADR-6 (event bus) deferred; outbox at start of Phase 7 · ADR-7 (human sign-off for AI) fully alive as the Preliminary→Signed state machine · ADR-8/008 (deployment) reconciled into ADR-0003 · MVC-01..20 trimmed to the ADR-0004 Trust Envelope + Risk Register · gates and sprints collapsed into ROADMAP phase exit gates. Everything else: git history.

## Ground facts these docs assume

- Solo founder + AI agents; strictly serial execution.
- Signed mid-size hospital design partner, hard go-live ~8–12 weeks from 2026-07-03; clinical advisor on board.
- **The promise to the hospital:** a product that beats their current software on _feel and administrator experience_. UX speed and polish are pilot success criteria, not nice-to-haves.
- Hospital keeps its existing software for inventory/stock; staff dual-run both systems during the pilot.
- Long-term intent is the full [VISION.md](./VISION.md) suite ("add everything") — the roadmap sequences it; the cutline decides _when_, not _whether_.
- Repo is a tsu-stack starter (TanStack Start + Hono + oRPC + Drizzle + Better Auth + Coolify); no HMS code exists yet.
- Product name undecided — "HMS" is a neutral placeholder throughout ("Arogya OS" in the vision doc).
