# Antenna Domain

`src/game/antenna/` is the pure-TypeScript layer for rooftop antenna
mechanics and alignment math (Milestone 0.8). No Babylon, no DOM, no
canvas — the same discipline as `src/game/power/` and `src/game/signal/`.
World geometry lives in `src/scenes/facility-greybox/antenna/`; this layer
never imports from there.

## Files

- **`AntennaArrayId.ts`** — branded string id, mirrors `SignalId.ts`.
- **`AntennaMath.ts`** — self-contained pure math helpers (`clamp01`,
  `clamp`, `smoothstep01`, `normalizeAngle180`, `shortestAngleDelta`,
  `falloffQuality`). Deliberately NOT imported from
  `src/game/signal/SignalChannel.ts` even though the shapes overlap — the
  antenna domain must not take on a dependency edge toward the signal
  domain (see `SignalEvaluator.ts`'s own purity contract).
- **`AntennaArrayDefinition.ts`** — static per-array data: mechanical
  ranges, target azimuth/elevation/polarization + tolerances, base gain,
  capture width, `maxQuality` cap, required power circuit id, waveguide
  path id, receiver-compatible/selectable/required-for-progression flags,
  mechanical speeds and coarse/fine step sizes.
- **`AntennaControlState.ts`** — the 7-state control machine
  (`Offline`/`Unavailable`/`Idle`/`Moving`/`AlignedCandidate`/`Aligned`/
  `Fault`) with an explicit transition table. See `antenna-state-model.md`.
- **`AntennaMechanicalState.ts`** — the one **mutable** piece of state in
  this layer: current/target azimuth, elevation, polarization, an
  emergency-stop flag, a parked flag. Mutable deliberately, mirroring
  `ReceiverControls.ts` — continuously written by the mechanical tick.
- **`AntennaMetrics.ts`** — the immutable output of evaluating one array's
  mechanical state against its definition: per-axis quality, mechanical
  readiness, waveguide continuity, power availability, the PURE
  `alignmentQuality` term, and the fully-gated `overallQuality`.
- **`AntennaEvaluator.ts`** — the pure evaluation function. See
  `antenna-state-model.md` for the exact math and combination formula
  (circular azimuth, linear elevation, 180°-periodic polarization).
- **`AntennaController.ts`** — owns mechanical state + control state per
  array, frame-rate-independent movement, selection, power/waveguide
  event-driven inputs. See `antenna-state-model.md`.
- **`AntennaEvent.ts`** — typed event union + `AntennaEventBus`. See
  `antenna-events.md`.
- **`AntennaSnapshot.ts`** — immutable plain-data view for debug/tests.
- **`AntennaValidation.ts`** / **`AntennaError.ts`** — see
  `antenna-validation.md`.
- **`AntennaProgressionPhase.ts`** / **`AntennaRuntimeState.ts`** — see
  `antenna-runtime-state.md`.
- **`AntennaInteractionTarget.ts`** / **`AntennaJunctionTarget.ts`** —
  the Babylon-facing adapters (the one sanctioned mesh-touching files in
  this directory), mirroring `ReceiverInteractionTarget.ts` /
  `GeneratorInteractionTargets.ts`'s precedent exactly.
- **`AntennaDebugView.ts`** — pure string formatters shared by the F2
  overlay and the F3 compact summary. No Babylon/DOM, just strings.

## Sibling domains

`src/game/waveguide/` (waveguide route/continuity) and
`src/game/source-analysis/` (bearing estimation + cross-array comparison)
are separate, equally Babylon-free domains — see `waveguide-domain.md` and
`bearing-analysis.md`. All three are composed only at the scene-wiring
layer (`facilityAntennaBindings.ts`), never by importing one domain from
another.

## Determinism

Nothing in this layer calls `Math.random()` or reads `Date.now()` for
gameplay math. `evaluate()` is a pure function: identical
`(AntennaArrayDefinition, AntennaEvaluationInput)` always produces an
identical `AntennaMetrics`, verified directly by
`antennaEvaluator.test.ts`'s determinism test. Mechanical movement is a
deterministic, frame-rate-independent tick driven by real delta time
(clamped per tick to `MAX_ANTENNA_DT_SECONDS`), with exact-snap arrival
that cannot accumulate floating-point drift across repeated operations
(verified by `antennaController.test.ts`).

## Milestone 0.9: the reveal as the threat gate

Nothing in `src/game/antenna/` changed for Milestone 0.9. The threat
foundation is gated on this domain's terminal fact: the bindings advance
the (separate, fifth) `ThreatProgressionPhase` chain to
`AntennaAftermathPending` from `AntennaRuntimeState`'s typed completion
event, and the event director's `antenna-reveal-complete` condition reads
`isRevealComplete` through a narrow callback. Antenna `SampleCollected`/
`AnalysisResolved` events additionally emit `signal-activity` sound
stimuli via a subscription in `buildThreatEventBindings.ts`.
