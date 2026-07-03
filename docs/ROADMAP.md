# HMS Roadmap — phase-wise, with checklists

**Anchor:** hard go-live at the design-partner hospital in ~8–12 weeks (solo founder + AI agents, strictly serial phases).
**Scope authority:** [PILOT-SCOPE.md](./PILOT-SCOPE.md). **Decisions:** [docs/adr/](./adr/). **Glossary:** [CONTEXT.md](../CONTEXT.md).

**Reading guide:** every phase states _why it exists_, then a step-by-step checklist, then an exit gate. A phase is done when its gate passes — not when its checklist looks done. If the date compresses, cut from the _end_ of Phase 3 and Phase 4's P1 items, never from Phase 5 (trust) or the gates.

The repo today is a pristine tsu-stack starter (TanStack Start + Hono + oRPC + Drizzle + Better Auth, Coolify compose files). The [schema menu](./reference/schema-menu.md) is a **reference menu** — pull tables per phase, simplified ([ADR-0002](./adr/0002-relational-first-fhir-at-the-seam.md)).

---

## Phase 0 — Foundation & tenancy skeleton (~week 1–2)

**Why first:** every later table and endpoint depends on tenancy, roles, and audit being in the request path. Retrofitting `tenant_id`, RLS, or audit emission across a built app is the classic irreversible mistake the old docs warned about — this is the only "platform" phase, kept deliberately small.

**Checklist**

- [ ] Enable Better Auth plugins needed for a hospital: `organization` (= Tenant), `admin`, MFA for admin roles; regenerate auth schema into `@tsu-stack/db`.
- [ ] Core tables in `@tsu-stack/db`: `tenants` (linked to auth organization), `facilities`, `staff_profiles` (user↔tenant↔role), `practitioners`.
- [ ] Roles: `front_desk`, `practitioner`, `billing`, `pharmacy_lab`, `hospital_admin` — seed + role check helper in the oRPC procedure factory (deny-by-default: every procedure declares allowed roles or fails closed).
- [ ] Tenant context middleware: resolve tenant from session on every request; set Postgres session GUCs (`app.tenant_id`, `app.user_id`) per transaction — adapt `002_rls_context.sql` from the [schema menu](./reference/schema-menu.md).
- [ ] RLS: enable + FORCE on all tenant-scoped tables from the first migration; adapt the [schema menu](./reference/schema-menu.md)'s policy loop.
- [ ] `audit_events` table (append-only; app DB role has INSERT/SELECT only) + `audit()` helper wired into the procedure factory so PHI procedures emit events without per-endpoint boilerplate; the event is inserted **in the same transaction** as the write it records.
- [ ] PHI-safe logger wrapper over `@tsu-stack/logger`: accepts IDs/codes/metrics only; CI grep/test that fails on known PHI field names in log calls.
- [ ] Seed script: two synthetic tenants, one facility each, users per role, fake patients.
- [ ] CI: typecheck, lint, unit tests, **cross-tenant denial tests** (tenant A queries tenant B via API and raw SQL → both fail), audit-emission test, PHI-log test.
- [ ] Deploy skeleton to the VPS via Coolify now (deploy pain surfaces early, not in week 9); TLS, secrets via dotenvx, Postgres volume encryption or encrypted disk.

**Exit gate:** synthetic user logs in → creates a record in tenant A → audit event exists → tenant B cannot see it (proven in CI) → app runs on the real VPS over TLS.

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
- [ ] **Accountant exports** ([ADR-0007](./adr/0007-accounting-boundary-books-integration.md)): GST-ready invoice register + collections register + day-close summary as CSV — parity with what the incumbent gives the CA for Tally/ITR. No patient names in exports beyond what the CA genuinely needs.
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

**Exit gate (Go-live gate):** restore drill passed · deny/RLS/audit/PHI-log CI suites green · advisor sign-off done · pilot agreement signed · staff trained · fallback playbook agreed · founder go/no-go recorded.

---

## Phase 5 — Go-live & stabilization (~week 10–12+)

**Why:** the pilot's output is _learning_, and learning needs instrumented, supported, real usage — not a launch event.

**Checklist**

- [ ] Go live front-desk-first (registration+queue on day 1; doctor and billing stations within the same week — staged by station, not big-bang).
- [ ] Daily on-site or on-call presence for week 1–2; same-day fixes for workflow blockers.
- [ ] Weekly metrics review with owner + advisor: registrations/day, signed encounters/day per doctor, invoices/day, ordered-not-billed trend, per-station usage (watch for silent abandonment — the dual-run risk).
- [ ] Log outage minutes; if material, re-open the connectivity decision in [ADR-0003](./adr/0003-single-vps-single-postgres-rls.md).
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

Second tenant on the same stack (the test [ADR-0003](./adr/0003-single-vps-single-postgres-rls.md) was designed for) → tenant provisioning script → graduate Risk Register items: per-tenant key handling, support-access workflow, break-glass, hash-chained audit export → pricing/packaging → managed Postgres / second node when ops pain, not before.

### Later vision phases (from the PRD — built, but only on pull)

The long-term intent is the full PRD suite; these queue behind Phases 6–9 and enter the roadmap when a paying customer or pilot learning pulls them, not on a calendar: **edernal-books integration** (day-close journal feed into books' Phase-6 public API — one-way, aggregate, PHI-free per [ADR-0007](./adr/0007-accounting-boundary-books-integration.md)) · claims assist/NHCX (PRD R7) · IPD suite (PRD P2 — the generic Encounter model is the insurance already being paid) · pharmacy inventory (owned by HMS when built, valuations posted to accounting — [ADR-0007](./adr/0007-accounting-boundary-books-integration.md)) · owner analytics + NL Q&A · patient app/WhatsApp assistant · offline/edge (baseline ADR-4 design, trigger: >2% consult-hours offline) · regional-language expansion · config-pack service + global compliance packs (with geography #2) · marketplace/API · customer-managed deployment (enterprise tier only).

---

## Standing rules (survive every phase)

1. No real PHI before the Phase-4 Trust Envelope gate — synthetic data until then.
2. Every new PHI endpoint ships with: role declaration, tenant scoping, audit event, and a deny test — enforced by the procedure factory, checked in review.
3. Preliminary artifacts never print/share/export. This rule is load-bearing for Phases 6–8.
4. Scope additions require removals — the cutline conversation happens in writing, weekly.
5. Update [CONTEXT.md](../CONTEXT.md) when a term changes; write an ADR when a decision is hard to reverse, surprising, and a real trade-off.
6. Geography/compliance specifics (GST rates, identifier systems, terminology) live in config _tables_, not code (baseline ADR-5) — the config-pack service arrives with geography #2.
7. PHI stays server-side: no browser-persisted caches (localStorage/IndexedDB); render from the server, keep client state in memory.
