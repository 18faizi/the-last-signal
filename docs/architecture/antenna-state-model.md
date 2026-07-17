# Antenna State Model

## AntennaControlState (`AntennaControlState.ts`)

Seven states, explicit transition table (mirrors `ReceiverMode.ts`'s
pattern):

```
Offline:          [Idle, Unavailable, Fault]
Unavailable:       [Idle, Offline, Fault]
Idle:              [Moving, Unavailable, Offline, Fault]
Moving:            [Idle, AlignedCandidate, Aligned, Offline, Fault]
AlignedCandidate:  [Moving, Idle, Aligned, Offline, Fault]
Aligned:           [Moving, Idle, AlignedCandidate, Offline, Fault]
Fault:             [Offline]
```

Key invariants (each backed by a unit test in `antennaController.test.ts`):

- **Offline can't move** — every movement command
  (`setAzimuth`/`setElevation`/`setPolarization`/`adjustX`) checks
  `controlState !== 'Offline' && !== 'Fault'` before accepting.
- **Unavailable can't become Aligned** — the transition table has no
  direct `Unavailable → Aligned` edge; a non-selectable array must first
  become selectable (`Idle`) before any alignment path is reachable.
- **Aligned is DERIVED, never set directly** — `AntennaController`
  recomputes the desired control state every time metrics are
  recalculated, from `AntennaMetrics.overallQuality` against a
  **per-array RATIO** of that array's own `maxQuality` (see below), never
  a fixed absolute value.
- **Power loss stops motion safely** — `powerOff()` clears every array's
  pending target (`targetAzimuthDeg`/`targetElevationDeg`/
  `targetPolarizationDeg` → `null`) before routing to `Offline`, so a
  restored-power array never resumes a stale in-flight command.
- **Restored power preserves position but does not auto-resume** —
  `currentAzimuthDeg` etc. are untouched by `powerOff()`/`powerOn()`; only
  an explicit new movement command sets a target again.

## Why Aligned/AlignedCandidate use RATIOS, not fixed thresholds

`AntennaController` exports `ALIGNED_QUALITY_RATIO = 0.9` and
`CANDIDATE_QUALITY_RATIO = 0.4`. The actual floor for a given array is
`array.maxQuality * ALIGNED_QUALITY_RATIO`. This was a genuine bug caught
during e2e testing: an earlier version used a fixed absolute threshold
(0.85), which made North Dish — whose `maxQuality` is deliberately capped
at 0.6 (spec §10: "lower max quality") — structurally unable to ever
reach `Aligned`, even at perfect, settled, fully-powered alignment.
Ratios keep "aligned" meaning "as good as THIS array can get", consistent
across every array regardless of its ceiling. See
`antennaController.test.ts`'s regression test for this exact scenario.

## AntennaEvaluator combination formula

```
alignmentQuality = arrayGate × mechanicalReadiness
                    × azimuthQuality × elevationQuality × polarizationQuality,
                    capped at definition.maxQuality

overallQuality = clamp01(alignmentQuality × powerGate × waveguideQuality)
```

- **Azimuth** — CIRCULAR wraparound (`shortestAngleDelta`, ±180° domain).
  Quality is 1.0 within `captureWidthDeg / 2` of the target, falling off
  via smoothstep to 0 at `captureWidthDeg/2 + azimuthToleranceDeg*2`.
- **Elevation** — LINEAR, clamped, no wraparound (0-75° hard range).
  Forced to 0 outside `[minElevationDeg, maxElevationDeg]`
  ("below-range invalid").
- **Polarization** — ONE documented model: linear-polarization angle
  normalized to (-90°, 90°], error computed on a 180°-PERIODIC domain
  (`shortestPolarizationDelta`) because a polarization angle and its
  180°-rotated equivalent describe the identical physical orientation
  (0° ≡ 180°, 90° ≡ -90°).

`alignmentQuality` is exposed SEPARATELY from `overallQuality` specifically
so the Phase-4 composition evaluator
(`src/game/source-analysis/AnalysisQualityEvaluator.ts`) can apply its OWN
live power/waveguide gates without double-counting this evaluation's — see
`bearing-analysis.md`.

## Mechanical movement (`AntennaController.tickAxis`)

Frame-rate independent: distance covered per tick is always exactly
`speed × dt` (dt clamped to `MAX_ANTENNA_DT_SECONDS = 0.1`), and arrival
SNAPS exactly to the commanded target float value rather than accumulating
a residual — repeated move-to-same-target operations can never drift
(verified explicitly). Movement is deliberately LINEAR within each array's
defined `[min,max]` range, never wraparound — azimuth's circular math is
used only for QUALITY scoring, not the physical motor's travel path, since
every array's range is bounded and never needs to cross the ±180° seam.

## Parked position

Each array parks at its own axis MINIMUM bound (`minAzimuthDeg`,
`minElevationDeg`, `minPolarizationDeg`) rather than `(0,0,0)` — chosen
deliberately so the default position can never accidentally land inside an
array's quality plateau (an earlier `(0,0,0)`-clamped design did exactly
that for North Dish's azimuth). `AntennaValidation.ts`'s
"default position not accidentally aligned" check depends on this.
