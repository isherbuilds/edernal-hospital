# HMS MVP Launch Strategy v2 — Ship Fast Without Creating a Trust Cliff

**Project:** Arogya OS  
**Date:** July 3, 2026  
**Status:** Recommended amendment to PRD/Roadmap  
**Applies to:** First 3–5 design-partner hospitals and private beta

---

## 1. Decision Summary

The product should move quickly into real hospital workflows, but it must not handle real patient data without a minimum trust boundary.

**Recommended posture:**

> **Ship fast. Defer certification closure. Do not defer the patient-data trust boundary.**

This means:

- Do not wait for every formal certification before design-partner pilots.
- Do not wait for full ABDM M1–M3, WASA closure, NHCX live submission, global HIPAA/ONC readiness, or enterprise on-prem deployment tooling before private beta.
- Do implement tenant isolation, auth, RBAC/ABAC, audit, consent, encryption, backups, PHI-safe logging, and human sign-off before processing real PHI/audio.

## 2. Why this balances speed and responsibility

The MVP’s value comes from three loops:

1. **Front desk loop:** register patient → queue → doctor sees patient.
2. **Doctor loop:** consult → AI draft → doctor edits/signs → prescription/orders.
3. **Revenue loop:** orders → bill capture → payment/claim package → leakage detection.

Those loops need hospital reality: noisy OPDs, overloaded doctors, impatient patients, real billing exceptions, and imperfect legacy data. Waiting too long in a lab will produce the wrong product.

But the moment the product stores identifiable clinical data, the company is operating a PHI system. Core controls cannot be bolted on later without rewriting data models, logs, permissions, pipelines, and support tooling.

## 3. What can be deferred

The following are important, but not required before a controlled design-partner pilot:

| Area | Defer until | Reason |
|---|---|---|
| Full AND certification closure | GA gate | Certification can run in parallel once architecture is ready. |
| WASA final pass | Private beta / GA gate | Prep from day one, final audit later. |
| NHCX live submission | v1.1 | Payer readiness and integration variability are external. |
| Owner NL-Q&A analytics | P1 | Helpful but not needed to prove core OPD/billing value. |
| Full migration tooling for every legacy format | Beta/GA | Start with one dry-run importer and expand from real pilots. |
| Customer-managed deployment | Enterprise tier later | Slows early iteration and fragments environments. |
| IPD/pharmacy/LIS replacement | P2/P3 | Scope explosion. Integrate only. |
| Multi-region/global compliance | After India wedge | Keep architecture portable, but do not overbuild. |

## 4. What cannot be deferred

These controls are mandatory before real patient PHI/audio:

| Control | Minimum version required for pilot |
|---|---|
| Tenant isolation | Dedicated tenant boundary with tenant-scoped database/schema or equivalent RLS, tenant-scoped object storage prefix/bucket, tenant key material. |
| Authentication | OIDC login, MFA for admin/support, short-lived sessions, device/session tracking. |
| Authorization | RBAC + ABAC checks for patient, provider, billing, admin, and support boundaries. |
| Audit logging | Immutable append-only audit for PHI read/write/export/share/sign/delete. |
| Consent | Per-encounter audio consent and external-share consent model. |
| Encryption | TLS in transit; KMS-backed envelope encryption for PHI objects/audio/export bundles. |
| Backups/restore | PITR and at least one verified restore drill before pilot. |
| PHI-safe logging | Logs/traces/events must not carry patient name, phone, ABHA, diagnosis, Rx text, transcript, or free-text note. |
| AI human sign-off | All AI output remains preliminary until authenticated human finalization. |
| Vendor governance | STT/LLM/WhatsApp/payment vendors must have no-training/no-retention or controlled-retention terms before production PHI. |

## 5. Launch model

For the first 3–5 hospitals, use:

> **Arogya-managed dedicated tenants.**

This is neither pure shared SaaS nor customer-managed deployment.

### Properties

- Arogya operates the service.
- Each design partner receives an isolated tenant boundary.
- Common app code, common IaC, common release pipeline.
- Tenant-specific data, object storage, secrets, keys, audit exports, backup/export scope.
- No customer-managed cloud or on-prem deployment unless a marquee enterprise requires it later.

### Why this is preferred

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Pure shared SaaS | Fastest iteration, lowest ops | Early cross-tenant blast radius too high if controls immature | Use later when platform matures. |
| Customer-managed deployment | Sounds safer politically | Slow installs, fragmented infra, poor observability, difficult upgrades, hospital IT dependency | Avoid for MVP. |
| Arogya-managed dedicated tenant | Stronger isolation while preserving release velocity | Slightly more cloud/IaC overhead | Recommended. |

## 6. MVP private beta gate

A hospital can go live only when these checks pass:

```text
[ ] Tenant created with isolated data boundary.
[ ] OIDC auth and role mapping configured.
[ ] RBAC/ABAC policy tests pass.
[ ] Audit event is written for PHI read/write/export/share/sign.
[ ] Audio consent text approved for pilot.
[ ] Audio storage encrypted and TTL deletion job tested.
[ ] Support access requires customer-approved break-glass or support session.
[ ] Backup and restore verified for that tenant.
[ ] PHI-safe log scanner passes smoke tests.
[ ] AI outputs cannot be printed, sent, billed, claimed, or pushed externally while preliminary.
```

## 7. Founder-level trade-off

The goal is not to become a compliance bureaucracy before product-market fit. The goal is to avoid building a PHI product on foundations that will later need demolition.

Arogya can be aggressive on product discovery and careful on trust architecture at the same time.
