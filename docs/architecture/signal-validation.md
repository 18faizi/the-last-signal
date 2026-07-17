# Signal Validation

`src/game/signal/SignalValidation.ts` mirrors `PowerValidation.ts`'s
contract exactly: pure functions over plain definition data, run once at
scene-creation time in development builds, returning human-readable
problem strings (empty array = valid).

## `validateSignalDefinitions(signals, { documentIds })`

Checks, per signal:

- **Unique ids** across the whole list.
- **Channel** is an integer within `[MIN_CHANNEL, MAX_CHANNEL]` (1–6).
- **Frequency** within `[MIN_FREQUENCY_MHZ, MAX_FREQUENCY_MHZ]` (80–150).
- **Tolerances** (`frequencyToleranceMHz`, `filterTolerance`,
  `phaseToleranceDeg`) are all positive.
- **Gain range** (`targetGainMin`/`targetGainMax`) is within `[0,1]` with
  `min ≤ max`.
- **Filter target** within `[0,1]`; **phase target** within `[-180,180]`.
- **Base signal strength / noise level** within `[0,1]`.
- **`minLockQuality`** within `(0,1]`.
- **`lockAcquisitionSeconds`/`decodeSeconds`** are positive.
- **Transcript existence** — `transcriptDocumentId` must be in the
  provided `documentIds` list (the facility's registered `DocumentRegistry`
  contents).
- **Completion mathematically achievable** — evaluating the signal's own
  exact target controls (`canonicalTargetControls()`) must reach
  `overallQuality ≥ minLockQuality`. Because `canonicalTargetControls()`
  always constructs an exact hit on every target field, this holds for any
  structurally-valid definition by construction — the check exists as a
  safety net against a future evaluator change silently making some
  definition unsolvable, and `signalValidation.test.ts` exercises the
  strictest legal edge case (`minLockQuality = 1` with a zero-width gain
  plateau) to prove it doesn't spuriously reject legitimate configurations
  via floating-point rounding in the weighted refinement sum.
- **Default controls do not accidentally solve it** — evaluating
  `createDefaultReceiverControls()` (channel 1, 80 MHz, 50% gain/filter,
  0° phase) must fall _below_ `minLockQuality`. This is what actually
  guarantees the puzzle requires tuning — for the shipped
  `first_anomalous_transmission` signal (channel 3), it holds trivially
  because the default channel doesn't match, but the check is written
  generically so any future signal on channel 1 would still be validated
  properly.

## `solverReport(signal)`

A reusable solver-style helper (used by both validation-adjacent tests and
directly by `signalValidation.test.ts`) that evaluates:

- The exact target controls (`solvableAtTarget`, `targetQuality`).
- The exact target but on the wrong channel (`wrongChannelQuality` — must
  be 0).
- The exact target but with frequency offset by 4× tolerance
  (`wrongFrequencyQuality` — must be below `minLockQuality`).
- The receiver's default controls (`defaultQuality`,
  `defaultAccidentallySolves`).

This is what proves the shipped `first_anomalous_transmission` signal is
genuinely solvable via reasonable manual tuning, not trivially solved by
doing nothing, and not accidentally solvable by tuning to the wrong
channel or drastically the wrong frequency.

## `validateReceiverPowerWiring(loadCircuitId, expectedCircuitId)`

A one-line integrity check confirming the receiver's power load is wired
to the expected control-room circuit id — guards against a future refactor
accidentally moving the receiver load onto a different circuit definition
without updating the gating logic to match.

## `SignalError`

Typed error/rejection codes (`unknown-signal`, `duplicate-id`,
`invalid-definition`, `missing-transcript`) mirroring `PowerError.ts`'s
shape — thrown by `ReceiverController.registerSignal()` on a duplicate id
or a channel collision.
