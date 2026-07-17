# Frequency Tuning

Five controls, one row each in the receiver panel:

| Control   | Range       | Coarse step | Fine step (hold Shift) |
| --------- | ----------- | ----------- | ---------------------- |
| Channel   | 1–6         | ±1          | — (already discrete)   |
| Frequency | 80–150 MHz  | ±1 MHz      | ±0.1 MHz               |
| Gain      | 0–100%      | ±5%         | ±1%                    |
| Filter    | 0–100%      | ±5%         | ±1%                    |
| Phase     | −180°…+180° | ±5°         | ±1°                    |

## Input

- **Up/Down** or **W/S** — select a row.
- **Left/Right** or **A/D** — adjust the selected row (coarse).
- **Shift + Left/Right** — fine adjustment.
- **Mouse wheel** — adjust the selected row (coarse; hold Shift for fine).
- **+/− buttons** — every row is also fully mouse-operable.
- **R** — reset all five controls to their defaults. This only affects
  the tuning knobs — lock/decode progress reacts naturally as quality
  changes, it isn't force-reset.
- **Enter/Space** — toggles scan while not yet decoded; opens the
  transcript once decoded.
- **Escape** — closes the panel (or, if the transcript is open, closes
  just the transcript back to the panel).

None of this reuses the `R` key's gameplay meaning (dev respawn) — the
receiver panel holds an input lock the whole time it's open, so gameplay
movement/respawn input is already suspended; see
`docs/architecture/input-suspension.md`.

## Reading the feedback

Each row's current value is shown live. Below the controls, a single
**limiting-factor** banner names the one control most responsible for
low quality right now (e.g. "ADJUST GAIN") — never more than one issue at
once, so tuning always has a clear next step. See
`docs/architecture/signal-evaluation.md` for exactly how that's chosen.

The spectrum and waveform displays are visual aids, not separate sources
of truth — they render the same quality numbers driving lock/decode, with
some cosmetic animation layered on top that never affects the puzzle
itself.
