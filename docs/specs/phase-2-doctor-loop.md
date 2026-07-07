# Spec: Phase 2 — Doctor loop

Status: ready

Source: [ROADMAP.md Phase 2](../ROADMAP.md) · Scope authority: [PILOT-SCOPE.md](../PILOT-SCOPE.md) · ADRs: [0001](../adr/0001-workflow-first-opd-pilot.md), [0005](../adr/0005-defer-abdm-typed-rx-paper-equivalent.md)

> Gate note (2026-07-05): the user invoked ship for "phase 2 from implementation all the way (except the commit)" and declined the seam/product confirmation prompt. Defaults taken (recorded in Implementation Decisions): Phase 0/1 test-seam precedent, no e2e scaffolding, provisional advisor stand-ins, encounter-practitioner-only signing, one current artifact per Encounter, hardcoded-English UI copy per Phase 1 precedent. The clinical-advisor walkthrough in the ROADMAP exit gate is an external human step outside this run.

## Problem

Doctor adoption decides the pilot. After Phase 1 a Practitioner can start a consult from the Queue, but there is nowhere to record the Consult Note, no Formulary, no Prescription, and nothing to print. The consult screen and the printed prescription are the artifacts the clinical advisor must co-design and the doctor must prefer over the prescription pad.

## Solution

A consult workspace reached from the Queue: the Practitioner sees the Patient header with a prominent allergy field, records vitals/complaints/findings/diagnosis/advice/follow-up (template-prefilled or free text), composes a Prescription from the hospital Formulary or free text, signs both, and prints the Rx on a hospital letterhead layout. Signed artifacts are immutable (supersede-to-correct); Preliminary artifacts provably cannot print — enforced at the API and by DB triggers, because the future AI seam depends on this rule (ADR-0001). hospital_admin manages the Formulary and Note Templates.

## User Stories

1. As a Practitioner, I want "start consult" on my day list to open the consult screen for that Encounter, so that I go from Queue to consulting in one tap.
2. As a Practitioner, I want the Patient's allergies always visible (and editable) in the consult header, so that paper-equivalent safety is preserved (ADR-0005).
3. As a Practitioner, I want to record vitals, complaints, findings, diagnosis (free text + optional code), advice, and follow-up, saving as Preliminary as I go, so that nothing is lost mid-consult.
4. As a Practitioner, I want to apply a specialty Note Template that prefills empty fields, so that routine consults are fast.
5. As a Practitioner, I want to sign the Consult Note, making it immutable, so that the record is trustworthy; to correct it I supersede it with a new version.
6. As a Practitioner, I want to compose a Prescription by quick-picking Formulary items (prefilling dose text) or typing free text, with dose/frequency/duration/instructions per line, so that prescribing beats the paper pad on speed.
7. As a Practitioner, I want to sign the Prescription and print it on the hospital letterhead with my registration number, so that the Patient leaves with a valid Rx.
8. As a Practitioner, I cannot print an unsigned or superseded Prescription — the API refuses, not just the UI.
9. As a hospital_admin, I want CRUD screens for Formulary items and Note Templates, so that the hospital's common-meds list and launch templates are maintainable.
10. As a front-desk user, I can capture known allergies at registration (optional).
11. As a hospital_admin, every sign and print action is audited, and cross-tenant access to any Phase 2 resource is denied.

## Implementation Decisions

Decisions taken as ship-calls (user declined the prompt; recommended defaults):

- **Seams:** oRPC router procedures via the existing runtime-test harness (real Postgres, `createTenantFixture`, `call(router.proc, input, {context})`, `expectOrpcCode`), plus DB triggers for signed-immutability tested by raw tx mutation. No Playwright/e2e scaffolding this phase; UI verified by dev-server smoke test.
- **Advisor stand-ins:** provisional Rx print layout, 3 generic launch templates, synthetic common-meds seed — all flagged for advisor iteration. Rx print carries prescription data + patient demographics/allergies + practitioner + facility letterhead; consult-note content stays off the Rx until the advisor asks.
- **Sign authority:** only the Encounter's Practitioner may sign/supersede, and the session user must be linked to that Practitioner row (`practitioners.user_id`). hospital_admin can view (workspace) and print signed Rx but never signs. Tightened during the run: the same identity rule applies to **all** clinical writes (saveNote/savePrescription included) — preliminary artifacts are the owning doctor's scratch space, not tenant-wide editable.
- **Cardinality:** one current (non-superseded) Consult Note and one current Prescription per Encounter, enforced by partial unique indexes.
- **Copy:** hardcoded English in feature UI (Phase 1 front-desk precedent); navbar labels use Paraglide keys because the nav config already does (`en.json` only).
- **No encounter-status guard on note/Rx editing:** the doctor may complete or correct records after the Token is done (paper-equivalent; the UI drives the normal flow).

### Data model (packages/db)

New pgEnum `clinical_artifact_status`: `preliminary | signed | superseded`. All tables follow house conventions: uuid defaultRandom PK, `tenant_id` text FK → organization restrict, `uq(tenant_id, id)`, composite tenant-scoped FKs, timestamptz created/updated, columns alphabetical.

- `consult_notes`: encounter_id (composite FK restrict), patient_id, practitioner_id (composite FKs restrict), status (default preliminary), vitals jsonb `ConsultNoteVitals` default {}, complaints/findings/diagnosis_text/advice/follow_up text NN default '', diagnosis_code text NULL (future code seam), signed_at timestamptz NULL, signed_by_user_id text NULL (no FK — mirrors audit actor precedent), supersedes_consult_note_id uuid NULL (composite self-FK restrict, unique per tenant so a note is superseded at most once). Partial unique `(tenant_id, encounter_id) WHERE status <> 'superseded'`. Index `(tenant_id, patient_id)`.
- `prescriptions`: same skeleton as consult_notes minus content fields (encounter/patient/practitioner, status, signed_at, signed_by_user_id, supersedes_prescription_id, same partial unique + indexes).
- `prescription_lines`: prescription_id (composite FK cascade), formulary_item_id uuid NULL (composite FK restrict), medication_text text NN (always snapshotted — later Formulary edits never change a printed Rx), dose/frequency/duration/instructions text NN default '', sequence int NN, unique `(tenant_id, prescription_id, sequence)`.
- `formulary_items`: name text NN, strength/form/default_dose_text text NN default '', status `tenant_resource_status` default active, unique `(tenant_id, name, strength, form)`.
- `note_templates`: name text NN, specialty text NULL, complaints/findings/diagnosis_text/advice/follow_up text NN default '', status `tenant_resource_status` default active, unique `(tenant_id, name)`.
- `patients.allergies`: text NN default '' (free text, ADR-0005).
- **Immutability triggers** (custom SQL migration, precedent `20260704111739_audit-events-append-only`): on consult_notes and prescriptions — signed rows may only transition status → superseded with every other column unchanged (`to_jsonb` comparison minus status/updated_at); superseded rows frozen; DELETE forbidden once signed/superseded. On prescription_lines — INSERT/UPDATE/DELETE forbidden when parent prescription is signed/superseded.
- Register all tables in `relations.ts` + `schema/index.ts` barrel.

### Shared contracts (packages/core)

- New `src/clinical/` domain: `ClinicalArtifactStatusSchema` (`preliminary|signed|superseded` + constants), `ConsultNoteVitalsSchema` (all optional: bloodPressure string, pulseBpm int, temperatureCelsius number, spo2Percent int, weightKg number, heightCm number — loose sanity ranges).
- Audit registries: `AUDIT_ACTIONS` += `sign` (print already exists); `AUDIT_RESOURCE_TYPES` += `consult_note`, `prescription`, `formulary_item`, `note_template`.
- PHI rule: clinical text (complaints, diagnosis, medication names, allergy text) never appears in audit details or logs — counts/flags only (`PHI_FIELD_BANLIST` already bans these field names).

### Audit helper (packages/api lib)

`TenantAudit` gains `sign` in the write-action union and a `print({resourceType, resourceId, details?})` method; same-tx rule unchanged (`withTenantTx`).

### API (packages/api routers)

New `consult` router (every handler in `withTenantTx`; tenant-scoped miss → NOT_FOUND; state violations → CONFLICT via optimistic guarded UPDATE, invalid ops → BAD_REQUEST). Roles: `workspace` and `printPrescription` are `[PRACTITIONER, HOSPITAL_ADMIN]`; the six write procedures (save/sign/supersede for note and prescription) are `[PRACTITIONER]` only AND enforce the practitioner-identity rule (session user linked to the Encounter's Practitioner) → FORBIDDEN otherwise:

- `workspace` (GET): `{tenantId, encounterId}` → `{canWriteClinical, encounter, patient (incl. allergies), token|null, practitioner, consultNote|null, prescription (with lines)|null}` — one audited read (resource `encounter`, details flag the workspace scope). `canWriteClinical` is server-computed (session user is the Encounter's Practitioner) so the UI hides write controls for non-owner practitioners and hospital_admin viewers instead of surfacing controls that 403; allergy editing stays available to any viewer per `patient.updateAllergies` roles.
- `saveNote` (POST): upsert the current Preliminary note (insert on first save; CONFLICT when signed — supersede instead).
- `signNote` / `signPrescription` (POST): preliminary → signed, sets signed_at/signed_by_user_id; audit action `sign`.
- `supersedeNote` / `supersedePrescription` (POST): signed → superseded + new Preliminary copy (content/lines) referencing the old id, atomically; audit update+create.
- `savePrescription` (POST): upsert Preliminary prescription + replace-all lines (≥1 line; formularyItemId validated in-tenant and active; medication_text required).
- `printPrescription` (GET): signed-only (else BAD_REQUEST); returns full print payload (prescription+lines, patient demographics + allergies, practitioner registration council/number, facility name/address/GSTIN, tenant display/legal name); audit action `print`.

`formulary` router: `search` (`[PRACTITIONER, PHARMACY_LAB, HOSPITAL_ADMIN]`, active-only, ilike, capped 20), `list`/`create`/`update` (`[HOSPITAL_ADMIN]`; update covers fields + status; duplicate → CONFLICT). `noteTemplate` router: `list` (`[PRACTITIONER, HOSPITAL_ADMIN]`; `includeInactive` requires hospital_admin), `create`/`update` (`[HOSPITAL_ADMIN]`). `patient.updateAllergies` (`[FRONT_DESK, PRACTITIONER, HOSPITAL_ADMIN]`); `allergies` added to patient output and as optional quickRegister input. Register routers in `appRouter`; `procedure-access.test.ts` pinned list grows accordingly.

### Web (apps/web)

- shadcn additions to packages/ui: `textarea card dialog badge table select` via `vp run ui add`.
- Route `(auth)/consult/$encounterId/` → `features/consult/` (slice-local `api/*.query.ts|*.mutation.ts` per house pattern; TanStack Form + zod for the note form; sonner toasts; role-gated rendering via `orpc.tenant.membership`). Header: patient name/age/sex/phone + prominent allergy banner (inline edit). Note pane: template Select (fills only empty fields), vitals row, textareas, Save / Sign (confirm dialog) / Correct-supersede. Rx pane: debounced formulary search quick-pick (prefills medication text + default dose), free-text line add, per-line dose/frequency/duration/instructions, Save / Sign / Print.
- Route `(auth)/consult/$encounterId/print` fetches `printPrescription`, renders the provisional letterhead layout, auto-triggers `window.print()` (button fallback); navbar/footer get `print:hidden`.
- Admin routes `(auth)/admin/formulary` and `(auth)/admin/note-templates` (table + create/edit dialog + status toggle), hospital_admin-gated; navbar entries via Paraglide keys.
- Front-desk wiring: start-consult navigates to the consult screen; in-consult rows get "Open consult"; registration form gains optional allergies field. Queue outputs must expose `encounterId` (add if missing).

### Seed (apps/server)

`ensureFormularyItem` + `ensureNoteTemplate` helpers; ~15 synthetic common meds and 3 launch templates (e.g. Fever/URI, Gastroenteritis, Hypertension follow-up) per tenant.

## Test Seams

Primary seam — oRPC procedures through the runtime harness (`packages/api/src/routers/__tests__/`, prior art `front-desk-runtime.test.ts`): behaviour tests for the note and prescription lifecycles, sign/print audit emission, signed-only print, practitioner-identity signing, cross-tenant denial (`expectOrpcCode(..., "FORBIDDEN")`) for every new resource, formulary/template CRUD + role denial. Secondary seam — the DB triggers, tested by raw tx mutation of signed rows (prior art: audit append-only trigger). Static seams — `procedure-access.test.ts` pinned procedure list; PHI-log static scan already in CI. UI is smoke-tested against the dev server, not automated.

## Task Plan

- [x] Slice 1: Core clinical contracts + audit registry
  - Acceptance: `@tsu-stack/core/clinical` exports status + vitals schemas/constants; audit registries include the four new resource types and `sign`; core tests cover schema edges.
  - Verify: `vp run check --fix` + `vp run test` in packages/core
  - Depends on: none
  - Interfaces: exports `CLINICAL_ARTIFACT_STATUS`, `ClinicalArtifactStatusSchema`, `ConsultNoteVitalsSchema`, `ConsultNoteVitals`; `AUDIT_ACTIONS` includes `"sign"`; `AUDIT_RESOURCE_TYPES` includes `"consult_note" | "prescription" | "formulary_item" | "note_template"`.
- [x] Slice 2: UI primitives
  - Acceptance: textarea, card, dialog, badge, table, select exist in packages/ui and typecheck.
  - Verify: `vp run check --fix` in packages/ui
  - Depends on: none
  - Interfaces: `@tsu-stack/ui/components/{textarea,card,dialog,badge,table,select}`.
- [x] Slice 3: DB schema + migrations + immutability triggers
  - Acceptance: five new tables + `patients.allergies` per Implementation Decisions; drizzle-generated migration applied to local DB; custom trigger migration blocks mutation of signed rows and line changes under signed parents; relations registered.
  - Verify: `vp run db:generate` + `vp run db:migrate` (DATABASE_URL localhost-checked) + `vp run check --fix` in packages/db
  - Depends on: Slice 1
  - Interfaces: `@tsu-stack/db/schema` exports `consultNotes`, `prescriptions`, `prescriptionLines`, `formularyItems`, `noteTemplates`, `clinicalArtifactStatus`; `patients.allergies`.
- [x] Slice 4: TenantAudit sign/print extension
  - Acceptance: `audit.write` accepts action `sign`; `audit.print(...)` emits a print event; existing audit tests still pass; new unit coverage for both.
  - Verify: `vp run test` (audit tests) in packages/api
  - Depends on: Slice 1
  - Interfaces: `TenantAudit.write({action: "create"|"update"|"delete"|"sign", ...})`; `TenantAudit.print({resourceType, resourceId?, details?})`.
- [x] Slice 5: consult router + runtime tests (riskiest)
  - Acceptance: all eight consult procedures per Implementation Decisions; lifecycle, identity, immutability (API + raw-tx trigger), signed-only print, audit emission, and cross-tenant denial proven in `doctor-loop-runtime.test.ts`.
  - Verify: `vp run test` (doctor-loop-runtime) in packages/api
  - Depends on: Slice 3, Slice 4
  - Interfaces: `appRouter.consult.{workspace,saveNote,signNote,supersedeNote,savePrescription,signPrescription,supersedePrescription,printPrescription}`; workspace patient uses `toPatientOutput`/`PatientOutputSchema` from `routers/patient/queries.ts` (do not redefine); does NOT edit `procedure-access.test.ts` (Slice 11 owns it).
- [x] Slice 6: formulary + noteTemplate routers + seed
  - Acceptance: CRUD/search/list per Implementation Decisions with duplicate CONFLICT, role denial, cross-tenant denial, audit emission tested; seed adds formulary items + templates idempotently.
  - Verify: `vp run test` (new test file) in packages/api; seed runs clean twice
  - Depends on: Slice 3, Slice 4
  - Interfaces: `appRouter.formulary.{search,list,create,update}`, `appRouter.noteTemplate.{list,create,update}`; `FormularyItemOutputSchema` (id, name, strength, form, defaultDoseText, status), `NoteTemplateOutputSchema` (id, name, specialty, five content fields, status); does NOT edit `procedure-access.test.ts`.
- [x] Slice 7: patient allergies API
  - Acceptance: `patient.updateAllergies` with roles above; `allergies` in `PatientOutputSchema` + `toPatientOutput` + optional in quickRegister input; audit carries no allergy text; runtime tests.
  - Verify: `vp run test` (patient tests) in packages/api
  - Depends on: Slice 3, Slice 4
  - Interfaces: `PatientOutputSchema.allergies: string`; `appRouter.patient.updateAllergies({tenantId, patientId, allergies})`; quickRegister input `allergies?: string`; does NOT edit `procedure-access.test.ts` or `front-desk-page.tsx` (Slice 9 owns the UI).
- [x] Slice 8: Consult screen + Rx print UI
  - Acceptance: consult route renders workspace (allergy banner, note form with template prefill, Rx composer with formulary quick-pick); sign flows with confirm dialog; print route renders letterhead payload and auto-prints; unsigned print shows the API error state; typechecks.
  - Verify: `vp run check --fix` in apps/web + dev-server render
  - Depends on: Slice 2, Slice 5, Slice 6, Slice 7
  - Interfaces: routes `/consult/$encounterId` and `/consult/$encounterId/print`; `features/consult/` slice with `api/` wrappers per api-fetching-patterns.
- [x] Slice 9: Front-desk + queue wiring
  - Acceptance: start-consult navigates to `/consult/$encounterId`; in-consult rows expose "Open consult"; queue outputs expose `encounterId`; registration form has optional allergies field wired to quickRegister.
  - Verify: `vp run check --fix` in apps/web (+ packages/api if queue output changes)
  - Depends on: Slice 8
  - Interfaces: consumes route from Slice 8 and quickRegister input from Slice 7.
- [x] Slice 10: Admin screens (formulary + note templates)
  - Acceptance: both admin routes list/create/edit/toggle-status via dialogs, hospital_admin-gated, navbar entries added (Paraglide keys, en.json only).
  - Verify: `vp run check --fix` in apps/web + dev-server render
  - Depends on: Slice 2, Slice 6
  - Interfaces: routes `/admin/formulary`, `/admin/note-templates`; navbar keys `navbar__formulary`, `navbar__note_templates`.
- [x] Slice 11: Integration — procedure registry, full suite, smoke
  - Acceptance: `procedure-access.test.ts` pinned list updated once for all new procedures; `vp run -w fix`, `vp run test:unit:run`, `vp run build` green; seeded dev-server smoke of the full loop: register → check-in → start consult → note sign → Rx sign → print (and unsigned-print refusal).
  - Verify: the four commands above + browser smoke evidence
  - Depends on: Slices 1–10
  - Interfaces: none new.

## Out of Scope

Orders/charges (Phase 3), drug-interaction/allergy engines (ADR-0005), AI drafting (Phase 6), consult-note printing, multiple live prescriptions per encounter, e2e harness scaffolding, non-English translations, TV queue display, advisor sign-off itself (external exit gate).

## Open Questions

None blocking. Advisor-dependent artifacts (Rx layout, template content, meds list) ship as provisional stand-ins and iterate with the advisor outside this run.
