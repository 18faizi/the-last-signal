# Signal Domain

`src/game/signal/` is the pure-TypeScript layer for the frequency-tuning
puzzle's data model and math. No Babylon, no DOM, no canvas — exactly the
same discipline as `src/game/power/`. `src/game/receiver/` (a separate
layer — see `receiver-state-model.md`) owns the device/mode state machine
that wraps this layer for a specific piece of world hardware.

## Files

- **`SignalId.ts`** — branded string id, mirrors `PowerCircuitId.ts`.
- **`SignalChannel.ts`** — shared range constants (`MIN_CHANNEL`/
  `MAX_CHANNEL` = 1–6, `MIN_FREQUENCY_MHZ`/`MAX_FREQUENCY_MHZ` = 80–150) plus
  small math helpers (`clamp01`, `clampPhase`, `shortestAngleDelta`,
  `smoothstep01`) shared by the evaluator and controls. Kept as one file —
  none of these constants/helpers has enough independent behavior to earn
  its own module.
- **`SignalDefinition.ts`** — static, immutable per-transmission data:
  channel, target frequency/gain-range/filter/phase (+ tolerances), base
  signal strength/noise, lock threshold, lock/decode durations, transcript
  document id, discoverable/required-for-progression flags.
- **`ReceiverControls.ts`** — the one **mutable** piece of state in this
  layer: channel, frequency, gain, filter, phase — the knobs the player
  operates. Mutable deliberately (unlike everything else here), because
  it's continuously written by direct player input; `sanitizeReceiverControls`
  clamps every field to its legal range in place.
- **`ReceiverMetrics.ts`** — the immutable output of evaluating controls
  against a definition: per-control quality (0–1), effective signal
  strength/noise/SNR, overall quality, and the current limiting factor.
- **`SignalEvaluator.ts`** — the pure evaluation function. See
  `signal-evaluation.md` for the exact math and combination formula.
- **`SignalLockController.ts`** / **`DecodeController.ts`** — the two
  time-based accumulators. See `signal-evaluation.md`'s companion docs and
  `receiver-state-model.md`.
- **`SignalEvent.ts`** — the typed event union + a tiny `SignalEventBus`
  pub/sub, shared by both accumulators. See `signal-events.md`.
- **`SignalSnapshot.ts`** — immutable plain-data view for debug/tests.
- **`SignalValidation.ts`** / **`SignalError.ts`** — see
  `signal-validation.md`.

## Determinism

Nothing in this layer calls `Math.random()` or reads `Date.now()` for
gameplay math. `evaluate()` is a pure function: identical
`(SignalDefinition, ReceiverControls)` always produces an identical
`ReceiverMetrics`, verified directly by `signalEvaluator.test.ts`'s
determinism test. `SignalLockController`/`DecodeController` are
deterministic state machines driven by real delta time, clamped per tick
(see `signal-evaluation.md`).

Visual noise/animation in the UI canvas layers (`src/ui/signal/`) is
allowed to vary cosmetically but is computed entirely in the UI layer from
values this domain layer already produced — it never feeds back into
`evaluate()` or the accumulators.

## Milestone 0.8: unchanged, composed (not modified) by the antenna domain

Nothing in `src/game/signal/` changed for Milestone 0.8, including
`SignalEvaluator.ts`'s core channel/frequency/gain/filter/phase math — this
was a hard constraint. The new antenna/waveguide/source-analysis domains
(see `antenna-domain.md`) read `ReceiverMetrics.overallQuality` AS-IS,
via a separate pure composition evaluator
(`src/game/source-analysis/AnalysisQualityEvaluator.ts`), to derive a
distinct "source-analysis quality ceiling" — see `bearing-analysis.md`'s
"Two quality concepts" section for exactly how the two are kept from being
conflated. `SignalDefinition.antennaAlignmentId` (a placeholder field
added in M0.7) ended up unused by M0.8's actual implementation — antenna
prerequisites are tracked by a separate progression chain instead; see the
field's own doc comment.

Nothing in `src/game/signal/` changed for Milestone 0.9 either. The threat
layer observes the receiver only through its existing typed events: the
event director's `signal-decoded` condition uses
`ReceiverController.isDecoded()`, and `DecodeCompleted` is translated into
a `signal-activity` sound stimulus at the console's authored position by a
narrow subscription in `buildThreatEventBindings.ts`.
