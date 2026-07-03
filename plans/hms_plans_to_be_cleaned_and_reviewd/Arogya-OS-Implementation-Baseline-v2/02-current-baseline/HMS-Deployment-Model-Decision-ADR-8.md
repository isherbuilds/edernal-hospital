# ADR-8: Early pilots use Arogya-managed dedicated tenants — **Accepted recommendation**

**Date:** July 3, 2026  
**Status:** Recommended for founder approval  
**Related:** ADR-2 multi-tenancy, ADR-4 edge sync, PRD R9, MVP Launch Strategy v2

---

## Context

The team is deciding whether the MVP should be:

1. a shared SaaS product,
2. customer-managed deployment in each hospital's infrastructure, or
3. Arogya-managed but isolated per customer/design partner.

The founder priority is to get the product into hospitals quickly and collect real workflow feedback. At the same time, the product will handle PHI, clinical notes, prescriptions, audio, invoices, claims, and ABDM/WhatsApp external sharing.

Pure customer-managed deployment appears attractive because it may feel like the hospital owns the risk. In practice, it would slow MVP learning and create fragmented environments before product-market fit.

## Decision

For the first 3–5 design partners and private beta, use:

> **Arogya-managed dedicated tenants.**

Arogya operates the environment. Each hospital has a strong tenant boundary for data, keys, object storage, audit exports, and backups. The application code, CI/CD, IaC modules, release process, observability, and support tooling remain centrally managed by Arogya.

## Required properties

Each pilot tenant must have:

- tenant-scoped database boundary: dedicated database, schema, or RLS-backed tenant boundary with automated tests;
- tenant-scoped KMS key material or key hierarchy;
- tenant-scoped object storage prefix/bucket with encryption and lifecycle rules;
- tenant-scoped audit export capability;
- tenant-scoped backup/restore drill;
- tenant-scoped feature flags;
- tenant-scoped integration credentials where possible;
- no cross-tenant analytics over PHI during pilot;
- support access mediated by approval/break-glass workflow.

## Consequences

### Positive

- Faster iteration than customer-managed/on-prem.
- Stronger early isolation than pure shared SaaS.
- Single release train and observability stack.
- Easier security patching.
- Easier support and product analytics.
- Cleaner evidence trail for future WASA/ABDM/security reviews.

### Negative

- Slightly higher cloud/IaC cost than pure shared SaaS.
- Tenant provisioning must be automated earlier.
- Backup/restore/export must be tenant-aware from day one.
- Sales must explain that this is not hospital-owned deployment, but a managed isolated service.

## Rejected alternatives

### Pure shared SaaS from day one

Rejected for first pilots because early implementation mistakes could have cross-tenant blast radius. Revisit after RLS/authz/audit controls pass sustained private-beta usage.

### Customer-managed deployment from day one

Rejected for MVP because it creates:

- hospital IT dependency;
- slow deployments;
- fragmented cloud/on-prem configurations;
- difficult upgrades;
- weak observability;
- inconsistent backup/security posture;
- support complexity before the product stabilizes.

Customer-managed deployment can become a later enterprise tier for large chains or regulated customers.

## Revisit triggers

Revisit this ADR if:

1. a marquee customer requires dedicated cloud/account or on-prem as a contract condition;
2. a regulatory/legal review requires customer-managed residency for a target market;
3. shared control-plane risk becomes unacceptable;
4. a large chain requires physical isolation for each facility/region;
5. deployment automation matures enough to make customer-managed installs low-friction.

## Implementation notes

Recommended initial environment model:

```text
control-plane/
  auth
  release orchestration
  feature flags
  observability
  tenant provisioning

tenant-<hospital-a>/
  app namespace
  database/schema or logical boundary
  object storage prefix/bucket
  KMS key
  integration secrets
  backup policy
  audit export scope

tenant-<hospital-b>/
  same module, isolated data/key boundary
```

The control plane must never require direct PHI read access for ordinary support operations.
