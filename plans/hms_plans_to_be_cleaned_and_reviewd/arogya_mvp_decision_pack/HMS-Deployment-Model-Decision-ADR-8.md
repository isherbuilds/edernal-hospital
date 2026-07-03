# ADR-8: MVP Deployment Model — Arogya-Managed Dedicated Tenant First

**Status:** Proposed  
**Date:** 2026-07-02  
**Related docs:** ADR-2, ADR-4, HMS-System-Design.md, HMS-Roadmap-and-Phase0-Sprints.md

---

## 1. Context

The current architecture accepts shared-schema SaaS with row-level security and per-tenant keys. That is a reasonable long-term model for 25–200 hospitals because the write volume is small and the team should avoid unnecessary distributed-systems complexity.

The founder concern is valid: we want to get the MVP into hospitals quickly and may not want to carry the entire compliance burden before product validation. One proposed alternative is to deploy the system inside each hospital's own cloud/services account.

However, customer-managed deployment for the first MVP is likely to slow feedback, increase support friction, and create inconsistent security postures. Many target hospitals will not have sophisticated cloud operations. If every pilot has a different environment, upgrades, debugging, migrations, logging, and incident response become harder just when the team needs fast iteration.

The deployment model must balance four goals:

1. Fast iteration and centralized product learning.
2. Strong isolation for early real patient data.
3. Credible story for hospital buyers and auditors.
4. Path to both long-tail SaaS and enterprise dedicated deployments later.

---

## 2. Options evaluated

| Option | Description | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Shared SaaS, shared schema | One Arogya-managed application/fleet; one Postgres cluster; tenant isolation via RLS and per-tenant keys. | Best unit economics; simplest long-term SaaS operations; aligns with ADR-2. | Early blast radius if RLS/app bug; harder buyer trust for first PHI pilots. | Good later; not ideal first pilot default. |
| B. Arogya-managed dedicated tenant | Arogya runs infrastructure; each pilot has dedicated DB/schema or equivalent, dedicated KMS key, isolated object prefix/bucket, same app and CI/CD. | Stronger isolation; keeps Arogya in control; fast upgrades; easier support; good buyer story. | More ops than pure shared schema; needs migration automation. | **Recommended for first 3–5 design partners and private beta.** |
| C. Customer cloud, Arogya-managed | Arogya deploys into the hospital's cloud account/VPC using Arogya IaC and support access. | Strong enterprise trust; data stays in customer account; useful for large chains. | Slower procurement; network/support complexity; hard to standardize; not fit for most mid-market pilots. | Enterprise option after v1.1, not MVP default. |
| D. Hospital-managed/on-prem | Hospital IT runs the system. | Appears to minimize Arogya infra responsibility. | Highest fragmentation; poor support; security varies by hospital; slow updates; hard incident response; bad for AI pipeline. | Avoid for MVP. Only consider as exceptional enterprise sale. |

---

## 3. Decision

For Phase 0 and the first 3–5 design partners, Arogya OS will use:

> **Option B — Arogya-managed dedicated tenant.**

Minimum deployment boundary per hospital:

- Dedicated tenant record and tenant key.
- Dedicated database, schema, or isolated logical DB namespace. For the first pilots, prefer dedicated database per tenant within a managed Postgres cluster or dedicated cluster if cost permits.
- Dedicated object-storage bucket or prefix with tenant-specific KMS key.
- Dedicated audit stream/export boundary.
- Tenant-scoped event topics or strongly tenant-partitioned topics.
- Same application images, migrations, policy tests, release process, and observability across all tenants.
- India region only for India pilots.

The long-term architecture should continue supporting shared-schema SaaS, but it should not be the first real-PHI pilot profile unless the minimum viable compliance gate is already strong.

---

## 4. Consequences

### Positive

- Reduces blast radius during the riskiest learning phase.
- Gives hospitals a stronger trust story without asking them to operate cloud software.
- Preserves fast iteration because Arogya controls deployments.
- Keeps future dedicated-cluster enterprise tier natural.
- Allows a gradual move to shared SaaS when controls and operational maturity are proven.

### Negative

- Requires better migration automation from day one.
- Slightly higher infra cost per pilot.
- More environments to observe and patch.
- Some schema/RLS bugs may be masked by dedicated isolation; CI must still test RLS and tenant policy as if shared SaaS is active.

---

## 5. Deployment profiles

| Profile | Target customer | Infra owner | Isolation | When offered |
|---|---|---|---|---|
| Pilot Dedicated Tenant | 3–5 design partners | Arogya | Dedicated DB/schema + key + object boundary | Phase 0 / Private Beta |
| Standard SaaS | Long-tail mid-size hospitals | Arogya | Shared schema + RLS + per-tenant keys | After authz/RLS/audit suite matures |
| Dedicated Cluster | 500-bed chain or contractually sensitive buyer | Arogya | Dedicated cluster/VPC/account | GA+ or major enterprise deal |
| Customer Cloud Managed | Large chain with strong IT/security team | Customer account, Arogya operated | Customer account/VPC | v1.1+ only after IaC hardening |
| On-prem/Hospital Managed | Rare regulated/remote scenario | Customer | Full local responsibility | Avoid unless strategic exception |

---

## 6. Technical requirements for Option B

### 6.1 Infrastructure

- One IaC module parameterized by `tenant_id` and `deployment_profile`.
- Tenant-specific KMS key or key alias.
- Per-tenant database/schema migration job.
- Per-tenant object-store lifecycle rules.
- Per-tenant backup/restore scope.
- Per-tenant audit export.
- Central observability with PHI-safe tenant labels.
- Central feature flag control with tenant targeting.

### 6.2 Data plane

Every data-bearing entity still includes `tenant_id`, even if a tenant has a dedicated database. This preserves future migration to shared SaaS and prevents accidental cross-tenant code assumptions.

Required tables/objects/events must include tenant boundary:

- FHIR resources and resource versions.
- Relational projections.
- Billing ledger and GST ledger.
- Audit events.
- Outbox events.
- Object-store metadata.
- Export jobs.
- Edge sync queue.
- Support sessions.

### 6.3 Control plane

Arogya must have a control plane for:

- Tenant creation.
- Key provisioning.
- Database/schema provisioning.
- Migration status.
- Backup status.
- Restore drill status.
- Feature flags.
- Support access approval.
- Incident freeze/lockdown.

---

## 7. Customer-managed deployment policy

Do not offer customer-managed deployment in Phase 0. It should require:

- IaC hardened and documented.
- Automated preflight checks.
- Customer network/security prerequisites.
- Remote support/access model.
- Upgrade rollback process.
- Observability bridge without PHI leakage.
- Contractual split of security responsibilities.
- Minimum customer IT capability checklist.

Customer-managed deployment does not eliminate Arogya's product/security responsibility. It changes the shared responsibility model and often increases operational risk.

---

## 8. Migration path

1. **Phase 0:** dedicated tenant for each design partner.
2. **Private Beta:** continue dedicated tenant unless ops burden is high; begin testing shared-SaaS profile with synthetic tenants.
3. **GA:** offer standard shared SaaS for smaller hospitals if RLS/authz/audit tests are mature and external auditors/customer contracts accept it.
4. **Enterprise:** offer dedicated cluster or customer-cloud managed profile only for strategic deals.

---

## 9. ADR-2 impact

ADR-2 should be amended rather than discarded:

- ADR-2 remains the long-term standard SaaS architecture.
- ADR-8 adds a safer early deployment profile.
- RLS/per-tenant keys remain mandatory even in dedicated tenant mode as defense in depth and future portability.
- The dedicated-cluster trigger still applies for large chains, but early design partners can receive a lighter dedicated-tenant boundary without becoming bespoke deployments.
