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
