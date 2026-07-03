# HMS Documentation

The canonical doc set, produced 2026-07-03 from a grilling session over the original planning pack, then reconciled against the Implementation Baseline v2 (PRD, System Design, ADRs 1–7).

## Document hierarchy

| Layer | Where | Role |
|---|---|---|
| **Vision** | `plans/.../Arogya-OS-Implementation-Baseline-v2/01-originals/HMS-PRD-v1.md` | The long-term product: full P0–P2 suite, goals, personas, market thesis. The plan is to build *all* of it, eventually. |
| **Execution (canonical)** | `docs/` + `CONTEXT.md` | Current decisions, pilot scope, and roadmap — how we get there with solid foundations, one phase at a time. **Wins all conflicts.** |
| **Reference** | everything else under `plans/` | Background material and design menus (see `plans/hms_plans_to_be_cleaned_and_reviewd/SUPERSEDED.md` for per-file dispositions, including baseline ADRs 1–7). |

Nothing in the execution layer is sacred — decisions are working defaults with re-open triggers written into each ADR. What *is* fixed: foundations come first (tenancy, roles, audit, the Preliminary→Signed state machine, honest data model), because they're the parts that can't be retrofitted.

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

## Ground facts these docs assume

- Solo founder + AI agents; strictly serial execution. (The baseline docs assume ~12 engineers in 3 pods — read their estimates accordingly.)
- Signed mid-size hospital design partner, hard go-live ~8–12 weeks from 2026-07-03; clinical advisor on board.
- **The promise to the hospital:** a product that beats their current software on *feel and administrator experience*. UX speed and polish are pilot success criteria, not nice-to-haves.
- Hospital keeps its existing software for inventory/stock; staff dual-run both systems during the pilot.
- Long-term intent is the full PRD suite ("add everything") — the roadmap sequences it; the cutline decides *when*, not *whether*.
- Repo is a tsu-stack starter (TanStack Start + Hono + oRPC + Drizzle + Better Auth + Coolify); no HMS code exists yet.
- Product name undecided — "HMS" is a neutral placeholder throughout ("Arogya OS" in older docs).
