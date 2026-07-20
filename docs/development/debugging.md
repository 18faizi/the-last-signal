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

## Milestone 0.6 additions

See `power-debugging.md` for the full breakdown. In short: `F10` toggles the
power-network debug overlay (`PowerDebugOverlay`, mirrors F9's pattern plus
colour-coded world markers); the F3 overlay's `getDebugFields()` gained
compact generator/power rows; and the test bridge gained
`getPowerSnapshot()`, `getGeneratorSnapshot()`, `getGeneratorReadiness()`,
`generatorAction(name)`, `requestCircuit(...)`, `toggleCircuit(...)`,
`openDistributionPanel()`/`closeDistributionPanel()`/`isDistributionPanelOpen()`,
`activateReceiver()`, and `resetFacility()` (the dev full-reset action —
also clears every M0.5 field, superseding any ad-hoc reset previously done
by hand). `getFacilityState()` now also returns a `power` field.

## Milestone 0.7 additions

See `signal-debugging.md` for the full breakdown. In short: `F11` toggles a
new signal/receiver debug overlay (`SignalDebugOverlay`, bottom-right,
mirrors F10's pattern) showing target/solution values and per-control
quality — dev-only, never constructed in production, and never rendered by
the compact F3 rows (which show current values and computed quality, not
targets). The F3 overlay's `getDebugFields()` gained a compact receiver
summary (mode, channel, frequency, gain/filter, phase, signal strength,
noise, overall quality, lock/decode progress, decoded count) plus the
signal-progression phase. `resetFacility()` now also resets
`ReceiverController` and `ReceiverRuntimeState` to their power-off/
`ReceiverOffline` defaults. The test bridge gained `getReceiverSnapshot()`,
`getSignalRuntimeSnapshot()`, `openReceiverPanel()`/`closeReceiverPanel()`/
`isReceiverPanelOpen()`, `receiverAction(name, value?)` (mirrors
`generatorAction`, but most actions take a numeric value — `setChannel`,
`setFrequency`, `setGain`, `setFilter`, `setPhase`, `startScan`,
`cancelScan`, `resetControls`), `getDecodedTranscript(signalId)`, and
`getSignalEventCounters()` (cumulative lock/decode/activity event counts,
used by the repetition e2e suite to prove no event double-fires).

## Milestone 0.8 additions

See `antenna-debugging.md` for the full breakdown. In short: `F2` toggles
a new antenna/bearing debug overlay (`AntennaDebugOverlay`, bottom-left,
mirrors F11's pattern) showing per-array control state, current/target
az-el-pol, quality breakdown, waveguide state, and source-analysis
samples/classification — dev-only, never constructed in production. F2
was chosen specifically because F12 conflicts with browser devtools. The
F3 overlay's `getDebugFields()` gained a compact antenna summary (powered,
selected array, state, alignment quality, sample count, source-analysis
state/classification) plus the antenna progression phase and reveal
completion. `resetFacility()` now also resets `AntennaController`,
`WaveguideController`, `SourceAnalysisController`, and
`AntennaRuntimeState` to their power-off/parked/`Unavailable` defaults.
The test bridge gained `getAntennaSnapshot()`, `getAntennaRuntimeSnapshot()`,
`getWaveguideSnapshot(pathId)`, `getSourceAnalysisSnapshot()`,
`openAntennaPanel()`/`closeAntennaPanel()`/`isAntennaPanelOpen()`,
`antennaAction(name, value?)` (`selectArray`/`setAzimuth`/`setElevation`/
`setPolarization`/`park`/`emergencyStop`), `selectAntennaArray(arrayId)`,
`cycleWaveguidePort(pathId)`, `collectSourceSample()`, and
`runSourceAnalysisComparison()`.

## Milestone 0.9 additions

See `threat-debugging.md` for the full breakdown. In short: `F1` toggles
the threat/stealth debug overlay (`ThreatDebugOverlay` — DOM panel plus
lazily-built 3D markers for the nav graph, hiding spots, safe zones, LOS
line and last-known position; all non-pickable, physics-free, disposed on
hide, never constructed in production). F1 was the last unclaimed safe
function key (F5 = refresh, F12 = devtools stay off-limits); every earlier
debug key (F2/F3/F4/F6/F7/F8/F9/F10/F11) is preserved unchanged. The F3
overlay gained compact threat rows (state, phase, encounter, suspicion,
detection, exposure, LOS, last-known, route node, behavior, hiding,
safe-zone, manifestation, fired events, encounter-done). `resetFacility()`
now also runs the full threat reset (`resetAll`: controller, runtime
state, manifestations, stimuli, director, hiding, prompt gate, fixtures,
UI). The test bridge gained the read-only threat surface plus the
movement assists documented in `threat-debugging.md` — and deliberately NO
setter for threat state, suspicion, detection or event/encounter
completion.
