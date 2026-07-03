# Arogya OS — Implementation Baseline v2

**Date:** July 3, 2026  
**Purpose:** This package consolidates the original four HMS architecture documents with the new MVP launch, compliance, deployment, and sprint amendments.

## How to read this package

The original documents are **not obsolete**. They remain the architectural baseline. The v2 documents are amendments that clarify how to ship the MVP quickly without creating an avoidable patient-data/security cliff.

## Source-of-truth hierarchy

| Priority | File | Status | Notes |
|---:|---|---|---|
| 1 | `01-originals/HMS-PRD-v1.md` | Canonical product baseline | Product thesis, users, P0/P1/P2 scope, metrics, phasing. |
| 2 | `01-originals/HMS-System-Design.md` | Canonical architecture baseline, needs amendment | FHIR store, services, AI pipeline, billing, integrations, offline, security. |
| 3 | `01-originals/HMS-ADRs.md` | Canonical ADRs 1–7 | Existing accepted/proposed architectural decisions. |
| 4 | `02-current-baseline/HMS-ADRs-v2.md` | Current ADR baseline | ADRs 1–7 plus ADR-8 deployment model. |
| 5 | `02-current-baseline/HMS-Minimum-Viable-Compliance-Spec-v1.md` | New hard gate | Minimum controls required before real patient data/audio enters the system. |
| 6 | `02-current-baseline/HMS-MVP-Launch-Strategy-v2.md` | New launch posture | Explains “ship fast, defer certification, do not defer trust boundary.” |
| 7 | `02-current-baseline/HMS-Phase0-Revised-MVP-Sprints-v2.md` | Supersedes original Phase-0 sprint section | Keeps the old roadmap direction but changes sequencing and gates. |
| 8 | `02-current-baseline/HMS-MVP-Backlog-Cutline-v1.md` | New scope-control document | Defines what is MVP-critical, what is beta/GA, and what is explicitly deferred. |
| 9 | `02-current-baseline/HMS-System-Design-v2-Amendment.md` | Design amendment | Does not replace the full System Design; patches the risky parts. |

## Practical decision

The recommended MVP strategy is:

> **Ship fast. Defer certification closure. Do not defer the patient-data trust boundary.**

That means:

- Start with 3–5 design-partner hospitals.
- Use an **Arogya-managed dedicated-tenant** deployment model for pilots.
- Do not start real patient audio/PHI capture until minimum controls are in place.
- Treat ABDM/WASA/NHCX certification as GA gates, not as reasons to block early private pilots.
- Keep AI human-in-the-loop: no autonomous prescriptions, notes, bills, claims, or external record pushes.

## What changed from v1

The v1 documents had the right product direction but under-specified the implementation controls needed for a PHI-bearing MVP. This package adds:

1. A concrete MVP launch posture.
2. A minimum viable compliance/security gate.
3. A deployment ADR for early pilots.
4. A revised Phase-0 sprint sequence.
5. A backlog cutline to protect MVP focus.
6. A System Design amendment for authz, audit, edge, encryption, outbox, and e-Rx safety.

## Merge guidance for the engineering repo

Recommended repo path:

```text
/docs/product/HMS-PRD-v1.md
/docs/architecture/HMS-System-Design.md
/docs/architecture/HMS-System-Design-v2-Amendment.md
/docs/architecture/HMS-ADRs-v2.md
/docs/compliance/HMS-Minimum-Viable-Compliance-Spec-v1.md
/docs/roadmap/HMS-MVP-Launch-Strategy-v2.md
/docs/roadmap/HMS-Phase0-Revised-MVP-Sprints-v2.md
/docs/roadmap/HMS-MVP-Backlog-Cutline-v1.md
```

## Immediate next step

Before writing production PHI code, hold a 90-minute founder + engineering + compliance review and accept/reject these four decisions:

1. ADR-8: Arogya-managed dedicated-tenant deployment for design partners.
2. Minimum viable compliance gate before real PHI/audio.
3. Revised Phase-0 sprint plan.
4. MVP backlog cutline.
