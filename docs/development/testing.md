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

## Milestone 0.6 additions

New unit suites (all Babylon-free): `powerNetwork.test.ts`,
`powerAllocation.test.ts`, `powerValidation.test.ts`, `generatorState.test.ts`,
`generatorController.test.ts`, `breakerController.test.ts`,
`distributionPanelController.test.ts`, `emergencyPowerController.test.ts`,
`powerAccessEvaluator.test.ts` (the new `power` `AccessRequirement` kind,
including the `AllOf` combined-requirement fix below),
`facilityRuntimeStatePower.test.ts`, `progressionPhasePower.test.ts`.

**A real bug caught by these tests**: `AccessEvaluator`'s `all-of` case
originally gated denial purely on `missingItems.length > 0` — a denied
`power` requirement contributes zero missing item ids (there's nothing to
add to inventory), so an `AllOf(item, power)` tree with the item present but
power absent was silently falling through to `allowed`. Fixed by tracking
denial itself (`anyDenied`), not just the accumulated missing-item list; see
`AccessEvaluator.ts`'s `all-of` case and its comment.

New Playwright suite `tests/e2e/power.spec.ts`: generator readiness gating,
bridge-driven startup, the real starter hold (see below), main-breaker
gating, distribution panel open/close, capacity allocation and rejection,
per-load powering, the combined inventory+power tunnel door (including the
fail-safe-on-power-loss case), the receiver's one-shot activation,
respawn/reset preservation, F10 toggling, seven repetition/lifecycle tests,
and a dedicated full-progression test (see below).

### The starter hold: load-robust polling, not a fixed sleep, and used sparingly

Hold progress is driven by simulated delta time. `InteractionSystem.update()`
clamps per-frame delta to 50ms (`Math.min(getDeltaTime()/1000, 0.05)`) — a
pre-existing, project-wide safety clamp, not something introduced for
Milestone 0.6 — and `GeneratorController.update()`'s warm-up accumulator uses
the identical clamp pattern. Under headless SwiftShader running this scene,
directly-measured frame pacing can fall well below 20fps (a clean, otherwise-
idle isolated run still measured ~2fps via `requestAnimationFrame` counting),
which means both the 2-second starter hold and the 5-second warm-up can take
tens of real-world seconds to complete — a fixed `page.waitForTimeout(2300)`
while holding `KeyE` is nowhere near reliable (an isolated diagnostic run
showed only ~0.26 of a 2-second hold's progress after 2.3 real-world seconds).

Consequences applied in `power.spec.ts`:

1. **`holdStarterUntilCranked()`** holds the key down and polls real generator
   state instead of releasing after a fixed delay — robust regardless of host
   load. It retries the hold from scratch (fresh teleport, fresh keydown) if
   an attempt gets cancelled before completing (see bug 4 below) — safe
   because a cancelled hold leaves `GeneratorState` at `ReadyToStart`,
   unchanged, so retrying is exactly what a real player would do.
2. **It's used in exactly one test** — the dedicated full-progression test,
   where the milestone spec requires the real interaction. Every other test
   that merely needs _a running generator_ as setup uses
   `crankGeneratorViaBridge()` (`activateTarget('fg-gen-ctrl-starter')` — the
   same `devActivate` bridge shortcut `facility.spec.ts` already uses for
   pickups/doors; for a `'hold'`-kind target it calls `interact()` — i.e.
   `attemptStart()` — directly, skipping the hold-progress timer without
   setting any generator/circuit/milestone state by hand). The warm-up wait
   itself is unavoidable either way and still uses a 60s poll.

### Full power progression test

`tests/e2e/power.spec.ts`'s "full power progression" test walks the entire
M0.5 chain to `GreyboxComplete` via `teleportTo` + one pickup + one door open
(the same bridge-assisted-movement pattern every other facility test uses),
then drives the **entire** generator startup sequence — every control, and
the 2-second starter hold — through real `[E]` key presses at
eye-height-aligned teleport vantage points (`fg-tp-gen-*` in
`facilityTeleportDefinitions.ts`), closes the main breaker via `[E]`,
energizes the control-room circuit via a real click on the distribution
panel's own DOM toggle button, and activates the receiver via `[E]` —
verifying the phase reaches `PowerNetworkOperational` at the end. No
bridge shortcut ever drives the starter or the panel toggle in this test.

**Four real issues this test caught during development, each root-caused
individually (via direct measurement — dumping live mesh positions, camera
positions and interaction-system state side by side) rather than papered
over with a longer sleep or a higher retry count:**

1. **World geometry — vertical margin**: the battery isolator, e-stop and
   selector control boxes (`buildGeneratorControls.ts`) were built with
   `height: 0.3` centered at `y = 1.6`, giving a top edge at `y = 1.75`. The
   camera's actual settled eye height is `y ≈ 1.77–1.78` (foot height after
   floor collision + `PlayerConfig.standingEyeHeight`) — a couple of
   centimetres _above_ that top edge, so a level (pitch 0) ray passed clean
   over the top of all three boxes and never hit them. Fixed by growing
   those three boxes to `height: 0.5`. See
   `../level-design/facility-power-plan.md` for the full geometry writeup,
   including a second, related clearance bug (equipment-block overlap with
   the standing capsule) found while chasing bug 4 below.
2. **Test design — stale focus**: `FocusStability`'s loss-grace period (see
   `FocusStability.ts`) deliberately keeps the _previous_ focus target alive
   for a short window after the raycast stops hitting it, to bridge
   momentary mesh-boundary misses during normal play. The test's `press()`
   helper originally polled `focusedId` for mere truthiness after each
   teleport — which the stale, still-truthy previous target satisfied
   immediately, so `[E]` sometimes fired on the control just left rather
   than the new one, silently skipping a step. Fixed by polling for the
   _specific_ expected target id at each vantage point (`focusOn()`).
3. **Test design — dropped press**: a fixed `page.waitForTimeout(150)` after
   the keypress is not enough to guarantee the queued interact was actually
   processed. `InteractionSystem` only consumes `interactQueued` on its own
   `onBeforeRenderObservable` tick, and under degraded headless frame pacing
   a single rendered frame can take well over 150ms — a sleep shorter than
   one frame silently drops the press, and the very next `teleportTo()`
   moves on before the interact ever fired. Fixed by having `press()` poll a
   `verify` predicate (the actual expected domain-state change) after the
   keypress instead of guessing a sleep duration, and retry the press itself
   — safely, because it only retries when `verify` still reports the
   pre-press state, never blind, so a toggle control can't get
   double-flipped by the retry.
4. **Product characteristic — zero-grace hold eligibility**: unlike
   focus/prompt display, `InteractionSystem`'s hold-eligibility check
   requires the raycast to hit the target on the _exact_ current frame, with
   none of `FocusStability`'s grace tolerance (`holdEligible = ... &&
eligible !== null`, using the frame-fresh candidate, not the graced
   `this.focus`). Under degraded headless frame pacing a multi-second hold
   can hit a single-frame raycast miss purely by chance — confirmed by
   direct measurement with the player provably stationary (position,
   `document.hasFocus()`, and pointer lock all static throughout one such
   stall) — canceling an otherwise-fine hold partway through. This is a
   real characteristic of a foundational, already-tested mechanic shared by
   other holds in the game, not something to change for one test, so the
   fix lives entirely on the test side: `holdStarterUntilCranked()` retries
   the hold (see above) rather than trusting a single long wait.

### Bridge additions (facility scene, development only)

See `../development/power-debugging.md` for the full list
(`getPowerSnapshot`, `getGeneratorSnapshot`, `generatorAction`,
`requestCircuit`, `toggleCircuit`, the distribution-panel open/close/query
functions, `activateReceiver`, `resetFacility`). All removed on scene
disposal, same as every other bridge extension.

## Milestone 0.7 additions — signal domain and receiver

New pure-logic unit suites (`src/tests/unit/`): `signalEvaluator.test.ts`
(exact target, frequency falloff + out-of-capture-range, gain too-low/
optimal/too-high, filter too-low/optimal/too-high, phase exact + circular
wraparound, channel mismatch capping quality to 0, overall-quality
weighting + clamping, limiting-factor selection, effective-strength/noise/
SNR feedback isolation), `signalLockController.test.ts` and
`decodeController.test.ts` (below/candidate/accumulation/decay/loss,
frame-rate independence, delta clamp, single-fire completion event,
pause-vs-full-loss for decode), `receiverController.test.ts` (boot, open/
reopen, power loss/restoration, decoded-state fast-path restoration, dev
reset, scan determinism), `receiverMode.test.ts`/`signalProgressionPhase.test.ts`
(transition tables), `receiverRuntimeState.test.ts`,
`signalValidation.test.ts` (duplicate ids, every invalid-value case,
missing transcript, the solver-style report against the actual shipped
signal), `interactionModeReceiver.test.ts` (mirrors
`interactionModeInventory.test.ts`), `decodeProgressView.test.ts`
(`selectStatusMessage()` — pure, no DOM needed).

**A real bug caught while writing these tests**: `SignalLockController`'s
original `switch`-based `update()` handled `Searching`→`Acquiring` as a
state-only transition with no accumulation on that same tick, so a
cold-start controller ticked in real per-frame-sized steps fell
consistently one tick short of `Locked` compared to ticking the same total
elapsed time as fewer, larger steps — a genuine frame-rate-independence
violation, not a test artifact. Fixed by restructuring the transition
logic so `Searching`/`Candidate`→`Acquiring` falls through into the
accumulation branch within the same `update()` call (see
`docs/architecture/signal-evaluation.md`'s "Lock and decode accumulation"
section for the full before/after reasoning). `Locked`→`Lost` deliberately
does **not** get the same treatment — `Lost` must remain observable for
exactly one tick, per `receiver-state-model.md`.

**dt-clamp gotcha in test design**: both `SignalLockController.update()`
and `DecodeController.update()` clamp `dt` to a small per-tick maximum
(0.1s) — a single `update(1, quality)` call therefore does **not**
accumulate a full second's worth of progress, it behaves like one capped
0.1s tick (matching `PlayerConfig.maxDeltaTimeSeconds`'s established
precedent of capping a delta spike rather than compensating for it with
substeps). Tests that want N seconds of simulated elapsed time must tick
in real per-frame-sized steps summing to N, exactly like a real render
loop would — a `run()`/`runLocked()` helper in each test file does this.

### `tests/e2e/signal.spec.ts`

Mirrors `power.spec.ts`'s structure and bridge-shortcut discipline exactly:
most tests drive the receiver through `receiverAction`/`getReceiverSnapshot`/
etc. for setup speed, and the bridge's `receiverAction` only ever sets
tuning CONTROL values (channel/frequency/gain/filter/phase) — it never sets
quality/lock/decode/completion state directly; those always flow through
the real `SignalEvaluator`/`SignalLockController`/`DecodeController` driven
by the scene's real per-frame `update()` tick. The dedicated "full signal
puzzle" test additionally drives the control-room power setup and opens
the receiver via a real `[E]` press at the `fg-tp-receiver` vantage point,
tunes via the same control setters (still not a quality/lock/decode
shortcut — they call the identical `ReceiverController` methods a real
keyboard/mouse interaction would), and opens the transcript via a real
click on `.receiver-transcript-open-btn`.

A `getSignalEventCounters()` bridge hook (cumulative `lockAcquired`/
`lockLost`/`decodeCompleted`/`channelActivityDetected` counts, subscribed
once at scene creation) is what several tests use to prove lock/decode
completion events never double-fire — including across a close/reopen
cycle of an already-decoded receiver, which the decoded-state fast path
(see `receiver-state-model.md`) is specifically designed to avoid
re-triggering.
