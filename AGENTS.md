# tsu-stack

Opinionated full-stack TypeScript monorepo: TanStack Start + Hono + oRPC + Drizzle + Better Auth + Paraglide.js, powered by Vite Plus.

Use Vite Plus commands in this repo: `vp` for package/scripts, `vpx` for one-off CLIs.

Common commands:

- `vp run dev` - start dev servers
- `vp check --fix` - package-local format, lint fixes, and typecheck
- `vp run -w fix` - workspace fix after cross-package/root changes
- `vp run build` - build all packages

Before substantial work, run `vpx @tanstack/intent@latest list`; load a matching local skill only when it directly fits the task.

## Agent operating rules

- Prefer repo CLIs/generators for boilerplate, package tasks, codegen, and migrations. Use `vp`/`vpx` wrappers where available instead of hand-writing generated output.
- This app is pre-production: backward compatibility is not required unless explicitly requested. Favor clean current design and major refactors when they reduce future complexity.
- Do not stage, commit, stash, reset, or otherwise change git state unless explicitly asked. Leave edits as they are by default (weather they are in unstaged or staged).
- Sometimes i manually stage / unstage changes as i wish (even if they are your changes let them be)
- Treat existing staged/unstaged changes as user-owned. Edit only files needed for the task, preserve unrelated changes, and keep modifications surgical.
- Do not manually edit SQL or generated migration files unless discussed first. Change schema/source files and use the documented CLI flow to generate/apply migrations.

## Clean architecture rules

- Use `CONTEXT.md` glossary terms for domain names; do not invent synonyms for core concepts like Tenant, Facility, Patient, Encounter, Token, Queue, Invoice, or Audit Event.
- Keep one source of truth. Shared enums, schemas, statuses, defaults, and transport shapes belong in `packages/core` when used across packages.
- Do not create global/shared abstractions until reuse is real. Keep code in the owning package or slice first.
- Prefer replacing weak early code over layering compatibility wrappers around it. This app is pre-production.
- Keep route files thin: routing, guards, preload, SEO, and page wiring only.
- Keep PHI server-side. Do not put Patient identifiers, clinical text, or payment details in logs, localStorage, IndexedDB, analytics payloads, or broad client caches.
- For irreversible or surprising architecture choices, update docs or write an ADR before/with the change.
- Prefer deleting dead starter/demo code when real HMS code replaces it.

Use the smallest relevant doc set below. Open the most specific file first, then follow links from that file only when the task crosses into another concern.

## Cross-Cutting

- [Workflow](.agents/workflow.md): fix cadence, validation scope, build checks, migrations, commits.
- [Vite+ toolchain](.agents/vite-plus.md): `vp`/`vpx`, workspace scripts, package management.
- [Testing](.agents/testing.md): focused unit/e2e coverage and test command scope.
- [Choice flows](.agents/choice-flows.md): native approvals, structured input, human decision points.
- [Logging](.agents/logging.md): durable logs, request logging, redaction, client/server logging.

## Task Entry Points

- UI work: [UI guidelines](.agents/ui.md). Add [TanStack patterns](.agents/tanstack-patterns.md) for routes/loaders/page composition, and [Zustand state management](.agents/zustand.md) for shared client-owned state.
- Shared client state: [Zustand state management](.agents/zustand.md).
- Bugfix: start with the owning domain doc, then [Workflow](.agents/workflow.md). Add [Testing](.agents/testing.md) for regression coverage and [Core package patterns](.agents/core.md) when shared contracts change.
- Uploads or object storage: [Media storage and uploads](.agents/media-storage.md), plus [Core](.agents/core.md), [oRPC](.agents/orpc.md), and [Environment variables](.agents/environment-variables.md) as needed.
- End-to-end feature: [End-to-end feature workflow](.agents/end-to-end-features.md), then the domain docs it links.

## Domain Docs

- [TanStack patterns](.agents/tanstack-patterns.md): route structure, `beforeLoad`, layouts, route-level preloading, TanStack docs lookup.
- [API fetching patterns](.agents/api-fetching-patterns.md): slice-local TanStack Query and oRPC client wrappers in `apps/web`.
- [oRPC patterns](.agents/orpc.md): server procedures, router shape, typed errors, request-scoped handler logging.
- [Auth patterns](.agents/auth.md): Better Auth architecture, auth query behavior, protected/guest route rules.
- [i18n guidelines](.agents/i18n.md): copy keys, locale file policy, Paraglide codegen.
- [SEO patterns](.agents/seo.md): route `head()` usage and `@tsu-stack/seo`.
- [Core package patterns](.agents/core.md): shared domain contracts in `packages/core`.
- [TypeScript conventions](.agents/typescript.md): schema placement, import boundaries, `lib/` vs `utils/`.
- [Environment variables](.agents/environment-variables.md): env scoping, validation, Docker propagation.
