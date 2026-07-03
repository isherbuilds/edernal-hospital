# 0005: Defer ABDM entirely; typed prescriptions with paper-equivalent safety

**Status:** accepted (2026-07-03) — re-times ADR-013; ABDM out of pilot

Two clinical-scope decisions taken together because they share one principle: **the pilot digitizes what the hospital does today on paper, without adding new clinical or integration obligations.**

**ABDM/ABHA:** zero integration at pilot. The Patient model keeps an identifier slot (system + value) so ABHA can be recorded later, and consent gets a table when sharing starts — but no sandbox work, no M1 flows, no FHIR bundles on the critical path.

**Prescriptions:** the Practitioner composes from the hospital Formulary (or free text), signs, and prints. **No drug-interaction engine, no allergy-matching rules at go-live.** The chart displays a prominent free-text allergy field. This is paper-equivalent safety: the doctor carries exactly the responsibility they carry today with a prescription pad.

## Why

- ABDM has no pilot consumer (the hospital didn't ask; record sharing needs counterparties) and drags in FHIR, consent artefacts, and certification testing — the definition of post-validation work.
- ADR-013's severe-interaction blocking gate was written for *e-Rx* (digitally transmitted prescriptions). A printed prescription reviewed and signed by the doctor introduces no new risk over the status quo. Building a credible interaction engine (licensed rule source, formulary mapping, clinical review, override audit) is a real project — doing it badly is worse than not doing it, because it creates false confidence.
- The clinical advisor reviews the *printed Rx layout and sign-off flow* for the pilot instead — that's the real safety surface at this stage.

## Consequences

- The "e-Rx safety v1" gate (severe DDI/allergy blocking with override reasons) moves to the phase where prescriptions become digital deliverables (WhatsApp delivery / pharmacy transmission) or hospital #2 demands it.
- Signed Prescriptions are immutable from day one (supersede-to-correct), so the later safety engine attaches to an already-correct state machine.
- Formulary stays hospital-local and unversioned-simple at pilot; a versioned drug dictionary arrives with the safety engine.
