# ADR-012: Integration Reliability and Contract Discipline

**Status:** Proposed for acceptance before external PHI integrations  
**Date:** 2026-07-03  
**Decision owners:** Platform Lead, Integration Lead, Product Lead

---

## Context

Arogya OS depends on integrations with ABDM, WhatsApp BSP, payment gateways, STT vendors, NHCX/TPA systems, and eventually lab/pharmacy systems. ADR-6 chooses a transactional outbox and event bus as the integration spine, but the system still needs explicit retry, idempotency, schema, and failure-handling rules.

---

## Decision

All external side effects will use a standardized integration reliability pattern:

1. Domain transaction writes canonical data and outbox event in the same database transaction.
2. Integration worker consumes outbox/event stream.
3. Every external request has an idempotency key.
4. Every adapter has explicit timeout, retry, backoff, circuit-breaker, and dead-letter policy.
5. Failed messages can be manually re-driven after operator review.
6. Event schemas are versioned and backward-compatible.
7. No external integration receives preliminary AI clinical artefacts unless explicitly allowed and human-signed.

---

## Standard integration envelope

```json
{
  "event_id": "ulid",
  "event_type": "encounter.signed.v1",
  "tenant_id": "tenant_ulid",
  "facility_id": "facility_ulid",
  "resource_ref": {
    "type": "Composition",
    "id": "resource_ulid",
    "version": "3"
  },
  "occurred_at": "timestamp",
  "idempotency_key": "tenant:event_type:resource:version",
  "correlation_id": "request_id",
  "payload_classification": "no_phi|minimal_phi|phi",
  "schema_version": "1.0"
}
```

Default event payloads should carry references, not raw PHI. Consumers fetch PHI only after authorization and purpose-of-use checks.

---

## Adapter requirements

Each adapter must define:

1. API contract and version.
2. Auth method and credential rotation.
3. Data classification of outbound payload.
4. Consent requirement.
5. Idempotency key strategy.
6. Retryable vs. non-retryable errors.
7. Timeout and circuit-breaker settings.
8. DLQ reason codes.
9. Manual re-drive procedure.
10. Audit events emitted.
11. Test fixtures and mock server behavior.
12. Sandbox vs. production endpoint policy.

---

## Initial adapters

### ABDM adapter

- Consent artefact must be valid at send time and retry time.
- Revocation must stop future sends and mark pending sends cancelled.
- FHIR bundle validation must run before send.
- Failure state must be visible to operator.

### WhatsApp BSP adapter

- Send links, not raw PHI text, unless explicitly approved.
- Document links must be short-lived and access controlled.
- Delivery status callback must be idempotent.
- Patient communication consent required.

### Payment gateway adapter

- Payment status callbacks idempotent.
- Ledger updates happen once.
- Day-close reconciliation detects mismatch.

### STT/LLM adapter

- Vendor data-processing terms required before real audio.
- No vendor training on PHI unless explicitly approved in contract and consent.
- Store provider/model/version and latency/cost metrics.

### NHCX/TPA adapter

- Live submission is feature-flagged.
- v1 can generate portal-assist package before live API submission.
- Payer checklist version is stored with every pre-scrub result.

---

## Failure semantics

| Failure | System behavior |
|---|---|
| External API timeout | Retry with exponential backoff and jitter. |
| 4xx validation error | Mark non-retryable; surface to operator with remediation. |
| 401/403 auth error | Pause adapter, alert operator, do not retry endlessly. |
| Consent revoked | Cancel pending sends; audit cancellation. |
| Duplicate callback | Ignore after idempotency check; audit if suspicious. |
| Partial success | Persist external reference and continue reconciliation. |
| DLQ threshold exceeded | Alert engineering + tenant operator if patient-facing. |

---

## Acceptance criteria

Before external PHI integration is enabled:

1. Outbox exists and is transactional.
2. Idempotency table exists.
3. DLQ exists.
4. Manual re-drive UI or operator script exists.
5. Adapter mocks run in CI.
6. Event schema compatibility check runs in CI.
7. Audit event emitted for every outbound PHI share.
8. Consent is checked at send and retry time.

