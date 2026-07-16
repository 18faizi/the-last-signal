# Application architecture

## Overview

The application is a Babylon.js program orchestrated by a single
`GameApplication` class. There is no framework runtime (no React); UI
overlays (loading, fatal error, debug) are plain DOM elements declared in
`index.html` and controlled by small classes.

```
main.ts
  └─ createApplicationContext()          (config, stores, error reporter, DOM refs)
  └─ new GameApplication(context).start()
       ├─ EngineFactory  → AbstractEngine + EngineCapabilities (WebGPU → WebGL)
       ├─ PhysicsService → Havok WASM runtime (loaded once, cached)
       ├─ InputManager   → raw keyboard/pointer/wheel/focus state
       ├─ AudioManager   → Howler buses (no audio played in 0.1)
       ├─ AssetManager   → typed manifest loading/caching (manifest empty in 0.1)
       ├─ SceneManager   → owns the active scene, transitions, disposal
       │    ├─ developmentSceneDefinition
       │    ├─ movementTestSceneDefinition
       │    ├─ interactionTestSceneDefinition
       │    ├─ accessTestSceneDefinition
       │    └─ facilityGreyboxSceneDefinition  ← boot scene (Milestone 0.5)
       ├─ DebugOverlay   → dev-only diagnostics (timer-driven DOM updates)
       └─ single render loop (renders SceneManager.currentHandle per frame)
```

## Dependency rules

- **No global mutable state.** The engine, scene, canvas and services live as
  private fields of `GameApplication`; everything they need arrives through
  constructor parameters or the explicit `ApplicationContext` built in
  `main.ts`.
- **Zustand stores hold coarse state only** (lifecycle, scene id, backend,
  physics status, settings). They never hold Babylon objects or per-frame
  data. See `state-boundaries.md`.
- **Errors flow through `ErrorReporter`.** Services throw typed `GameError`s;
  the reporter logs and routes fatal ones to the fatal-error screen.
- **Everything disposable is tracked.** `DisposableBag` collects listeners,
  subscriptions and services; `GameApplication.stop()` disposes them in
  reverse order exactly once.

## Lifecycle

States: `created → initializing → ready → running → stopping → stopped`,
with `failed` reachable from any active state and `failed → stopping`
allowed so cleanup after failure is legal. The transition table lives in
`src/app/lifecycle/LifecycleState.ts`; `GameApplication` asserts every
transition, so calling `start()` twice or resurrecting a stopped app throws.

## Engine creation and fallback

`EngineFactory` checks `navigator.gpu` and `WebGPUEngine.IsSupportedAsync`,
attempts the WebGPU engine, and falls back to the WebGL `Engine` if creation
or initialization fails. The chosen backend plus device metadata is captured
in `EngineCapabilities` and mirrored into the application store for the
debug overlay. A WebGPU failure is recoverable by design; only a WebGL
failure aborts startup with an `engine-init` error.

## Render loop

Exactly one `engine.runRenderLoop` callback exists, started once by
`GameApplication` after the initial scene is ready. It looks up
`SceneManager.currentHandle` every frame, so scene replacement never
creates a second loop.

## Boot scene selection

By default the application loads the `facility-greybox` scene. A `?scene=`
URL query parameter overrides this — for example `/?scene=access-test` loads
the Milestone 0.4 access-test scene. Only registered scene IDs (see
`src/core/scenes/SceneId.ts`) are accepted; unrecognised values fall back to
`facility-greybox`. This is used by the legacy Milestone 0.3/0.4 e2e tests.

Scenes may now compose the reusable interaction framework
(`src/game/interaction/` — see `../gameplay/interaction-framework.md`): an
`InteractionSystem` scene observer drives focus raycasting, prompts,
hold/immediate interactions and the inspection/document overlay modes,
suspending player input through the controller's token-lock API. The scene
context gained `input`, `settings`, `errorReporter` and `overlayParent`;
scene handles may expose `markerText` (scene-owned development marker) and
`getDebugFields()`. UI layering is documented in `src/styles/global.css`
(canvas 0 → marker 10 → pointer-lock prompt 15 → interaction prompt 16 →
inspection 26 → document reader 28 → debug overlay 30 → loading 35 →
fatal 40). The single-render-loop rule is unchanged — inspection swaps
`scene.activeCamera`, never adds a loop.

## Milestone 0.6 addition: the power domain layer

`FacilityGreyboxScene.ts` now also wires a `PowerNetwork`, `GeneratorController`,
`DistributionPanelController`, and `EmergencyPowerController` at scene setup
— none of them Babylon-aware. `InteractionTarget` gained a `'panel'` kind and
`InteractionMode` gained a `'power-panel'` mode (entered through the same
`transitioning` gate as `inspecting`/`reading`), following the exact pattern
`InteractionSystem` already used for the M0.4 inventory overlay. See
`power-network.md`, `generator-state-model.md`, and `power-events.md` for the
full domain-layer breakdown, and `powered-load-bindings.md` for how world
geometry observes it without hardcoding power checks.
