# ADR-008: MVP Deployment Model — Arogya-managed isolated pilot tenants

**Status:** Proposed for acceptance before Phase 0 coding completion  
**Date:** 2026-07-03  
**Decision owners:** CTO, Platform Lead, Compliance Owner, Founders

---

## Context

The PRD positions the product as cloud-native SaaS for mid-size hospitals, but there is a legitimate founder concern that customer-managed deployment could reduce compliance burden or reassure hospitals. The current ADR-2 selects shared-schema multi-tenancy with Postgres RLS and per-tenant keys. That is operationally efficient, but early pilots will process sensitive patient data before the product has mature compliance evidence.

The team needs one deployment decision for MVP so engineering does not fragment across SaaS, hospital-managed cloud, on-prem, and dedicated cluster variants.

---

## Decision

For the first 3–5 design partners and private beta, Arogya OS will use an **Arogya-managed isolated pilot-tenant model**:

1. Arogya operates the infrastructure.
2. Data residency is India for India pilots.
3. Application services are centrally managed by Arogya.
4. Each pilot tenant receives strong logical isolation with:
   - tenant-scoped KMS key or key alias;
   - tenant_id enforced by application middleware and Postgres RLS;
   - tenant-scoped object-storage prefixes/buckets;
   - tenant-scoped audit export;
   - tenant-scoped backup/restore test path;
   - tenant-scoped offboarding export.
5. For a marquee hospital chain that contractually requires stronger isolation, offer a **dedicated-cluster tier** only after the base pilot environment is stable.
6. Customer-managed deployment is deferred until after GA unless a strategic customer pays for and co-owns the operational complexity.

---

## Alternatives considered

### A. Pure shared SaaS from day one

**Pros:** Fastest to operate, simplest release model.  
**Cons:** Higher perceived trust risk during first pilots; harder to reassure hospitals before audit evidence is mature.

### B. Customer-managed cloud or on-prem for MVP

**Pros:** May reassure some hospitals; data sits in customer account.  
**Cons:** Slows iteration, fragments environments, makes hospital IT capability a blocker, complicates support, increases deployment variability, and does not remove product security obligations.

### C. Arogya-managed isolated pilot tenants

**Pros:** Fast iteration while giving clear tenant boundaries and evidence collection.  
**Cons:** Slightly more platform work than pure shared SaaS.

---

## Consequences

### Positive

- One release train for all design partners.
- Faster debugging and product iteration.
- Clear security story for early hospitals.
- Easier WASA/audit evidence collection.
- Preserves ADR-2 economics for later scaling.

### Negative

- Requires discipline around tenant isolation, KMS, audit export, and support access from day one.
- Dedicated-cluster path still needs design for large chains.

---

## Implementation requirements

1. Every database table carrying PHI or tenant-owned data must include `tenant_id`.
2. Every request must resolve tenant before hitting business logic.
3. Every PHI table and projection must have RLS enabled.
4. Every object-storage path must include tenant boundary.
5. Every KMS operation must be attributable to tenant context.
6. Every audit event must include tenant, facility, actor, patient/resource, action, purpose, and decision.
7. No production PHI may be copied to developer laptops or non-isolated dev environments.
8. Tenant export/offboarding must be tested before first paid beta.

---

## Revisit triggers

Revisit this ADR when any of the following happens:

1. A 500+ bed chain or multi-facility group requires physical infrastructure isolation.
2. A contract requires hospital-managed cloud deployment.
3. Regulatory/audit finding requires stronger separation.
4. Tenant count exceeds operational assumptions in ADR-2.
5. Cross-tenant performance/noisy-neighbor issues become material.

---

## Acceptance criteria

- Platform team can provision a new pilot tenant repeatably.
- Tenant-specific KMS key path exists.
- RLS leakage tests pass in CI.
- Tenant-scoped audit export works.
- Tenant offboarding export produces FHIR bundle + CSV manifest.
- Staging environment proves tenant isolation with at least two synthetic tenants.

