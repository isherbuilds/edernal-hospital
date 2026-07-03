# 0001: Workflow-first OPD pilot; AI scribe deferred

**Status:** accepted (2026-07-03)

The planning docs left the first wedge open (ambient-scribe-first vs workflow-first vs both), deferring the choice to a Phase-0 bake-off. We decided **workflow-first**: the pilot ships the OPD operational loop — register → token/queue → consult record → typed prescription → orders → bill — with no AI features. The AI scribe (audio consent, STT, LLM drafting, provenance) moves to a post-pilot phase.

## Why

- The builder is a solo founder with a hard go-live date ~8–12 weeks out at a signed mid-size hospital partner. The scribe stack (consent capture, audio lifecycle, vendor terms, provenance, sign-off state machine, bake-off harness) is months of additional critical-path work and drags the heaviest trust obligations (audio PHI) into the pilot.
- The hospital's committed expectation is the OPD workflow, not AI documentation.
- Workflow-first still exercises the data model the scribe will later attach to (Encounter, Consult Note, Sign-off), so nothing is thrown away.

## Consequences

- Roughly a third of the original doc surface (ADR-013 safety engine timing, scribe sprints, audio consent/retention machinery) shifts to post-pilot phases.
- The differentiation story ("AI-native") is proven second, on top of a live operational footprint — a doctor using the system daily is the distribution channel for the scribe.
- Consult Note must still carry a Preliminary → Signed state machine from day one, so AI drafts slot in later without a data migration.
