# Schema Pack Manifest

Generated: 2026-07-03

## Counts

- Drizzle/Postgres tables: 125
- PostgreSQL enums: 30
- Schema modules: 14 plus relations/index
- Manual SQL bootstrap files: 3

## Major coverage areas

- Better Auth core + plugin schema snapshot
- Tenant/facility/practitioner/RBAC/ABAC/break-glass/support-access IAM
- FHIR R4 canonical JSONB resource versions and current-resource index
- Patient/encounter/document/consent projections
- Config packs for identifiers, terminology, drugs, payer catalogs, GST/tax, language and documents
- Appointment/queue/clinical task/prescription/e-Rx safety state
- Billing, invoice lines, payments, refunds, GST ledger, claims, day close and revenue leakage
- AI scribe sessions, audio chunks, transcripts, generations, reviews, sign-off guards, OCR and evaluation
- Immutable audit, FHIR provenance, incidents, tenant exports and PHI-safe log redaction rules
- ABDM, WhatsApp, HL7v2, webhooks and generic integration messages
- Edge/offline device queues, bill-number reservation and idempotency
- Transactional outbox, inbox de-duplication and background jobs
- Migration dry-run/import/fidelity/onboarding tables
- PHI-safe analytics events and metric snapshots
