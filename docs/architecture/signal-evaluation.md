# Signal Evaluation

`SignalEvaluator.evaluate(signal, controls)` (`src/game/signal/SignalEvaluator.ts`)
is the single source of quality truth. Everything downstream — lock,
decode, the UI's limiting-factor banner, the spectrum/waveform visuals —
reads its output; nothing recomputes quality independently.

## Per-control quality curves

- **Frequency** (`frequencyQuality`) — a smoothstep falloff: quality 1
  within a small plateau around the exact target (20% of the capture
  range), easing down to 0 at 3× `frequencyToleranceMHz`. Documented as a
  Gaussian-like curve in the spec; implemented with `smoothstep01` for a
  cheap, easily-testable monotonic shape rather than a literal Gaussian —
  the two are visually indistinguishable at this scale and smoothstep is
  trivial to reason about at its boundaries.
- **Gain** (`gainQuality`) — a **flat plateau** across
  `[targetGainMin, targetGainMax]` (quality 1 anywhere in range — this one
  deliberately isn't peaked, per the spec's "broad acceptable range"),
  falling off over a fixed 0.3-wide margin outside it in either direction.
  Too low reads as a weak signal; too high reads as amplified noise; both
  are penalized identically by this curve (the _amplifiedNoise_ metric,
  described below, is what actually models the "too loud" story — the
  quality curve itself is symmetric).
- **Filter** (`filterQuality`) — the same smoothstep falloff shape as
  frequency, around `targetFilter` with capture range 2.5×
  `filterTolerance`.
- **Phase** (`phaseQuality`) — smoothstep falloff around `targetPhaseDeg`,
  but the error is computed via `shortestAngleDelta()`, which treats
  −180°/+180° as identical (circular distance, not linear difference).
  Capture range is 2× `phaseToleranceDeg` — deliberately broader than
  frequency/filter, per the spec's "broad tolerance" for phase.

## Overall quality — NOT a simple average

```
channelGate      = 1 if tuned channel === signal.channel, else 0
refinementQuality = clamp01(gainQuality × 0.34 + filterQuality × 0.33 + phaseQuality × 0.33)
overallQuality    = clamp01(channelGate × frequencyQuality × refinementQuality)
```

Channel and frequency **gate multiplicatively** — a wrong channel or a
grossly wrong frequency forces `overallQuality` to 0 regardless of how
perfect gain/filter/phase are, because there's no carrier there at all to
refine. Gain/filter/phase, once a carrier is roughly present, combine as a
weighted **average** — they're genuine refinements, and no single one of
them should be able to single-handedly sink or save the signal the way
channel/frequency can. This asymmetry is the spec's explicit
"not a simple average" requirement, made concrete.

`signalEvaluator.test.ts` proves both halves: a wrong channel or a
far-off frequency floors `overallQuality` at 0 even with the other three
controls exact; and the weighted refinement average is exercised directly
via the gain/filter/phase quality-curve tests.

## Limiting factor

`identifyLimitingFactor()`:

1. Wrong channel → `'channel'`.
2. `frequencyQuality < 0.5` → `'frequency'`.
3. Otherwise, the worst of gain/filter/phase quality, but only if it's
   below 0.8 — otherwise `'none'` (everything's close enough that no
   single control dominates).

This surfaces exactly one issue to the player at a time, per the spec's
explicit "prioritize one issue, not five simultaneous errors."

## Effective signal strength / noise / SNR

`effectiveSignalStrength`, `amplifiedNoise` and `signalToNoiseQuality` are
computed for the spectrum/waveform visuals and the F3/F11 debug overlays —
they are **not** inputs to `overallQuality`
(`signalEvaluator.test.ts`'s "does not feed noise/SNR back into
overallQuality" test proves this directly: two controls with identical
gain/filter/phase quality but different raw gain values produce identical
`overallQuality` despite different `amplifiedNoise`).

## Lock and decode accumulation

`SignalLockController`/`DecodeController` (`src/game/signal/`) both:

- Clamp incoming `dt` to a `MAX_..._DT_SECONDS` constant (0.1s) per
  `update()` call — matching `PlayerConfig.maxDeltaTimeSeconds`'s existing
  delta-spike guard. A huge `dt` (e.g. a tab-restore stall) behaves like a
  single capped tick, never an instant fill.
- Accumulate using real elapsed time, so identical total
  `(quality × time)` always yields identical progress regardless of how
  finely it was ticked (frame-rate independence,
  `signalLockController.test.ts`/`decodeController.test.ts`'s dedicated
  tests).
- Fire their completion event (`LockAcquired`, `DecodeCompleted`) exactly
  once per acquisition/completion — never every frame while already in
  that state.

`SignalLockController.update()` handles a cold-start `Searching`/`Candidate`
→ `Acquiring` transition as an intra-tick fallthrough (no `return` between
the state assignment and the accumulation branch) — otherwise the very
first tick that clears the acquire threshold would "spend" itself purely on
the state change and contribute zero accumulation, which would fail
frame-rate independence for a cold start. `Locked` → `Lost` deliberately
does **not** cascade the same way: `Lost` is a one-tick transient state
(see `receiver-state-model.md`), and must remain externally observable for
exactly one `update()` call before resolving on the next tick.
