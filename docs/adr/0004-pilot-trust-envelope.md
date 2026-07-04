# 0004: Trimmed pilot Trust Envelope with a written Risk Register

**Status:** accepted (2026-07-03) — supersedes MVC-01..20 as the pilot gate

The Minimum Viable Compliance spec listed ~20 controls before real PHI. For a solo founder that gate would consume the entire runway. We decided on a **trimmed Trust Envelope** that must pass before real patient data, and a **Risk Register** that records every deferred control with explicit founder risk acceptance.

## In the envelope (blocking, before real PHI)

1. OIDC/Better Auth login, unique accounts, MFA for admin roles.
2. Role-based access (front desk / practitioner / billing / pharmacy-lab / admin) with deny-by-default API middleware and automated deny tests.
3. `tenant_id` / Better Auth organization ID on every tenant-owned table; server-enforced tenant scoping via procedure context/query helpers; cross-tenant denial tests with two synthetic tenants.
4. Append-only Audit Event on every PHI read/write/search/print/export, queryable by patient/actor/date.
5. Encryption at rest (disk/volume level) + TLS everywhere; secrets out of the repo.
6. PHI-safe logging: logger wrapper that takes IDs/codes only, plus a redaction test that fails CI if known PHI field names appear in log calls.
7. Automated offsite backups + one successful restore drill with checksum verification.
8. Signed pilot agreement covering data processing, retention, support access, incident contact, and paper-fallback procedure.

## Deferred to the Risk Register (accepted, not forgotten)

- Break-glass workflow (pilot mitigation: small trusted staff, all access audited).
- Purpose-of-use policy engine and ABAC attributes beyond role+tenant+facility (mitigation: coarse roles are honest at this scale).
- Postgres RLS / database-enforced tenant isolation (mitigation: one real tenant exists at pilot; app-level scoping is mandatory and tested; revisit before hospital #2 or self-serve SaaS).
- Per-tenant KMS keys and envelope encryption (mitigation: one tenant exists; disk encryption + audited access).
- Hash-chained / Merkle-sealed audit storage (mitigation: append-only table + DB role that cannot UPDATE/DELETE audit rows).
- Support-access approval workflow and time-bound elevation UI (mitigation: the founder is support; every access still audited; documented in the pilot agreement).
- Formal incident-response tabletop, SOC tooling, WASA/AND certification tracks.

## Why

- These eight controls are the ones whose absence is **irreversible** (leaked PHI, no audit trail, lost data). Everything deferred is additive process/machinery that one person can bolt on later without rework.
- "Certification later, controls now" from the launch strategy survives — but "controls" is now an honest, buildable list.

## Consequences

- The Risk Register is reviewed at every phase gate and before onboarding hospital #2; deferred items graduate into the envelope as the team and tenant count grow.
- Any scope addition that touches new PHI classes (audio, ABDM, claims) re-opens this ADR.
