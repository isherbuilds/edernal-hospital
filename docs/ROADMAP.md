# HMS Roadmap — phase-wise, with checklists

**Anchor:** hard go-live at the design-partner hospital in ~8–12 weeks (solo founder + AI agents, strictly serial phases).
**Scope authority:** [PILOT-SCOPE.md](./PILOT-SCOPE.md). **Decisions:** [docs/adr/](./adr/). **Glossary:** [CONTEXT.md](../CONTEXT.md).

**Reading guide:** every phase states _why it exists_, then a step-by-step checklist, then an exit gate. A phase is done when its gate passes — not when its checklist looks done. If the date compresses, cut from the _end_ of Phase 3 and Phase 4's P1 items, never from Phase 5 (trust) or the gates.

The repo today is a pristine tsu-stack starter (TanStack Start + Hono + oRPC + Drizzle + Better Auth, Coolify compose files). The [schema menu](./reference/schema-menu.md) is a **reference menu** — pull tables per phase, simplified ([ADR-0002](./adr/0002-relational-first-fhir-at-the-seam.md)).

---

## Phase 0 — Foundation & tenancy skeleton (~week 1–2)

**Why first:** every later table and endpoint depends on tenancy, roles, and audit being in the request path. Retrofitting `tenant_id`, tenant-scoped query discipline, or audit emission across a built app is the classic irreversible mistake the old docs warned about — this is the only "platform" phase, kept deliberately small.

**Implementation note (2026-07-04):** deploy/VPS/TLS work is deliberately excluded from this Phase 0 implementation pass; the founder will handle it manually.

**Migration note (2026-07-04):** Phase 0 is allowed to reset the pre-production database baseline. Existing local or preview databases that recorded the old starter migration must be reset before applying the Phase 0 migrations.

**Checklist**

- [ ] Enable Better Auth `organization` (= Tenant) plugin; verified organization membership is the Tenant boundary. Defer `twoFactor` until the admin MFA enrollment/verification UX is built; defer Better Auth `admin` until support impersonation has a signed Audit Event design.
- [ ] Extend Better Auth `organization` with Tenant profile fields (`display_name`, `legal_name`, `default_timezone`) and `member` with lightweight Staff User attributes (`employee_code`, `display_name_override`); do not add a separate 1:1 `tenants` table.
- [ ] Core Tenant-owned tables in `@tsu-stack/db`: `facilities`, `practitioners`, and `audit_events`, each carrying `tenant_id = organization.id`.
- [ ] Facility is a data foreign key carried on Facility-owned rows, not an auth/scoping boundary at pilot (one Facility per pilot Tenant; role+Tenant is the access model per [ADR-0004](./adr/0004-pilot-trust-envelope.md)).
- [ ] Role slugs/constants in `packages/core`: `front_desk`, `practitioner`, `billing`, `pharmacy_lab`, `hospital_admin`; Better Auth organization member role is authoritative; member additional fields carry lightweight Staff User attributes, never a second role source.
- [ ] oRPC procedure factory role check helper is deny-by-default: every procedure declares allowed roles or fails closed; unauthenticated procedures (login, health) must be **explicitly marked public**.
- [ ] Tenant context middleware: treat client-provided Tenant IDs as selectors only; verify Better Auth membership server-side before any Tenant-scoped query.
- [ ] Tenant-scoped query helpers/procedure context: every PHI read/write requires Tenant context, scopes by `tenant_id`, and exposes no unscoped DB helpers to feature code.
- [ ] `audit_events` table: tenant-owned append-only events (`tenant_id`, actor user id, action, resource type/id, timestamp), queryable later by patient/actor/date; migrations run as owner role while the runtime app DB role has INSERT/SELECT only and no UPDATE/DELETE; `audit()` helper wires into the procedure factory so PHI procedures emit events without per-endpoint boilerplate; for writes, the event is inserted **in the same transaction** as the write it records; reads/searches also emit Audit Events through the same non-optional helper API without hard-coding one-event-per-row.
- [ ] PHI-safe logger wrapper over `@tsu-stack/logger`: accepts IDs/codes/metrics only; CI grep/test that fails on known PHI field names in log calls.
- [ ] Seed script: two synthetic Better Auth organizations/Tenants, one Facility each, users per role, practitioners; the seed grows with each phase.
- [ ] CI: typecheck, lint, unit tests, reusable **cross-tenant denial test harness** against Phase-0 Tenant-owned resources (Practitioner/Facility records; later phases extend it), audit-emission tests for read and write paths, PHI-log test.

**Exit gate:** synthetic `hospital_admin` selects Tenant A → creates a Practitioner or Facility record → write Audit Event exists → reads it back and read Audit Event exists → wrong-role user calling a restricted procedure is denied (proven in CI) → Tenant B cannot see it (proven in CI).

---

## Phase 1 — Front desk loop (~week 2–4)

**Why now:** registration + queue is the hospital's front door, the highest-volume workflow, and the fastest visible win for staff. It also creates the Patient and Encounter entities everything else hangs on.

**Checklist**

- [ ] `patients` (+ `patient_identifiers` with system/value shape — the ABHA seam, empty at pilot) and phone-first lookup index.
- [ ] Quick-register API + screen: name, phone, age/DOB, sex, optional address; target < 60s end-to-end; returning-patient search by phone with pick-or-create.
- [ ] Duplicate warning: same phone + similar name → non-blocking prompt (no merge machinery at pilot).
- [ ] `encounters` (status lifecycle: planned → in-progress → finished), created at check-in.
- [ ] `tokens` + per-practitioner daily sequence; Queue statuses (waiting / in-consult / done / skipped).
- [ ] Queue board screen (auto-refresh; usable on a TV/large display) + front-desk queue management (issue, reassign, skip).
- [ ] Practitioner day list: today's tokens with one-tap "start consult".
- [ ] Audit events on patient create/read/search (verify via the Phase-0 helper, don't re-implement).
- [ ] UI speed pass with a front-desk mindset: keyboard-first entry, no dead clicks — this is the dual-run battleground ([ADR-0006](./adr/0006-coexistence-pilot-no-inventory.md)).

**Exit gate:** synthetic patient registered in <60s → token issued → appears on queue board and practitioner list within 3s → all touches audited.

---

## Phase 2 — Doctor loop (~week 4–6)

**Why now:** doctor adoption decides the pilot. The consult screen and printed prescription are the artifacts the clinical advisor must co-design; getting them in front of the advisor early leaves time to iterate before go-live.

**Checklist**

- [ ] Review consult screen + Rx print mock with the clinical advisor **before building** (paper/Figma is fine — this is the cheapest safety and adoption work in the whole plan).
- [ ] `consult_notes`: vitals, complaints, findings, diagnosis (free text + optional code field for the future), advice/follow-up; **Preliminary → Signed** state machine (signed = immutable; correction = superseding version).
- [ ] Prominent allergy field on Patient, always visible in the consult header ([ADR-0005](./adr/0005-defer-abdm-typed-rx-paper-equivalent.md)).
- [ ] Note templates per specialty (2–3 launch templates defined with the advisor).
- [ ] `formulary_items` (hospital-local: name, strength, form, default dose text) + admin CRUD; import the hospital's common-meds list.
- [ ] `prescriptions` + `prescription_lines`: quick-pick from Formulary or free text; dose/frequency/duration fields; sign action; immutable after signing; supersede-to-correct.
- [ ] Rx print view: advisor-approved layout, hospital letterhead, practitioner registration number, signed-only printing enforced at the API (Preliminary artifacts cannot print — the future AI seam depends on this rule existing now, [ADR-0001](./adr/0001-workflow-first-opd-pilot.md)).
- [ ] Sign/print emit audit events.

**Exit gate:** clinical advisor walks through register → consult → sign → printed Rx on synthetic data and approves layout + flow; unsigned notes/Rx provably cannot print.

---

## Phase 3 — Orders & money loop (~week 6–8)

**Why now:** billing closes the owner's loop (revenue visibility is why the hospital owner said yes) and order routing is what makes the doctor loop land outside the consult room. Built after the doctor loop because Charges hang off Encounter events.

**Checklist**

- [ ] `orders` (pharmacy | lab; status: ordered → in-progress → completed/cancelled) placed from the consult screen.
- [ ] Pharmacy Work Queue and Lab Work Queue screens: pending orders, mark status, lab file attachment (PDF/image upload to object storage; **no inventory, no structured results** — [ADR-0006](./adr/0006-coexistence-pilot-no-inventory.md)).
- [ ] `service_catalog` with prices + GST rate per item; admin CRUD; load the hospital's real price list.
- [ ] `charges`: auto-created from consult fee and Orders; test asserts **no silent drop** (every completed order has a charge or an explicit waiver).
- [ ] Draft Bill screen (billing role): review/adjust, then finalize.
- [ ] `invoices` + `invoice_lines`: sequential numbering per facility, GST fields, immutable once issued; `credit_notes` for corrections.
- [ ] `payments`: cash + manual UPI reference; partial payment allowed; receipt print.
- [ ] Invoice/receipt print views (match hospital's current format where sane).
- [ ] Day summary screen (collections by mode, invoice count) + **ordered-not-billed report** (the leakage number is the ROI headline for the owner).
- [ ] **Accountant exports** ([ADR-0007](./adr/0007-accounting-boundary-books-integration.md), [ADR-0008](./adr/0008-accounting-connector-export-ledger.md)): GST-ready invoice register + collections register + day-close summary as CSV — parity with what the incumbent gives the CA for Tally/ITR. Use stable HMS source references in exported rows so future connector backfills can dedupe. No patient names in exports beyond what the CA genuinely needs.
- [ ] Audit on invoice finalize / payment / print / export.

**Exit gate:** end-to-end synthetic demo — register → token → consult → sign → Rx print → orders → work queues → charges → invoice → payment → day summary reconciles to the rupee; ordered-not-billed catches a seeded dropped charge.

---

## Phase 4 — Pilot readiness (~week 8–10)

**Why:** the difference between "the app works" and "a hospital can run on it." Everything here is cheap compared to discovering it live.

**Checklist**

- [ ] Offsite automated backups (nightly logical + WAL/PITR if manageable) → **restore drill** into a scratch environment with checksum report ([ADR-0004](./adr/0004-pilot-trust-envelope.md) gate).
- [ ] Trust Envelope audit: run through all eight controls; write the Risk Register entries for everything deferred, dated and signed (you) — this document is what you show hospital #2's auditor.
- [ ] Audit report screen for hospital_admin: query by patient / actor / date (also your support tool).
- [ ] Operational alarms: uptime check, disk space, backup success, error-rate — to your phone.
- [ ] Outage playbook: paper-fallback procedure written with the hospital (who does what when the screen is blank, and how paper re-enters the system after).
- [ ] Pilot agreement finalized: data processing, retention, support access, incident contact, fallback procedure.
- [ ] Training: 1-page per-role quick cards (front desk, doctor, pharmacy/lab, billing); hands-on sessions on synthetic data at the hospital.
- [ ] UAT week: hospital staff run realistic synthetic scenarios; fix the top friction items — **speed > features** for the dual-run.
- [ ] Load sanity: one day's realistic volume (registrations, tokens, invoices) on the VPS without degradation.
- [ ] Rollback plan: tagged releases, tested `docker compose` rollback, migration down-strategy or restore-based rollback.

**Exit gate (Go-live gate):** restore drill passed · deny/tenant-scope/audit/PHI-log CI suites green · advisor sign-off done · pilot agreement signed · staff trained · fallback playbook agreed · founder go/no-go recorded.

---

## Phase 5 — Go-live & stabilization (~week 10–12+)

**Why:** the pilot's output is _learning_, and learning needs instrumented, supported, real usage — not a launch event.

**Checklist**

- [ ] Go live front-desk-first (registration+queue on day 1; doctor and billing stations within the same week — staged by station, not big-bang).
- [ ] Daily on-site or on-call presence for week 1–2; same-day fixes for workflow blockers.
- [ ] Weekly metrics review with owner + advisor: registrations/day, signed encounters/day per doctor, invoices/day, ordered-not-billed trend, per-station usage (watch for silent abandonment — the dual-run risk).
- [ ] Log outage minutes; if material, re-open the connectivity decision in [ADR-0003](./adr/0003-single-vps-app-tenancy.md).
- [ ] Feedback triage: single list, weekly cutline conversation — additions require removals.
- [ ] End-of-pilot review with the hospital: which workflows won, the dual-run exit story ([ADR-0006](./adr/0006-coexistence-pilot-no-inventory.md)), reference/testimonial, commercial terms.

**Exit gate:** 4+ consecutive weeks of real daily usage at every station; owner agrees to continue past pilot; written pilot review.

---

## Post-pilot phases (sequenced, not scheduled)

Order below is the default; real order is decided by pilot learning + hospital #2's demands. Each phase re-opens the Risk Register ([ADR-0004](./adr/0004-pilot-trust-envelope.md)).

### Phase 6 — AI scribe (the "AI-native" bet, [ADR-0001](./adr/0001-workflow-first-opd-pilot.md))

Per-encounter audio consent capture (UI blocked without consent) → encrypted audio lifecycle with default delete-after-signoff → STT vendor behind an interface (bake-off: entity error rate, latency, cost) + vendor no-training/region terms → LLM structuring into the _existing_ Consult Note preliminary state → provenance metadata (model/version/prompt/source spans/confidence) → doctor review/edit/sign UI with low-confidence highlighting. Gate: real audio only after consent + deletion path + vendor terms pass (the old Gate-2 list survives intact here). **Kill criterion** (baseline ADR-3, kept verbatim): if <70% of scribe-drafted notes are signed without major edits after the bake-off tuning window, shelve the scribe rather than ship an untrusted one.

### Phase 7 — ABDM & ABHA ([ADR-0005](./adr/0005-defer-abdm-typed-rx-paper-equivalent.md))

ABHA capture/verify at registration (sandbox → production), domain→FHIR bundle mappers + outbound validation ([ADR-0002](./adr/0002-relational-first-fhir-at-the-seam.md)), consent artefact lifecycle, M1/M2 evidence collection. Also the point where WhatsApp delivery (short-lived signed links) and a payment gateway earn their place — all three need the outbox/idempotency pattern, so build the transactional outbox at the _start_ of this phase, not before (first real async external consumer).

### Phase 8 — Medication safety engine (re-opens ADR-013 content)

Versioned drug dictionary + licensed interaction/allergy rule source → `MedicationSafetyService` with severity levels → severe alerts block signing with structured override reasons + audit → alert-fatigue governance (override-rate monitoring) → clinical advisor signs the ruleset → ≥20 regression prescriptions from pilot specialties. Prerequisite for calling anything "e-Rx" or transmitting prescriptions digitally.

### Phase 9 — Tenant #2 and SaaS-ification

Second tenant on the same stack (the test [ADR-0003](./adr/0003-single-vps-app-tenancy.md) was designed for) → tenant provisioning script → graduate Risk Register items: database-enforced tenant isolation/RLS decision, per-tenant key handling, support-access workflow, break-glass, hash-chained audit export → pricing/packaging → managed Postgres / second node when ops pain, not before.

### Later vision phases (from the PRD — built, but only on pull)

The long-term intent is the full PRD suite; these queue behind Phases 6–9 and enter the roadmap when a paying customer or pilot learning pulls them, not on a calendar: **accounting connectors** (day-close feed into Edernal Books, Tally, CSV, or another configured destination — one-way, aggregate, PHI-free, source-keyed, and preview-first per [ADR-0007](./adr/0007-accounting-boundary-books-integration.md) and [ADR-0008](./adr/0008-accounting-connector-export-ledger.md)) · claims assist/NHCX (PRD R7) · IPD suite (PRD P2 — the generic Encounter model is the insurance already being paid) · pharmacy inventory (owned by HMS when built, valuations posted to accounting — [ADR-0007](./adr/0007-accounting-boundary-books-integration.md)) · owner analytics + NL Q&A · patient app/WhatsApp assistant · offline/edge (baseline ADR-4 design, trigger: >2% consult-hours offline) · regional-language expansion · config-pack service + global compliance packs (with geography #2) · marketplace/API · customer-managed deployment (enterprise tier only).

---

## Standing rules (survive every phase)

1. No real PHI before the Phase-4 Trust Envelope gate — synthetic data until then.
2. Every new PHI endpoint ships with: role declaration, tenant scoping, audit event, and a deny test — enforced by the procedure factory, checked in review.
3. Preliminary artifacts never print/share/export. This rule is load-bearing for Phases 6–8.
4. Scope additions require removals — the cutline conversation happens in writing, weekly.
5. Update [CONTEXT.md](../CONTEXT.md) when a term changes; write an ADR when a decision is hard to reverse, surprising, and a real trade-off.
6. Geography/compliance specifics (GST rates, identifier systems, terminology) live in config _tables_, not code (baseline ADR-5) — the config-pack service arrives with geography #2.
7. PHI stays server-side: no browser-persisted caches (localStorage/IndexedDB); render from the server, keep client state in memory.
