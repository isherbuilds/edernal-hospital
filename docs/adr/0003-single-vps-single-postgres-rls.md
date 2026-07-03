# 0003: Single VPS (Coolify), single Postgres, tenant_id + RLS from day one

**Status:** accepted (2026-07-03) — supersedes/reconciles ADR-008 and ADR-8 drafts

The two prior deployment drafts conflicted (logical isolation on shared infra vs dedicated database per pilot tenant). We decided: **one India-region VPS running the existing Coolify/docker-compose stack, one Postgres instance, shared schema with `tenant_id` on every tenant-owned table and Postgres RLS enabled from the first migration**. Dedicated-DB-per-tenant is offered only if a future customer contractually demands it.

## Why

- One person operates this system. Every additional environment, database, and pipeline is a tax on the only engineer. Coolify + docker-compose already exists in the repo and is the cheapest thing that works.
- RLS + `tenant_id` from day one costs little now and preserves the shared-SaaS economics later; retrofitting tenancy is the expensive path. The schema pack's `002_rls_context.sql`/`003_rls_policies.sql` pattern (session GUCs + forced tenant policies) is adopted, simplified.
- The pilot has exactly one tenant, so isolation risk is theoretical until hospital #2 — but the tests that prove cross-tenant denial run in CI from the start, against two synthetic tenants.

## Consequences

- Connectivity: if the hospital's internet drops, the system is unreachable. Accepted risk — the pilot agreement names a paper fallback procedure and outage playbook. On-site hosting and offline queues are explicitly rejected for pilot (they wreck the ops story); revisit only if outages prove material.
- Per-tenant KMS keys, dedicated buckets, and the tenant control plane from the drafts are deferred (see ADR-0004 risk register). Disk-level encryption + app-level encryption for the few high-sensitivity blobs is the pilot posture.
- Backups must leave the VPS (offsite object storage) since the box is a single point of failure; a restore drill is a go-live gate.

## Revisit triggers

Hospital #2 signs (provision second tenant on same stack — this is the test the model was built for); a customer contract demands physical isolation; sustained outage pain at the pilot site.
