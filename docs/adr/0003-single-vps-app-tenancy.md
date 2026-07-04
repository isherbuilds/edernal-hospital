# 0003: Single VPS (Coolify), single Postgres, app-enforced tenant scoping

**Status:** accepted (2026-07-03), amended (2026-07-04) — supersedes/reconciles ADR-008 and ADR-8 drafts

The two prior deployment drafts conflicted (logical isolation on shared infra vs dedicated database per pilot tenant). We decided: **one India-region VPS running the existing Coolify/docker-compose stack, one Postgres instance, shared schema with `tenant_id` / Better Auth organization ID on every tenant-owned table, and tenant isolation enforced in the server data-access layer for the pilot**. Dedicated-DB-per-tenant is offered only if a future customer contractually demands it.

Postgres RLS is deliberately **not** in the pilot critical path. It remains a future hardening option, not the Phase-0 implementation plan.

## Why

- One person operates this system. Every additional environment, database, and pipeline is a tax on the only engineer. Coolify + docker-compose already exists in the repo and is the cheapest thing that works.
- The founder has already hit deployment/debugging friction with RLS in Coolify. Repeating that during a hard-dated pilot risks the whole wedge.
- Better Auth's organization plugin gives us the right domain primitive: a Tenant is an organization, and server code can verify membership and roles before touching PHI.
- App-enforced tenancy is weaker than database-enforced RLS, so the compensating controls are mandatory: every tenant-owned table carries `tenant_id`; server procedures resolve Tenant from the authenticated session, never from client input; every read/write query scopes by `tenant_id`; unique indexes include `tenant_id` where appropriate; and cross-tenant denial tests run against two synthetic tenants through the API.
- The pilot has exactly one real tenant, so RLS is not the current risk to optimize for. Missing the implementation date or shipping unusable workflows is the bigger risk.

## Consequences

- Connectivity: if the hospital's internet drops, the system is unreachable. Accepted risk — the pilot agreement names a paper fallback procedure and outage playbook. On-site hosting and offline queues are explicitly rejected for pilot (they wreck the ops story); revisit only if outages prove material.
- No feature code may issue unscoped PHI queries. PHI access goes through server-side procedure factories/query helpers that require a Tenant context and role declaration.
- The app database role can technically query across tenants, so code review, query helpers, and cross-tenant tests are load-bearing controls until RLS or stronger isolation is adopted.
- The RLS session-GUC/policy-loop pattern remains in the schema menu as a deferred reference, not a Phase-0 checklist item.
- Per-tenant KMS keys, dedicated buckets, and the tenant control plane from the drafts are deferred (see ADR-0004 risk register). Disk-level encryption + app-level encryption for the few high-sensitivity blobs is the pilot posture.
- Backups must leave the VPS (offsite object storage) since the box is a single point of failure; a restore drill is a go-live gate.

## Revisit triggers

Hospital #2 signs; self-serve multi-tenant SaaS becomes a near-term goal; a customer contract demands physical isolation or database-enforced isolation; code review finds repeated tenant-scoping mistakes; sustained outage pain at the pilot site.
