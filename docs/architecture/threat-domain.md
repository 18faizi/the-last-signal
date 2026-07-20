# Threat Domain Architecture

`src/game/threat/` is pure TypeScript — no Babylon, no DOM, no audio. The
world only ever talks to it through typed events and plain-data inputs.

## Modules

- `ThreatState.ts` — the 12-state machine with one central transition table.
- `ThreatController.ts` — the orchestrator: composes perception
  (VisionEvaluator + SuspicionController + SoundStimulusRegistry) with
  behavior (ThreatBehaviorController) and owns the state machine.
- `ThreatDefinition.ts` — authored config (vision, suspicion, movement,
  home node, allowed zones, safe zones).
- `ThreatRuntimeState.ts` — coarse event-driven progression bookkeeping
  (the FIFTH separate progression chain; see `threat-runtime-state.md`).
- `ThreatEvent.ts` — typed events + disposable bus.
- `ThreatValidation.ts` — authored-data validation (dev builds throw).
- `perception/` — pure vision/exposure/sound/suspicion models.
- `behavior/` — nav graph, movement, search, pursuit, encounter rules.
- `manifestation/` — staged presentation beats, separate from the actor.
- `stealth/` — hiding spots, concealment data, safe zones.

## Scene boundary

`src/scenes/facility-greybox/threat/buildThreatEventBindings.ts` is the ONLY
place the domain meets Babylon:

- ONE scoped `onBeforeRenderObservable` exists only while the threat actor
  or a manifestation is active. It expires stimuli, ticks the footstep
  adapter, runs the cadenced LOS probe (one reused `Ray` + `Vector3`, every
  0.12 s), computes exposure, ticks `ThreatController.update()` and applies
  the resulting `ThreatMovementIntent` as a **kinematic** transform on the
  pooled actor mesh. A dormant threat performs zero raycasts and zero
  perception work — the observer is fully detached.
- A second, always-on lightweight observer only advances the event-director
  clock, stimulus expiry and blinking fixtures (a handful of arithmetic ops).

## Performance contract

No per-frame Zustand writes, no scene-wide scans, no second render loop,
pooled meshes (two silhouette assemblies built once, shown/hidden/moved),
change-only detection-meter DOM writes, reused ray/vector objects.
