# Arogya OS MVP Decision Pack

**Date:** 2026-07-02  
**Purpose:** Convert the current PRD/System Design/ADR/Roadmap set into an execution-ready MVP posture that preserves speed without creating a security/compliance debt trap.

## Recommended stance

Arogya OS should **ship the MVP fast**, but not with “compliance later.” The right posture is:

> **Certification later; trust controls now.**

That means the team should defer slow external milestones such as final AND certification, full WASA closure, full NHCX live submission, and complete global compliance packs until GA/private beta gates. But the first PHI-bearing commit must include the core trust primitives: tenant isolation, authentication, authorization, audit, consent, encryption, PHI-safe logging, backups, and human sign-off for AI outputs.

## Generated documents

1. **HMS-MVP-Launch-Strategy-v2.md**  
   Defines the founder-level strategy: what to ship, what to defer, what cannot be deferred, and how to sequence design-partner pilots.

2. **HMS-Minimum-Viable-Compliance-Spec-v1.md**  
   A concrete engineering control specification for “minimum viable compliance” before handling real patient data.

3. **HMS-Deployment-Model-Decision-ADR-8.md**  
   Adds a new ADR recommending an Arogya-managed dedicated-tenant deployment for the first design partners, with a later path to shared SaaS and enterprise dedicated deployments.

4. **HMS-Phase0-Revised-MVP-Sprints-v2.md**  
   Rewrites Phase 0 into a faster but safer sprint sequence with a pre-PHI gate, pilot-readiness gate, and reduced scope.

5. **HMS-MVP-Backlog-Cutline-v1.md**  
   Splits the product into Pilot MVP, Private Beta MVP, GA, and Deferred scope to prevent “everything is P0” execution failure.

## How to use this pack

- Treat these documents as addenda to the existing four core docs, not replacements.
- Review **HMS-Deployment-Model-Decision-ADR-8.md** first because it changes how early customers are deployed.
- Adopt **HMS-Minimum-Viable-Compliance-Spec-v1.md** as the engineering gate for real patient data.
- Replace the current Phase-0 sprint plan with **HMS-Phase0-Revised-MVP-Sprints-v2.md**.
- Use **HMS-MVP-Backlog-Cutline-v1.md** during every sprint planning session to stop scope creep.

## One-sentence decision

Arogya OS should launch as an **Arogya-managed, India-resident, dedicated-tenant pilot product** with compliance-by-design controls from day one, while deferring external certifications and broad enterprise hardening until the product loop is validated.
