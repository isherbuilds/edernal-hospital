# 0002: Relational-first persistence; FHIR at the seam

**Status:** accepted (2026-07-03) — supersedes baseline **ADR-1** (FHIR-R4-native JSONB store) and the schema pack's FHIR-canonical design, for the current execution horizon

Baseline ADR-1 and the Arogya schema pack proposed a FHIR-R4 JSONB canonical store (`fhir_resource_versions` + projection tables) as the source of truth, justified by ABDM bundles and global portability. We decided instead on **plain relational Drizzle tables** (patients, encounters, consult_notes, prescriptions, orders, invoices…) as the source of truth, with FHIR treated as a future export/translation layer for ABDM.

## Why

- Nothing in the pilot consumes FHIR: ABDM is deferred (ADR-0005), there are no external exchanges, and the UI reads/writes operational tables. A canonical JSONB store means double bookkeeping (resource + projection), profile validation infrastructure, and awkward queries — all cost, no pilot payoff.
- FHIR-shaped data is a mapping problem, not a storage problem. Keeping FHIR-compatible concepts (Patient/Encounter naming, identifier slots, code fields where cheap) makes the later export layer straightforward.
- A solo founder ships and debugs plain tables dramatically faster.

## Considered options

- **FHIR-canonical (schema pack design):** rejected — heavyweight, no consumer at pilot, slows every feature.
- **Hybrid (FHIR for clinical resources only):** rejected — still buys the validation/projection machinery for the hardest 20% of the data.

## Consequences

- The 125-table schema pack (distilled into the [schema menu](../reference/schema-menu.md)) is a **reference menu, not an adoption target**. Tables are pulled in (and usually simplified) per roadmap phase; `fhir.ts` is not adopted.
- When ABDM work starts, we build `domain table → FHIR bundle` mappers and validate outbound bundles only. Clinical data never migrates — only a mapping layer is added.
- Keep discipline now: store codes (not just labels) for diagnoses/meds where it's cheap, keep an identifier table on Patient with a system/value shape, keep Encounter as the anchor entity (generic enough for future IPD/ER, per the PRD's P2 insurance).
- **Re-open trigger:** the ABDM integration phase, the first external FHIR consumer, or evidence that the mapping layer is rotting (export drift vs domain tables). ADR-1's long-term argument (one honest source of truth for multi-geography interop) stays on file — it lost on timing, not on merit.
