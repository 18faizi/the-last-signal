# Debugging

## Debug overlay

Development builds include a diagnostic overlay toggled with `` ` ``
(backquote) or `F3`. It shows FPS, lifecycle state, active scene, rendering
backend, render resolution, hardware scaling, physics status, mesh count,
active camera, pointer-lock state, currently pressed keys and build mode.

Implementation notes:

- Constructed only when `environment.isDevelopment` is true, so production
  builds neither show nor update it.
- Refreshes on a 250 ms timer (`performanceConfig.debugOverlayUpdateIntervalMs`),
  mutating `textContent` of pre-built cells — no per-frame DOM work, no
  virtual-DOM machinery.
- Disposes its interval and DOM on application stop.

## Console signals

In development the app logs:

- `[engine] rendering backend: webgpu|webgl` — chosen backend
- `[engine] WebGPU initialization failed, falling back to WebGL` — fallback
- `[recoverable:<kind>]` — recoverable errors via `ErrorReporter`
- `[fatal:<kind>]` — fatal errors (also shown on the fatal-error screen)

## Babylon Inspector

The Inspector is intentionally **not** bundled (it adds several MB). To use
it ad hoc during development, install `@babylonjs/inspector` locally and
call `scene.debugLayer.show()` from a scratch change — do not commit either.
A dev-only lazy-loading action can be added in a later milestone if the need
becomes routine.

## Fatal-error screen

Unrecoverable startup failures render `#fatal-error-root` with a friendly
message; development builds also show the `GameError` kind, message, cause
chain and stack, plus a copy-details button (when the Clipboard API is
available). To exercise it manually, temporarily throw inside
`DevelopmentScene.create` and reload.
