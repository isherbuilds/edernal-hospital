# 0007: HMS owns operational billing; general ledger lives outside HMS via a one-way export seam; inventory has exactly one owner

**Status:** accepted (2026-07-03)

The founder also owns **edernal-books** (India-SMB accounting platform: double-entry kernel, GST tax core with GSTR-1/3B builders, org-multi-tenant — but no inventory until its Phase 9, no public API until its Phase 6, no Tally export until its Phase 8). The hospital's incumbent HMS wins accountant goodwill by generating GST reports that let Tally "catch up" for ITR filing. Decision, in three parts:

1. **HMS keeps operational billing; HMS never grows a general ledger.** Invoices, payments, charges, day-close stay in HMS (they're operationally and PHI-coupled to Encounters). Chart of accounts, journals, trial balance, GSTR filings, P&L are accounting-system territory — first the hospital's existing Tally-based flow, later edernal-books.
2. **Integration is a one-way, batch-shaped export seam — never a runtime dependency.** At pilot: accountant-grade exports from HMS (GST-ready invoice/collections registers, day-close summary as CSV) matching what the incumbent gives the CA. Later: the same day-close feed posts journal entries into Edernal Books, Tally, or another configured accounting destination through the connector pattern in [ADR-0008](./0008-accounting-connector-export-ledger.md). Invoice printing and payment capture at the hospital counter must never block on the accounting system being up.
3. **Inventory gets exactly one owner, and for a hospital that owner is HMS (when built, post-pilot).** Pharmacy stock is operational and domain-specific (batch, expiry, schedule-H, ward issue) — it belongs beside the order/dispense workflow. edernal-books receives only periodic valuation/COGS postings, not live stock. "Both apps for performance" is rejected: volumes are trivial for Postgres, and dual-written stock is the classic sync-corruption trap (concurrent decrements never reconcile).

## Why the seam and not deep coupling

- Coupling two pre-1.0 solo-founder products on a hard-dated pilot's critical path doubles the failure surface; books' integration surface (session-auth internal RPC today) isn't a stable contract yet.
- The export-seam is the proven pattern the hospital already trusts (incumbent → Tally). Matching it is the pilot bar; beating it (one-click into edernal-books, no CA re-entry) is the post-pilot upsell.
- **PHI stays out of the accounting system**: the feed carries day-level aggregates and document totals (e.g., "OPD cash collections", payer-level lines for TPA/credit), not patient names. Books is not a PHI processor, and keeping it that way avoids dragging it into the Trust Envelope.

## Consequences

- HMS Phase 3 (money loop) gains the accountant-export checklist items; the strategic accounting connector is a vision-phase item gated on connector and destination readiness, not on pilot counter workflows.
- Tally XML export is built only if the hospital's CA actually asks — CSV registers usually suffice for Tally data entry, and books' own Phase 8 ("accountant mode") may cover it product-wide later.
- When edernal-books builds Phase 9 inventory, hospital pharmacy still stays in HMS; the two products share the valuation-posting pattern, not tables.

## Revisit triggers

Books Phase 6 API ships · the pilot CA rejects CSV and demands Tally vouchers · a customer wants full accounting inside the HMS (then embed books as the engine rather than rebuilding a GL).
