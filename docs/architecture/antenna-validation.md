# Antenna Validation

Mirrors `SignalValidation.ts`/`PowerValidation.ts`'s contract exactly:
pure functions over plain definition data, returning human-readable
problem strings — an empty array means valid. Run once at scene-creation
time in development builds (throws) and directly by unit tests.

## `validateAntennaDefinitions()` (`AntennaValidation.ts`)

- Duplicate array ids.
- `minAzimuthDeg < maxAzimuthDeg` (and elevation/polarization
  equivalents); elevation range within `[0, 75]`.
- Target values within the array's own declared `[min,max]` range.
- Positive tolerances (azimuth/elevation/polarization), positive
  `captureWidthDeg`, positive mechanical speeds.
- `baseGain`/`maxQuality` within their legal ranges.
- `requiredPowerCircuitId` / `waveguidePathId` reference something that
  actually exists (via `AntennaValidationContext`).
- **Achievability**: the exact target position, at full power and full
  waveguide continuity, must reach at least `maxQuality * 0.9`. Because
  every axis's error is exactly 0 at the exact target — and
  `AntennaEvaluator`'s falloff functions always return exactly 1.0 at
  zero error regardless of tolerance width — this check is currently
  always trivially satisfied for any well-formed definition; it exists as
  defense-in-depth against a future evaluator change, not because a
  representable definition can fail it today (documented explicitly in
  `antennaValidation.test.ts`).
- **Default-not-solved**: the array's PARKED position (each axis at its
  own minimum bound — see `antenna-state-model.md`) must NOT already
  reach `maxQuality * 0.9`. This is a REAL, exercisable check — an earlier
  `(0,0,0)`-clamped park position accidentally satisfied it for North
  Dish before the park-at-minimum-bound fix.
- **Reveal reachability**: at least one array must be
  `requiredForProgression`; at least one array must have
  `role === 'DiagnosticLoop'`.

## `validateWaveguideDefinitions()` (`WaveguideValidation.ts`)

- Duplicate path ids; duplicate port ids within a path.
- At least 2 candidate ports per path (a route puzzle needs choices).
- `correctPortId` and `defaultPortId` must both be among the path's own
  ports.
- At least one path segment label.

## Cross-domain reference checks

- `validateAntennaPowerWiring(arrayCircuitId, expectedRooftopCircuitId)`
  — confirms every array's `requiredPowerCircuitId` matches the actual
  rooftop circuit id from `facilityPowerDefinitions.ts`.
- `validateWaveguideReference(waveguidePathId, registeredPathIds)` —
  confirms every array's `waveguidePathId` resolves to a registered
  `WaveguideDefinition`.

## Scene-creation wiring

`FacilityGreyboxScene.ts` runs `validateWaveguideDefinitions()` and
`validateAntennaDefinitions()` (with the real registered power-circuit and
waveguide-path ids) immediately after `validateSignalDefinitions()`,
throwing in development if any problem is found — the scene will not boot
on invalid antenna/waveguide data, matching the existing power/signal
precedent exactly.
