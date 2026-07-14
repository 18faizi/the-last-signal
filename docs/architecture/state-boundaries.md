# State boundaries

## What lives in Zustand

Two vanilla (non-React) stores exist:

- **applicationStore** — lifecycle state, current scene id, scene-transition
  flag, rendering backend, physics status, fatal-error message, dev-mode
  flag. Written by `GameApplication` and `SceneManager` observers; read by
  the debug overlay.
- **settingsStore** — master/music/effects volume, mouse sensitivity,
  invert-Y, graphics preset, reduced-motion. Volume changes are subscribed
  by `GameApplication` and forwarded to `AudioManager` buses. Not persisted
  yet.

## What deliberately does NOT live in Zustand

- Babylon engine, scenes, meshes, cameras, materials
- Physics bodies or the Havok plugin
- Howler/audio node instances
- Pointer deltas, per-frame input, mesh transforms, FPS

High-frequency data stays inside the owning service (`InputManager`
snapshots, engine queries) and is _pulled_ when needed — e.g. the debug
overlay polls on a 250 ms timer instead of subscribing to per-frame pushes.

## Rationale

Zustand subscriptions fan out to arbitrary listeners; putting per-frame data
there turns every frame into N callbacks and invites accidental rendering
work. Coarse state changes (a scene switch, a settings change) are rare and
benefit from observability; frame data does not.

## Ownership summary

| Data                        | Owner                 | Exposed as                     |
| --------------------------- | --------------------- | ------------------------------ |
| Lifecycle, scene id, status | applicationStore      | subscribe / getState           |
| Player settings             | settingsStore         | subscribe / getState           |
| Raw input                   | InputManager          | immutable `InputSnapshot` pull |
| Engine/render metadata      | engine + capabilities | direct query                   |
| Asset cache/status          | AssetManager          | `load()` / `getStatus()`       |
| Audio bus volumes           | AudioManager          | typed getters/setters          |
