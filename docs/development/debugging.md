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

## Milestone 0.2 additions

When the movement scene is active, the overlay appends player rows: position,
horizontal speed, vertical velocity, mode (idle/walking/sprinting/crouching/
airborne), grounded, ground distance, slope angle, crouch state (held /
crouched / BLOCKED), pointer lock and yaw/pitch. Rows are scene-contributed
via `SceneHandle.getDebugFields()` and update on the overlay timer.

`F4` (development only) toggles wireframe visualization of the player
capsule (swaps size with stance), the ground probe (yellow), the
head-clearance probe (teal; red while standing is blocked), the movement
direction (green) and the ground normal (magenta). Debug meshes never
collide, are unpickable, and are disposed with the scene.

Settings integration can be verified from the console in development via the
test bridge: `__TLS_TEST__.setMouseSensitivity(3)` and
`__TLS_TEST__.setInvertY(true)` write through the real settings store.

## Milestone 0.3 additions

With the interaction scene active, the overlay appends interaction rows:
Int mode (gameplay/holding/transitioning/inspecting/reading), focused
target id + label, focus distance, availability, target kind, raw ray
classification, hold %, input locks, inspecting/reading flags.

`F6` (development only) toggles interaction-ray visualization: the cast ray
to its 8 m probe length, the hit point marker (green = focused target,
yellow = target out of range, red = blocked by geometry) and the hit
normal. Ray debug meshes are non-pickable — they can never influence the
interaction raycast itself — non-colliding, disposed with the scene, and
absent from production. `F3`/backquote and `F4` keep their Milestone 0.2
meanings.

## Milestone 0.5 additions

### F8 — Teleport menu

Available in the facility-greybox scene only. Shows a clickable list of
named positions (`TeleportDefinition` registry). Click a row to call
`FirstPersonController.teleportTo(position, yaw)`. The menu is a plain DOM
overlay managed by `TeleportMenuOverlay` and removed on scene disposal.

### F9 — Facility debug overlay

Available in the facility-greybox scene only. Shows current progression
phase, key zone membership, discovery count, opened door IDs and collected
pickup IDs. Refreshes every 30 frames. Managed by `FacilityDebugOverlay`.

### Test bridge additions (facility scene, development only)

- `getFacilityState()` — `{ progressionPhase, isComplete, collectedPickupIds,
openedDoorIds, discoveredZoneIds }` snapshot from `FacilityRuntimeState`.
- `teleportTo(id)` — teleports the player to a named `TeleportDefinition`;
  returns `true` on success, `false` for unknown IDs.

Both bridge keys are installed when the facility scene is created and removed
when it is disposed. They do not exist when any other scene is active.
