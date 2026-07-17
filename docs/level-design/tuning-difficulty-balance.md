# Tuning Difficulty Balance

## Target values

`first_anomalous_transmission` (`facilitySignalDefinitions.ts`):

| Control        | Target               | Tolerance | Capture range (evaluator)                              |
| -------------- | -------------------- | --------- | ------------------------------------------------------ |
| Channel        | 3                    | exact     | exact match only (multiplicative gate)                 |
| Frequency      | 117.4 MHz            | ±0.6 MHz  | falls to 0 at ±1.8 MHz (3× tolerance)                  |
| Gain           | 0.55–0.65            | —         | flat plateau; falls off over a further ±0.3 outside it |
| Filter         | 0.65                 | ±0.12     | falls to 0 at ±0.3 (2.5× tolerance)                    |
| Phase          | −18°                 | ±22°      | falls to 0 at ±44° (2× tolerance), circular            |
| Lock threshold | 0.85 overall quality | —         | —                                                      |

## Why these numbers

- **Channel is exact-or-nothing** by design — it's the puzzle's first,
  coarse decision (which of six channels), and scanning surfaces it
  directly, so there's no reason to soften it; softening it would also
  contradict the spec's explicit "channel mismatch must prevent lock
  regardless of other controls" requirement.
- **Frequency tolerance (±0.6 MHz on an 80–150 MHz range)** is tight
  enough that a coarse ±1 MHz step (the default keyboard step) still
  requires several deliberate adjustments to land inside it, but the 3×
  capture range (±1.8 MHz) means the player gets smoothly increasing
  quality feedback well before hitting the exact value — never a hard
  cliff with no signal at all until pixel-perfect.
- **Gain uses a genuinely flat 10-point-wide plateau** rather than a
  peaked target — gain is the control most naturally "played with" via
  mouse wheel, and a peaked target here would make the puzzle feel overly
  fussy on the control most easily overshot.
- **Filter tolerance (±0.12) and phase tolerance (±22°, doubled to a ±44°
  capture range via the circular distance)** are both deliberately more
  forgiving than frequency — they're "the last 20%" of tuning once
  channel+frequency are basically right, not independent puzzles of their
  own.
- **Lock threshold 0.85** (out of the evaluator's 0–1 `overallQuality`)
  requires every control to be reasonably close simultaneously — not just
  "on average" close (see `docs/architecture/signal-evaluation.md`'s
  multiplicative-vs-average breakdown) — while still being reachable well
  before hitting each target exactly, since `refinementQuality` only needs
  to average to roughly 0.85 with `frequencyQuality` also near 1.

## Verifying solvability

`signalValidation.test.ts`'s solver-style tests (via
`solverReport()`, `docs/architecture/signal-validation.md`) directly
assert, for the shipped signal:

- The exact target reaches `overallQuality ≥ 0.85` (solvable).
- The wrong channel reaches exactly 0 (channel gate is a real gate, not a
  minor penalty).
- A frequency 4× tolerance off-target falls below the lock threshold (the
  puzzle isn't solvable by "close enough" frequency alone).
- The receiver's default controls (channel 1, 80 MHz, 50%/50%/0°) do not
  accidentally solve it — solving requires deliberately tuning to channel
  3, not doing nothing.

These same target values are what `receiverController.test.ts`'s
integration tests and `tests/e2e/signal.spec.ts`'s full-puzzle test
actually tune to and confirm reach `Locked`/`Decoded` through the real
evaluator + lock/decode controllers — not asserted in isolation from the
gameplay path that has to reach them.
