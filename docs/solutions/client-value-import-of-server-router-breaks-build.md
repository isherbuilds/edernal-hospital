---
title: Never value-import from @tsu-stack/api routers in apps/web — it drags @tsu-stack/db into the client bundle
date: 2026-07-05
category: build
tags: [tanstack-start, orpc, import-protection, vite, client-bundle, packages-core, server-only]
problem-type: "client value-import of server-only module graph"
---

## Symptom

`vp run fix` and all unit tests pass, but `vp run build` fails only at the web client pass:

```
[plugin tanstack-start-core:import-protection]
[import-protection] Import denied in client environment
  Importer: packages/db/src/index.ts
  Import: "@tanstack/react-start/server-only"
```

Earlier in the same log, `postgres` gets "externalized for browser compatibility" — the DB
driver is being bundled for the browser.

## Root cause

A single **runtime value** import from a server router file in web code:

```ts
import { type PatientOutput, PatientSexSchema } from "@tsu-stack/api/routers/patient/queries";
```

`type` imports on the same line are erased at compile time; the value (`PatientSexSchema`)
is not. Router `queries.ts` files value-import `@tsu-stack/db`, whose root entry imports
`@tanstack/react-start/server-only` and instantiates the postgres client — so one value
import pulls the entire server module graph into the client bundle. Nothing catches this
before the production build: typecheck, lint, and vitest all pass.

## Fix

Import the value from its `packages/core` owner (it already existed there) and keep the
api-router import type-only:

```ts
import { type PatientOutput } from "@tsu-stack/api/routers/patient/queries";
import { PATIENT_SEX_OPTIONS } from "@tsu-stack/core/patient";
```

General rule (already documented in `.agents/typescript.md` "Schema Placement"): any
schema/enum/constant consumed by both `apps/web` and `packages/api` lives in
`packages/core`; web derives options from the shared owner instead of reaching into
router internals.

## Guard

- `vp run build` is the only gate that catches this — run it before pushing web changes
  that touch `@tsu-stack/api` imports.
- Review check: in `apps/web`, every import from `@tsu-stack/api/routers/**` must be
  `import { type ... }` only; runtime values come from `@tsu-stack/core/*` or the
  client entry (`@tsu-stack/api/client/**`).
