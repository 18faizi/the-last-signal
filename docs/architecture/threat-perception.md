# Threat Perception

## The LOS split (key decision)

`VisionEvaluator.ts` is pure and deterministic and **never raycasts**. The
physical occlusion test lives in the scene adapter
(`buildThreatEventBindings.ts`), which owns one reused `Ray` + `Vector3`
pair and probes at a controlled cadence (every 0.12 s, threat head → player
head, excluding the threat's own pooled meshes), feeding the resulting
`losBlocked` boolean into the pure evaluator. The domain stays Babylon-free
and unit-testable; all raycast cost is scoped to the adapter and is zero
while the threat is dormant.

## Vision

`evaluateVision(config, input)` returns a 0-1 score as an explicit product:

```
score = falloff(distance)
      × angleFactor(central 1 / peripheral 0.45 / behind 0)
      × exposure (0-1, from ExposureEvaluator)
      × movementMultiplier (sprint 1 / walk 0.7 / crouch+still 0.35)
```

gated by hard windows (max distance, FOV, vertical tolerance, LOS,
fully-hidden override → exact 0). Same inputs, same score — no randomness.

## Exposure

`evaluateExposure` is a restrained approximation (no lux physics): powered
zone 1.0, emergency-only 0.55, dark 0.3, dark cover 0.12, crouch ×0.75,
hiding concealment scales toward 0. The scene adapter derives `zonePowered`
from the real PowerNetwork circuit state plus the corridor light's mode.

## Suspicion / detection

`SuspicionController` implements the two-stage model (see
`docs/gameplay/stealth-and-detection.md`): suspicion from vision+sound
pressure with decay; detection gated on a vision floor with slower
post-LOS-break decay; a one-shot full-detection event per encounter,
re-armed only by `resetEncounter()`. Delta is clamped to 0.1 s (the
established codebase precedent) and all rates are per-second, so the model
is frame-rate independent (unit-verified: 100×0.01 s ≡ 10×0.1 s).

## Player stimulus adapters

The player controller, doors, generator and receiver are NOT modified.
Narrow adapters observe them:

- `PlayerStimulusAdapter` (pure) is ticked with the plain motor sample and
  emits footstep/landing stimuli at authored cadences.
- Scene-side subscriptions in the bindings translate door
  opening/closing events, `GeneratorStarted`, `DecodeCompleted` and antenna
  `SampleCollected`/`AnalysisResolved` into typed stimuli at their authored
  world positions.
