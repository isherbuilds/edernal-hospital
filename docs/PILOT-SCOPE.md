# HMS Pilot Scope

**Status:** accepted (2026-07-03) · **Anchor:** signed mid-size hospital design partner, hard go-live ~8–12 weeks out · **Team:** solo founder + AI agents · **Glossary:** [CONTEXT.md](../CONTEXT.md) · **Decisions:** [docs/adr/](./adr/)

## The promise

The founder's commitment to the hospital: **a product that clearly beats their current software on feel and administrator experience.** Every screen ships against that bar — faster, cleaner, less training — because staff dual-run both systems and will compare them daily. The long-term product is the full PRD vision; this pilot is its first slice, built on foundations that won't need ripping out.

## What the pilot proves

Three product loops and one trust loop, at one hospital, in real daily operation:

1. **Front desk loop** — register a Patient in under 60 seconds → issue Token → Patient appears on the Practitioner's Queue.
2. **Doctor loop** — open Encounter from Queue → record Consult Note (template/free text) → compose and sign Prescription → print → place Orders.
3. **Money loop** — consult fee and Orders become Charges → Draft Bill → Invoice → Payment (cash / manual UPI ref) → daily summary and ordered-not-billed report.
4. **Trust loop** — every PHI touch is authenticated, role-checked, tenant-scoped, and audited; data is encrypted and backed up. See [ADR-0004](./adr/0004-pilot-trust-envelope.md).

## In scope at go-live

| Area | Scope |
|---|---|
| Registration | Name, phone, age/DOB, sex, optional address; phone-based returning-patient lookup; basic duplicate warning (phone+name). |
| Queue | Per-practitioner Tokens, live Queue board, statuses (waiting / in-consult / done / skipped). |
| Consult | Encounter screen: vitals, complaints, findings, diagnosis, advice; template or free text; prominent allergy field; Preliminary → Signed state machine. |
| Prescription | Compose from hospital Formulary or free text; sign; print (clinical-advisor-reviewed layout); immutable once signed, supersede to correct. |
| Orders | Pharmacy/lab order entry → Work Queue screens → status updates → file attachment for lab reports. **No inventory** ([ADR-0006](./adr/0006-coexistence-pilot-no-inventory.md)). |
| Billing | Service Catalog with GST rates; auto Charges from Encounter events; Draft Bill → numbered immutable Invoice; cash + manual UPI reference; credit note for corrections; day summary; ordered-not-billed report. |
| Trust | The eight Trust Envelope controls ([ADR-0004](./adr/0004-pilot-trust-envelope.md)). |
| Ops | Coolify single-VPS deploy, offsite backups, paper-fallback outage procedure ([ADR-0003](./adr/0003-single-vps-single-postgres-rls.md)). |

## Explicitly out (and where it went)

| Cut | Why | Returns in |
|---|---|---|
| AI scribe (audio, STT, LLM drafts) | Heaviest trust burden, not the hospital's ask ([ADR-0001](./adr/0001-workflow-first-opd-pilot.md)) | Phase 6 |
| ABDM / ABHA | No pilot consumer; identifier seam kept ([ADR-0005](./adr/0005-defer-abdm-typed-rx-paper-equivalent.md)) | Phase 7 |
| Drug-interaction / allergy engine | Paper-equivalent safety at pilot ([ADR-0005](./adr/0005-defer-abdm-typed-rx-paper-equivalent.md)) | Phase 7–8 |
| Pharmacy inventory / stock | Incumbent software keeps it; dual-run ([ADR-0006](./adr/0006-coexistence-pilot-no-inventory.md)) | Post-pilot decision |
| FHIR-canonical store | Mapping layer later, not storage now ([ADR-0002](./adr/0002-relational-first-fhir-at-the-seam.md)) | With ABDM |
| IPD, claims/NHCX, payment gateway, WhatsApp delivery, patient app, owner analytics, offline/edge, multi-language, marketplace | Standard cutline — validate loops first | Backlog, post-pilot |
| Break-glass, purpose-of-use engine, per-tenant KMS, hash-chained audit, support-access UI | Risk Register with mitigations ([ADR-0004](./adr/0004-pilot-trust-envelope.md)) | As tenants/team grow |

## Pilot success metrics

- Registration-to-token time (target < 60s) and tokens/day actually issued.
- Encounters signed in-system per day per doctor (adoption, not demo).
- Invoices issued in-system per day; ordered-not-billed count trend.
- Per-station usage (front desk / doctor / pharmacy / lab / billing) — the dual-run makes silent abandonment the failure mode to watch.
- Zero cross-tenant/RLS test failures; zero PHI-in-logs findings; restore drill passed.

## Named risks

1. **Dual-entry fatigue** (highest): our screens must beat the incumbent on speed for overlapping steps; review usage weekly with the hospital owner.
2. **Hard date vs solo capacity**: scope additions require removing something (sprint rule from the backlog cutline survives).
3. **Connectivity**: paper fallback procedure in the pilot agreement; log outage minutes.
4. **Doctor adoption**: clinical advisor co-designs the consult and Rx-print screens before build, not after.
