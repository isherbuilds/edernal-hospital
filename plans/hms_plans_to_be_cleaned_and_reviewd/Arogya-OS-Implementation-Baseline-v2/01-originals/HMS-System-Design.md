# System Design: Arogya OS v1 (OPD + Billing + AI-native EMR)

**Companion to:** HMS-PRD-v1.md · **Date:** July 2, 2026 · **Status:** Draft for review

---

## 1. Requirements Summary

**Functional (from PRD P0):** registration/MPI with ABHA, OPD scheduling/queues, ambient AI documentation, FHIR R4 EMR, e-Rx with safety checks, billing/payments/GST, claims assist, ABDM compliance, migration tooling.

**Non-functional:**

| Dimension | Target |
|---|---|
| Scale (per hospital) | 200–1,000 OPD visits/day, ≤300 concurrent users |
| Scale (fleet, month 12) | 25 hospitals ≈ 15k visits/day, ~5k scribe hours/month |
| Latency | P95 page load <2s on 10 Mbps / low-end Android tablets; scribe draft <30s post-consult |
| Availability | 99.9% (≈43 min/month); registration + billing must survive WAN outage |
| Data residency | India (DPDP); architecture must not preclude other residencies |
| Security | AES-256 at rest, TLS 1.2+, full audit trail, WASA-passable |
| Team assumption | ~12 engineers in 3 pods (Clinical AI, Core EMR/Billing, Platform) — adjust if different |

**Constraints:** ABDM certification gates GA; FHIR R4 canonical model is a product commitment, not just a compliance detail; India-specific logic must live in config packs.

## 2. High-Level Architecture

```text
                        ┌────────────────────────────────────────────────┐
                        │                 Clients                        │
                        │  Web app (front desk, billing, admin)          │
                        │  Doctor tablet app (PWA, consult room)         │
                        │  Patient: WhatsApp (BSP API), no app in v1     │
                        └───────────────┬────────────────────────────────┘
                                        │ HTTPS / WebSocket
                        ┌───────────────▼────────────────┐
                        │        API Gateway / BFF       │  authn (OIDC), rate limits,
                        │                                │  tenant resolution
                        └──┬──────────┬─────────┬────────┘
                           │          │         │
              ┌────────────▼──┐  ┌────▼─────┐  ┌▼──────────────┐
              │  Core Clinical│  │ Revenue  │  │ Scheduling &  │
              │  Service      │  │ Service  │  │ Queue Service │
              │ (EMR, e-Rx,   │  │ (billing,│  │ (tokens, slots│
              │  encounters)  │  │  claims) │  │  notifications)│
              └──────┬────────┘  └────┬─────┘  └───────┬───────┘
                     │                │                │
      ┌──────────────▼────────────────▼────────────────▼─────────────┐
      │              FHIR R4 Store (canonical system of record)      │
      │   Postgres (JSONB resources + relational projections)        │
      │   + event outbox → Kafka-compatible bus                      │
      └──────┬───────────────────────────────────────────────┬───────┘
             │ events                                        │
   ┌─────────▼──────────┐                          ┌──────────▼─────────┐
   │  AI Services       │                          │  Integration Layer │
   │  - Scribe pipeline │                          │  - ABDM adapter    │
   │    (STT→LLM→FHIR)  │                          │    (M1/M2/M3, HIE-CM)
   │  - Doc OCR/extract │                          │  - NHCX/TPA adapter│
   │  - Revenue-integrity│                         │  - Payments (UPI)  │
   │    agents (recon,  │                          │  - WhatsApp BSP    │
   │    claim pre-scrub)│                          │  - Lab/pharmacy HL7│
   └────────────────────┘                          └────────────────────┘

   Cross-cutting: Identity & RBAC · Audit log service · Config-pack
   service (terminology, tariffs, consent flows) · Telemetry
   Edge: per-hospital sync gateway for offline registration/billing
```

**Style:** modular monolith deployed as 3–4 services, not microservices. At 12 engineers and <100 tenants, a service per pod boundary keeps deploy independence where it matters (AI pipeline scales differently than CRUD) without distributed-system tax everywhere.

## 3. Data Flow — the two critical paths

### 3a. Ambient scribe (consult → signed note)

1. Doctor taps "start consult" → consent flag checked → tablet records; audio chunks stream (Opus, 16 kHz) over WebSocket to scribe ingest.
2. STT stage: streaming transcription with code-switch support (vendor or self-hosted — ADR-3 bake-off). Diarization tags doctor/patient.
3. LLM stage: transcript + patient context (problem list, meds, allergies pulled as FHIR) → structured draft: SOAP note, Rx candidates, orders, follow-up. Output is constrained JSON validated against our clinical schema; drug names resolved against formulary with confidence scores.
4. Draft persisted as `Composition` (status: preliminary) + provisional `MedicationRequest`/`ServiceRequest` resources; pushed to doctor tablet in <30s.
5. Doctor edits/signs → resources flip to final, versioned; audio enters deletion queue per retention policy; sign-off event emitted.
6. Sign-off event fans out: billing capture (orders → chargeable items), ABDM push (FHIR bundle via consent), WhatsApp Rx to patient.

**Failure modes:** STT unavailable → template + dictation fallback (local); LLM draft below confidence threshold → flagged "low confidence" not silently degraded; consent absent → recording UI physically disabled.

### 3b. Revenue integrity (order → cash)

1. Every `ServiceRequest`/`Encounter` event lands on the bus.
2. Revenue service maintains a projection: orders ↔ bill lines. A reconciliation agent runs continuously; any order >30 min old with no bill line → leakage queue.
3. Claims path: encounter close triggers claim assembly (docs, ICD-10, tariff lookup from payer config pack) → AI pre-scrub scores completeness against payer checklist → billing exec reviews → submit (NHCX adapter or portal-assist in v1).
4. Day-close job reconciles gateway settlements vs. cash ledger; owner digest generated nightly.

## 4. Data Model

**Canonical:** FHIR R4 resources in Postgres JSONB, one row per resource version (append-only), with relational projection tables for hot queries (patient search, queue board, bill lines). CI validates every write against FHIR profiles (base R4 + ABDM profiles + our extensions).

Key resources: `Patient` (MPI, ABHA as identifier), `Encounter` (generic — OPD today, IPD later per PRD P2), `Composition` (notes), `MedicationRequest`, `ServiceRequest`, `Observation`, `Condition`, `AllergyIntolerance`, `Coverage`/`Claim`/`ClaimResponse`, `Consent`, `Invoice` (+ a non-FHIR GST ledger table — Indian tax accounting doesn't map cleanly to FHIR `Invoice`; keep a first-class billing ledger with FHIR references).

**Terminology:** SNOMED CT + LOINC + ICD-10 served by a terminology service (config-pack loaded). Drug dictionary: Indian formulary (brand↔generic mapping) as a pack.

**Multi-tenancy:** single Postgres cluster, tenant_id on every row + Postgres RLS as defense-in-depth; per-tenant encryption keys. (ADR-2 covers why not DB-per-tenant.)

## 5. API Design

- **External/partner API:** FHIR R4 REST (`GET /fhir/Patient/{id}`, `POST /fhir/Bundle`) — same API ABDM consumes; dogfooding guarantees export honesty and enables the P2 marketplace.
- **Internal/BFF API:** pragmatic JSON-RPC-ish REST per screen (`POST /api/v1/registration/quick-register`, `GET /api/v1/queue/{doctorId}`) — FHIR is verbose for UI hot paths.
- **Streaming:** WebSocket for audio ingest + queue-board live updates.
- **Events:** CloudEvents on the bus; every domain event (encounter.signed, bill.finalized, claim.rejected) versioned and documented — AI agents and future modules subscribe rather than poll.

## 6. Offline Tolerance (registration + billing only)

Per-hospital lightweight edge gateway (a Docker box or even browser-local): registration and billing screens work against a local queue with locally-generated ULIDs; sync service replays to cloud on reconnect with conflict rules (duplicate patient → merge queue; bill number gaps → reserved local series per terminal). Scribe and ABDM push are explicitly online-only — degraded, not broken, during outage. Clinical chart reads serve from a read-through cache (last 50 patients per doctor).

## 7. Scale & Reliability

- **Load reality check:** 15k visits/day fleet-wide ≈ <5 writes/sec sustained. This is small. Postgres + one region + read replicas is comfortably sufficient through 200+ hospitals. Do not over-build.
- **The real scaling problem is the scribe pipeline:** ~5k audio-hours/month at month 12, bursty (9am–1pm OPD peak). GPU/API capacity autoscales on queue depth; drafts are async so bursts degrade latency (30s→90s) not availability. Budget alarm on per-consult AI cost (target <₹8/consult blended).
- **Availability:** multi-AZ Postgres with automated failover; stateless services behind LB; the edge gateway covers the most common failure (hospital WAN), which matters more to users than our cloud uptime.
- **Backups/DR:** PITR + nightly logical backups, quarterly restore drills (PRD R9), RPO ≤5 min, RTO ≤1 hr.
- **Observability:** OpenTelemetry traces; product SLIs are first-class: scribe draft latency, sign-off time, unbilled-order age, ABDM push success rate — these are the PRD's success metrics, instrumented from day one.

## 8. Security & Compliance Posture

OIDC + RBAC (roles map to personas); every read of clinical data audit-logged (who/what/when/from-where) — WASA and NABH both demand this; secrets in KMS; per-tenant keys; consent engine enforces ABDM consent artefacts on every external share; audio encrypted at rest with scheduled deletion job + deletion proof in audit log. PII redaction in logs/telemetry by default.

## 9. Trade-offs & Alternatives Considered (brainstorm digest)

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Service granularity | Modular monolith, 3–4 services | Microservices | 12 engineers; distributed tax > benefit at this scale |
| System of record | FHIR-native from day 1 | Relational core + FHIR export layer | Export layers rot; ABDM + global packs need native FHIR; accept the JSONB query awkwardness, mitigate with projections |
| FHIR store | Postgres JSONB + projections | Managed FHIR (Google/Azure), HAPI FHIR server | Residency + cost control + we need custom billing adjacency; HAPI considered viable fallback (ADR-1) |
| Scribe STT | Bake-off: 2 vendors vs 1 self-hosted (Whisper-family fine-tune) | Committing to either now | Hinglish clinical accuracy is THE product risk; PRD kill criterion applies |
| Tenancy | Shared DB + RLS + per-tenant keys | DB-per-tenant | 25→200 tenants ops burden; RLS + keys satisfies audit; revisit for marquee chains (P2) |
| Offline | Edge sync for reg+billing only | Full offline-first EMR | Offline clinical writes create merge nightmares with AI pipeline; scope to the two flows that must not stop |
| Patient channel | WhatsApp BSP | Patient app | Zero-install reach in India; app is P2 |
| Queue/bus | Managed Kafka-compatible | Postgres LISTEN/NOTIFY only | Event fan-out is core to AI agents + integrations; start managed, small |

**Open design tensions to revisit as we grow:** (1) if a marquee 500-bed chain lands early, tenancy isolation moves up; (2) if NHCX adoption stalls, claims module needs deeper RPA/portal-assist investment than designed; (3) IPD (Phase 3) will stress the queue/eventing model with 24/7 workflows — the generic `Encounter` design is the insurance, validate it in Phase 0 schema review.

## 10. What I'd Revisit Later

- Region-per-geography deployment topology when the first non-India pilot lands (config-pack + data-residency test).
- Search: Postgres FTS is fine now; dedicated search (patient lookup across 1M+ records) around hospital #50.
- Cost per consult of the AI pipeline — re-bid vendors quarterly; consider self-hosting STT once volume justifies GPU commitment.
- Read model for owner analytics: nightly batch now, streaming lakehouse when NL-Q&A (P1) ships.
