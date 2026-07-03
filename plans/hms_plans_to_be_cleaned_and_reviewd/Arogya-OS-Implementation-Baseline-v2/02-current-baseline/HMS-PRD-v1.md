# PRD: AI-Native Hospital Management System (working name: "Arogya OS")

**Version:** 1.0 draft · **Date:** July 2, 2026 · **Status:** For review  
**Strategy:** Dual-track — India wedge, globally-portable architecture  
**Segment:** Mid-size hospitals (50–200 beds), multi-specialty  
**V1 scope:** Wedge module — OPD + Billing + AI-native EMR. Full suite phased.

---

## 1. Problem Statement

Mid-size hospitals (50–200 beds) run on software built 15–25 years ago — or on paper. India has 40,000+ private hospitals overall; the 50–200 bed slice (thousands of facilities — exact count is an open question for GTM sizing) juggles fragmented tools: a legacy HIMS for billing, paper case sheets, WhatsApp for internal coordination, and Excel for reporting. Doctors spend 30–40% of their time on documentation instead of patients; owners cannot see real-time revenue leakage (unbilled services, insurance claim rejections, pharmacy pilferage); and none of it is ready for ABDM/NHCX compliance that the government is now actively pushing on AB-PMJAY empanelled hospitals.

Globally the picture is structurally identical: Epic and Oracle Health serve large systems at costs mid-size hospitals cannot afford, while the mid-market runs on aging Meditech installs or point solutions. The current AI wave (Abridge, Commure, ambient scribes — a segment that grew 2.4x to ~$600M revenue in 2025) is being bolted *onto* legacy EHRs rather than built *into* one. No one has shipped an AI-native system of record for the mid-size hospital. The cost of not solving this: hospitals lose 5–15% of revenue to leakage, clinicians burn out on data entry, and incumbents lock the market with 10-year contracts as digitization mandates arrive.

## 2. Product Thesis

Build the system of record AI-first, not AI-added:

1. **Ambient-first data capture.** The EMR is populated by AI (voice scribe in consultation, document OCR at admission, structured extraction from lab PDFs) — typing is the fallback, not the default.
2. **FHIR R4-native data model.** One canonical model serves ABDM (India mandates FHIR bundles), US interoperability rules, and every future geography. Compliance becomes configuration, not re-architecture.
3. **Agentic revenue integrity.** AI agents continuously reconcile orders ↔ services delivered ↔ bills raised, flag leakage, and pre-scrub insurance claims before submission.
4. **Priced and packaged for the mid-market.** Cloud-native SaaS, live in weeks not quarters, at ₹5–15L/year in India — the segment's demonstrated willingness to pay (mid-tier HIMS today runs ₹1–5L/yr; enterprise ₹10L+/yr).

## 3. Goals

| # | Goal | Target |
|---|------|--------|
| G1 | Prove clinical AI value: reduce doctor documentation time per OPD encounter | ≥50% reduction vs. baseline (measured via time-in-note) within 60 days of go-live |
| G2 | Prove financial value: reduce revenue leakage (unbilled services + claim rejections) | ≥30% reduction in first-pass claim rejection rate; ≥2% revenue recovery within 90 days |
| G3 | Land the India wedge | 25 paying hospitals live within 12 months of GA; NPS ≥ 50 among doctors |
| G4 | Compliance as moat | ABDM Milestone 1–3 (AND) certification + WASA audit passed before GA; NHCX claims integration in v1.1 |
| G5 | Global portability proven | Core data model passes FHIR R4 US Core validation; one non-India pilot (SEA/MEA) by month 18 |

## 4. Non-Goals (v1)

- **IPD/inpatient management** (ward, nursing, OT, ICU) — Phase 2. The OPD wedge must win on its own; IPD triples surface area and implementation time.
- **Pharmacy & inventory, LIS/RIS** — Phase 2/3. V1 *integrates* with existing lab/pharmacy systems via HL7/FHIR rather than replacing them; replacement is premature.
- **Telemedicine / patient video consults** — commoditized, low differentiation; integrate a partner if pulled by customers.
- **US market entry in v1** — HIPAA-ready architecture yes, ONC certification and US GTM no. That is a separate, expensive initiative; sequencing it now would starve the India wedge.
- **Small clinics (<20 beds) and large chains (500+ beds)** — different buying motion, different product. Design nothing that precludes them, build nothing specifically for them.
- **Autonomous clinical decision-making.** AI drafts, humans sign. No auto-finalized diagnoses, prescriptions, or claims. Regulatory and safety posture is human-in-the-loop everywhere.

## 5. Users & Personas

1. **Dr. Sharma — Consulting physician** (primary daily user). 60–100 OPD patients/day. Hates typing; documents in Hinglish shorthand or not at all.
2. **Priya — Front-desk/registration executive.** Registers 200+ patients/day, manages queues, collects payments. High turnover role; training time must be near zero.
3. **Rajesh — Billing & insurance executive.** Fights TPA/insurer rejections; assembles claim documents manually today.
4. **Dr. Mehta — Hospital owner/Medical Director** (economic buyer). Wants real-time revenue visibility, NABH/ABDM compliance, and doctor retention.
5. **Anil — Hospital IT admin** (part-time, often outsourced). Needs simple user management, uptime, and data export; deep IT skills cannot be assumed.
6. **Patient (Asha).** Wants shorter queues, digital records via ABHA, understandable bills, and vernacular language support.

## 6. User Stories

### Registration & OPD flow

- As a **front-desk executive**, I want to register a patient in under 60 seconds using ABHA scan, Aadhaar OCR, or phone-number lookup, so queues keep moving at 9am rush.
- As a **front-desk executive**, I want a live token/queue board per doctor with estimated wait times, so I can answer "kitna time lagega?" without guessing.
- As a **patient**, I want to book, check in, and get my prescription and bill on WhatsApp in my language, so I don't wait or lose paper.

### Clinical documentation (the AI core)

- As a **physician**, I want the system to listen to my consultation (Hindi/English/code-switched + top regional languages) and draft a structured SOAP note, prescription, and orders, so I sign in 30 seconds instead of typing for 5 minutes.
- As a **physician**, I want the AI draft to show its confidence and source snippets, so I can trust-but-verify quickly.
- As a **physician**, I want one-tap access to the patient's longitudinal history (prior visits, labs trended, meds, allergies, uploaded outside records auto-OCR'd), so I stop asking patients to repeat themselves.
- As a **physician**, I want drug-interaction and allergy alerts at prescribing time that are *rare and relevant*, so I don't develop alert fatigue.
- As a **physician**, when transcription fails (noise, no consent, network), I want fast structured templates and voice dictation as fallback, so my worst-case is no worse than today.

### Billing & revenue integrity

- As a **billing executive**, I want every order (consultation, procedure, lab referral) to auto-appear on the bill, so nothing delivered goes unbilled.
- As a **billing executive**, I want the AI to pre-scrub insurance/TPA claims against payer rules and flag missing documents before submission, so rejections drop.
- As a **billing executive**, I want cashless pre-auth requests auto-assembled from the EMR (and submitted via NHCX where the payer supports it), so pre-auth turnaround shrinks from hours to minutes.
- As a **hospital owner**, I want a daily revenue-integrity digest — unbilled items, discounts beyond policy, rejection trends, collections vs. billed — so leakage is visible within 24 hours, not at month-end.

### Compliance & admin

- As a **hospital owner**, I want ABHA linking, consent capture, and FHIR record push to ABDM handled automatically, so PM-JAY empanelment and government incentives are never at risk.
- As an **IT admin**, I want role-based access, audit logs, and one-click data export (FHIR bundles + CSV), so I pass NABH audits and never feel locked in.

### Edge cases

- As a **front-desk executive**, I want offline-tolerant registration and billing (local queue + sync), so a broken internet link doesn't stop the hospital.
- As a **physician**, I want a medico-legal-safe record: every AI-drafted note is versioned with author, editor, and sign-off timestamps.
- As a **patient without a smartphone or ABHA**, I want registration to work with just name + phone (or fully anonymous for emergencies), so no one is turned away.

## 7. Requirements

### P0 — Must-have (cannot ship without)

**R1. Patient registration & master patient index**

- ABHA create/verify/link (full lifecycle per ABDM M1); Aadhaar/DL OCR; phone lookup; duplicate detection (fuzzy name + DOB + phone).
- AC: Given a returning patient, when front desk enters phone number, then the existing record surfaces in <2s with confirmation step. New registration ≤60s median. Works with zero identifiers (emergency flow).

**R2. OPD scheduling & queue management**

- Walk-in tokens + slot appointments; per-doctor queues; WhatsApp/SMS notifications; live queue display.
- AC: Given 5 concurrent registrations, when tokens are issued, then queue order is consistent and displayed within 3s. No double-booking of a slot.

**R3. AI ambient clinical documentation**

- Consent-gated recording; speech-to-structured-note (SOAP + Rx + orders + follow-up) for English, Hindi, Hinglish at launch; ≥2 regional languages (Tamil, Telugu) by GA+2 quarters. Doctor edits and signs; nothing auto-finalizes.
- AC: Given a recorded consult, when the doctor opens the draft, then note + prescription render in <30s post-consult with field-level edit. Critical fields (drug, dose, allergy) highlighted for mandatory review. Median doctor sign-off time ≤60s. Fallback templates load in <1s when scribe unavailable.
- Negative: recording never starts without explicit per-encounter consent flag; audio deleted after configurable retention (default: post-signoff).

**R4. EMR core on FHIR R4**

- Longitudinal patient chart: encounters, conditions, meds, allergies, vitals, documents. External document upload with OCR-to-structured (lab PDFs → trended values). Terminology: SNOMED CT + LOINC + ICD-10.
- AC: Every clinical write persists as a valid FHIR R4 resource (validated in CI). Chart loads full 2-year history in <2s. All records exportable as FHIR bundles.

**R5. e-Prescription with safety checks**

- Formulary-aware Rx, drug–drug interaction and allergy checks (severity-tiered), vernacular printed/WhatsApp prescription for patients.
- AC: Given a prescription with a severe interaction, when the doctor signs, then a blocking alert requires explicit override with reason. Non-severe alerts are passive. Override audit-logged.

**R6. OPD billing, payments & GST**

- Service catalog with payer-specific tariffs; auto-capture of all ordered services onto the bill; UPI/card/cash; credit/TPA billing; GST-compliant invoices; discounts with approval workflow.
- AC: Given any order placed in the encounter, when billing opens the visit, then the item is present on the draft bill (zero silent drops — reconciliation report proves it). Bill generation <5s. Day-close cash reconciliation report matches payment gateway records.

**R7. Insurance claims assist (India: TPA/PM-JAY)**

- Claim package assembly from EMR (docs, codes, tariffs); AI pre-scrub against payer checklists; rejection-reason analytics. NHCX submission for supported payers in v1.1 (adapter architecture in v1).
- AC: Given a cashless patient, when billing initiates pre-auth, then the request package is auto-assembled with a completeness score and missing-item list.

**R8. ABDM compliance & certification**

- M1 (ABHA), M2 (health records linked & shareable via HIE-CM consent), M3 (as applicable); FHIR bundle push; WASA security audit via CERT-IN empanelled agency; AND certification before GA.
- AC: ABDM sandbox test suite passes; consent artefacts stored and honored (revocation propagates within SLA).

**R9. Platform & non-functional**

- Multi-tenant cloud SaaS; data residency in India (DPDP Act compliant); RBAC + full audit trail; 99.9% uptime target; offline-tolerant registration/billing (queue-and-sync); AES-256 at rest, TLS 1.2+ in transit; daily backups with tested restore; P95 page load <2s on 10 Mbps connections and low-end Android tablets.
- Architecture portability: no India-specific logic in the core clinical/billing engine — localization via config packs (terminology, tariffs, identifiers, consent flows) so a new geography is a pack, not a fork.

**R10. Onboarding & migration tooling**

- CSV/legacy-HIMS importers (patients, tariffs, doctors), guided setup, in-product training; target ≤4 weeks from contract to go-live.
- AC: A hospital with 50k patient records migrates with ≥99.5% record fidelity (sampled audit) within the onboarding window.

### P1 — Nice-to-have (fast follows)

- **NHCX live claims submission** for top 5 payers (v1.1 — flagged P1 only because payer readiness is external).
- **Owner analytics app**: mobile dashboard — daily revenue, OPD volumes, doctor productivity, leakage digest, natural-language Q&A over hospital data ("show me this month's rejections by payer").
- **Patient WhatsApp assistant**: booking, reports delivery, payment links, follow-up reminders, vernacular.
- **Referral & camp management** (large OPD growth channels for this segment).
- **Additional regional languages** for the scribe (Bengali, Marathi, Kannada, Malayalam).
- **Doctor mobile app** (chart review + dictation on phone).
- **Smart follow-up & no-show prediction** (fill tomorrow's schedule from waitlist).

### P2 — Future considerations (architect for, don't build)

- **IPD suite** (ADT, nursing eMAR, OT scheduling, ICU flowsheets) — Phase 3 flagship (per timeline, §10). Data model must treat "encounter" generically (OPD/IPD/ER) from day one.
- **Pharmacy + inventory, LIS, RIS/PACS integration-to-replacement path.**
- **Global compliance packs**: HIPAA/ONC (US), GDPR/EHDS (EU), regional packs for SEA/MEA. FHIR-native core + config-pack architecture is the insurance policy.
- **Multi-facility/chain management** (central MPI, consolidated reporting, hub-and-spoke referrals).
- **Population-health & payer analytics products** (de-identified, consent-based — separate legal review).
- **Marketplace/API platform** for third-party clinical AI apps on our FHIR store.

## 8. Success Metrics

**Leading (evaluate at 30/60/90 days post go-live per hospital)**

- Scribe adoption: ≥70% of OPD encounters use ambient documentation by day 30 (success) / 85% (stretch).
- Median doctor sign-off time ≤60s; documentation time per encounter down ≥50%.
- Registration median ≤60s; front-desk trained to independence in ≤1 day.
- Unbilled-service rate (orders never billed) <0.5% by day 60.
- First-pass claim rejection rate down ≥30% vs. hospital's baseline by day 90.
- Weekly active clinicians / total clinicians ≥80%.

**Lagging (quarterly)**

- Logo retention ≥95% annually; net revenue retention ≥120% (module expansion).
- Doctor NPS ≥50; owner NPS ≥40.
- Sales: 25 paying hospitals in 12 months; CAC payback <18 months.
- Verified customer ROI story: ≥2% topline recovery documented at ≥10 hospitals (fuel for case studies).
- ABDM: 100% of live hospitals pushing FHIR records; zero compliance-related escalations.

**Measurement**: in-product telemetry (time-in-note, adoption funnels), monthly billing-vs-orders reconciliation reports, payer rejection data from claims module, quarterly NPS in-app. Baselines captured during onboarding week 1.

## 9. Open Questions

**Blocking (answer before build)**

1. **Clinical AI liability & consent** — exact consent language, audio retention policy, and medico-legal review of AI-drafted notes under Indian law (IMC/NMC guidelines, DPDP). → *Legal + clinical advisor.*
2. **Scribe build vs. license** — build STT+LLM pipeline on foundation models vs. license an Indian-language medical STT layer; accuracy bar for Hinglish clinical speech must be validated with real consult audio before committing. → *Engineering/AI lead; run a 4-week bake-off.*
3. **ABDM certification path & timeline** — confirm current milestone requirements, WASA vendor, and realistic certification lead time so GA date is credible. → *Compliance lead with NHA sandbox.*

**Non-blocking (resolve during build)**

4. NHCX payer readiness: which insurers/TPAs accept NHCX claims today vs. portal-only? Determines v1.1 scope. → *Partnerships.*
5. Pricing architecture: per-bed vs. per-doctor vs. per-encounter; AI usage metering (scribe minutes) bundled or metered? → *Founders/GTM, validate in first 10 sales.*
6. Hardware baseline: do we ship/certify recommended tablets+mics for consultation rooms, or stay BYOD? Scribe accuracy depends on audio quality. → *Product + field pilots.*
7. Which two launch states/cities? (Density of 50–200 bed hospitals, TPA mix, language: NCR + Hyderabad are candidates.) → *GTM.*
8. Anchor design partners: 3–5 hospitals co-developing from month 1 — selection criteria and commercial terms. → *Founders.*

## 10. Timeline & Phasing

| Phase | Window | Scope | Exit criteria |
|---|---|---|---|
| **0 — Foundations** | M1–M3 | FHIR core, auth/RBAC, registration, scheduling; scribe bake-off with real consult audio; 3–5 design partners signed | Scribe accuracy bar met on Hinglish OPD audio; ABDM sandbox integration working |
| **1 — Private beta** | M4–M7 | Full P0 set live at design partners; ABDM M1–M2; WASA audit started | 5 hospitals live; G1 metric (≥50% doc-time reduction) hit at ≥3 sites |
| **2 — GA (India wedge)** | M8–M12 | Hardening, migration tooling, AND certification, 2-city GTM launch; v1.1 NHCX + owner analytics | 25 paying hospitals; retention and NPS targets tracking |
| **3 — Expand** | M13–M18 | IPD suite build (Phase-2 flagship); pharmacy/LIS integrations; first non-India pilot via config pack | IPD beta at 3 sites; 1 international pilot live |

**Dependencies & hard dates**: ABDM/NHCX government timelines (external, monitor monthly); WASA/AND certification lead times gate GA; scribe language expansion gates non-Hindi-belt geography.

**Scope discipline**: any P0 addition requires an equal removal or an explicit GA slip. IPD pull from design partners is the expected pressure — hold the line; it is Phase 3 for a reason.

---

## Appendix A — Competitive frame (summary)

| | Incumbent India HIMS (KareXpert, Insta, Attune, MocDoc, Birlamedisoft) | Global enterprise (Epic, Oracle Health) | AI point solutions (Abridge, Commure, Suki) | **Us** |
|---|---|---|---|---|
| AI posture | Bolted-on features | Bolt-on via partners | AI-first but not system-of-record | AI-native system of record |
| Mid-size fit | Yes, but legacy UX, weak AI | Unaffordable | Complement, not replacement | Purpose-built |
| ABDM/FHIR | Retrofit | N/A India | N/A | Native |
| Wedge risk to us | Price war, install base | None near-term | Could expand downward into EHR (Commure trajectory — watch) | — |

Positioning sentence: *"The AI-native hospital OS for India's mid-size hospitals — doctors talk, the system does the paperwork, and owners stop losing revenue they never knew they were losing."*

## Appendix B — Assumptions register

- Segment can pay ₹5–15L/yr (anchored on current ₹1–5L mid-tier / ₹10L+ enterprise HIMS pricing).
- ABDM enforcement pressure on AB-PMJAY hospitals continues to increase through 2026–27.
- Foundation-model STT quality for code-switched Indian clinical speech is reachable at the accuracy bar within 6 months (validated in Phase 0 bake-off — kill criterion if not).
- Design-partner hospitals will trade deep access for discounted pricing and roadmap influence.
