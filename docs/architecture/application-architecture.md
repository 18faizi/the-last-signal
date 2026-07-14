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
       │    └─ developmentSceneDefinition
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
