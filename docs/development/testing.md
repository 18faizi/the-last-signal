# Testing

## Unit tests (Vitest)

Location: `src/tests/unit/`. Environment: jsdom (needed by input/DOM tests;
harmless for pure logic).

Covered by Milestone 0.1:

- Lifecycle transition table (legal/illegal transitions, assertion errors)
- SceneManager: registration, duplicate registration, unknown-id rejection,
  previous-scene disposal, overlapping-transition rejection, failure
  wrapping, observer notifications, error reporting
- Application/settings stores: defaults, actions, clamping, subscriptions
- InputManager: press/release, blur reset, immutable snapshots, wheel
  accumulation, action listeners without auto-repeat, dispose
- AssetManager + manifest validation: caching, in-flight dedupe, unknown
  ids, failure status, progress
- GameError/ErrorReporter: kinds, cause chains, wrap semantics, fatal
  listener
- Config validation

The SceneManager is generic over handle/context types precisely so these
tests run without constructing Babylon scenes.

Run: `pnpm test` (CI) or `pnpm test:watch`.

## Browser smoke test (Playwright)

Location: `tests/e2e/smoke.spec.ts`. The config starts the Vite dev server
itself (`webServer`), so `pnpm test:e2e` is self-contained.

The test drives real startup in headless Chromium: loading screen text,
loading screen disappearance, canvas visibility, absence of the fatal-error
screen, the `Milestone 0.1 — Foundation Ready` marker, debug-overlay toggle
on/off, and fails on any unexpected console error or page error.

Headless CI has no WebGPU; the launch args enable SwiftShader so the WebGL
fallback path is what gets exercised — which doubles as a regression test
for the fallback itself.

## Type checking

`pnpm typecheck` runs `tsc --noEmit` over the entire project including test
and config files.

## Milestone 0.2 additions

New pure-logic unit suites: movement intent (axis normalization, opposing
cancellation, diagonal normalization, jump press-vs-held), movement-mode
selection, crouch state machine (including stand-blocked), camera look
(pitch clamp, invert-Y, sensitivity scaling, yaw wrapping), jump timing
(coyote window, jump buffering, double-jump prevention) and player-config
validation.

New Playwright suite `tests/e2e/movement.spec.ts`: boots the movement scene,
verifies the pointer-lock prompt, clicks the canvas, then drives walking,
stopping, jumping, crouching and sprinting via keyboard, asserting against
the test bridge. Fails on any console/page error.

### Development test bridge

Development builds (only) install `window.__TLS_TEST__` from
`src/game/dev/TestBridge.ts` when the movement scene loads:

- `getPlayerState()` — plain-data player snapshot (position, speeds, mode,
  stance, pointer lock, yaw/pitch); no Babylon objects cross the boundary.
- `setPointerLockBypass(boolean)` — lets automation drive movement where
  headless Chromium denies real pointer lock.
- `respawn()` — reset to spawn.
- `setMouseSensitivity(number)` / `setInvertY(boolean)` — settings-store
  verification hooks (routed through the real store, not a side channel).

The bridge is removed on scene disposal and is never installed in
production builds (`environment.isDevelopment` gate; verify with
`pnpm preview` — `window.__TLS_TEST__` is undefined there).

## Milestone 0.3 additions

New unit suites: interaction-mode transition table (valid + invalid),
hold-interaction state machine (progress, cancellation on release / focus
loss / target switch, complete-exactly-once, fresh-press requirement),
focus stability (grace period, single enter/exit, prompt switching,
priority tie-breaking), prompt formatting (immediate/hold/disabled/busy),
inspection view math (rotation, pitch/zoom clamps, reset), input-lock
tokens, document-definition validation (including dev-document word-count
budgets) and InteractionRegistry mesh resolution (real Babylon `NullEngine`
scene — child meshes resolve to the parent target).

New Playwright suite `tests/e2e/interaction.spec.ts`: prompt flow over the
toggle switch, hold progress/cancel/complete-once on the breaker, disabled
reason, inspection (open, locomotion suspended, rotate, zoom, R reset,
Escape close, movement resumes), document reader (open, content, scroll,
close, movement resumes), and a 20× inspection+document repetition test
asserting camera/mesh/observer counts and DOM overlay counts stay at
baseline.

### Bridge additions (development only)

`getInteractionState()` (interaction snapshot + inspection view +
document scroll), `getDiagnostics()` (camera/mesh/observer/DOM counts for
the leak test), `activateTarget(id)` and `closeOverlays()` — the last two
exist because headless CI cannot aim the camera precisely; they route
through the same activation path as a real E press and are no-ops in
production and outside gameplay mode.

## Milestone 0.5 additions

New unit suites (all Babylon-free, run in vitest/jsdom):

- `progressionPhase.test.ts` — `canAdvancePhase`, `tryAdvancePhase`,
  `comparePhase`, `isPhaseComplete`; covers valid steps, invalid skips,
  bidirectional branch, terminal state, full linear path.
- `zoneRegistry.test.ts` — register/duplicate, enter/exit/discovered events,
  re-entry idempotency, multi-zone overlap, counts, reset, unsubscribe,
  listener error isolation.
- `triggerVolume.test.ts` — one-shot firing, repeatable volumes,
  enter/exit callbacks, error swallowing, reset and clear.
- `checkpoint.test.ts` — register, activate, latestCheckpoint (timestamp
  ordering), counts, reset, getAll.
- `facilityRuntimeState.test.ts` — phase advancement, record methods
  idempotency, `getSnapshot`, reset, subscribe/unsubscribe, error swallowing.
- `facilityValidator.test.ts` — valid input passes, duplicate IDs, unknown
  item refs, softlock detection (item behind its own door), zone refs, empty
  zoneId skip.
- `teleportDefinition.test.ts` — `validateTeleportDefinition` (empty id/label,
  non-finite coords/yaw, negative finite values accepted); `TeleportRegistry`
  (register, duplicate, invalid, getAll, clear, unknown get).

New Playwright suite `tests/e2e/facility.spec.ts` (15 tests): boots the
facility scene, checks ready marker, verifies bridge availability and initial
phase, inventory empty start, compound gate key/door pair (locked → key →
open → key retained), AnyOf tunnel shortcut (gate key path and maintenance
card path independently), AllOf relay room (each item alone fails, both
together succeed), override seal consumption (quantity decrements by 1),
`teleportTo` bridge (known position verifies player X, unknown returns false),
generator door (wrong key rejected, correct key accepted), supervisor door,
rooftop door, lifecycle leak test.

### Bridge additions (facility scene, development only)

`getFacilityState()` returns a plain-data snapshot of `FacilityRuntimeState`:
progression phase, completion flag, and arrays of collected/opened/discovered
IDs. `teleportTo(id)` warps the player to a registered `TeleportDefinition`
and returns a boolean success flag. Both are removed on scene disposal.

### Boot scene override

`access.spec.ts` and `interaction.spec.ts` navigate to `/?scene=access-test`
so they load the Milestone 0.4 scene rather than the new default
`facility-greybox`. The `GameApplication` reads the `?scene=` query parameter
and validates it against `SCENE_IDS` before loading; unknown values fall back
to the default boot scene.
