# 0006: Coexistence pilot — order routing only, no inventory, dual-run with legacy

**Status:** accepted (2026-07-03)

The design-partner hospital already runs software that handles pharmacy stock and inventory, and has agreed that staff will **dual-run both systems** during the pilot. We decided our system does **order routing and status only**: doctor orders meds/tests → pharmacy/lab Work Queue screens → mark dispensed/completed → Charge lands on the Draft Bill. No inventory, no batch/expiry, no stock deduction, no analyzer integration; lab results attach as files.

## Why

- Building inventory management to parity with an incumbent, in weeks, solo, is unwinnable — and unnecessary, since the incumbent keeps doing it.
- Order routing is the piece that closes _our_ loops: the doctor loop (orders leave the consult room digitally) and the billing loop (ordered-not-billed leakage becomes measurable).
- Registration is greenfield (patients register fresh in our system); no migration is on the critical path.

## Consequences

- **Dual-entry is the pilot's biggest adoption risk.** Staff typing into two systems will resent the slower one; our screens must be faster than the incumbent's for the overlapping steps, or usage will quietly stop. Pilot metrics must track actual usage per station, not just uptime.
- The exit story from dual-run (which system wins which workflow, and when) is a explicit conversation with the hospital at pilot review — not something to leave implicit.
- Inventory becomes a post-pilot build/integrate decision driven by what the hospital asks for once they trust the system.
