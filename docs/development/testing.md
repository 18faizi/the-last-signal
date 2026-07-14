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
