# Signal Debugging

## F11 — signal/receiver debug overlay

Development-only, mirrors the F10 `PowerDebugOverlay` pattern exactly
(`src/scenes/facility-greybox/overlay/SignalDebugOverlay.ts`):

- A DOM text panel (bottom-right, so it doesn't overlap F9/F10's top
  panels) listing receiver mode, boot progress, panel-open/scanning flags,
  the active signal id, every current control value, **target** values for
  the active signal (target frequency + tolerance, target gain range,
  target filter + tolerance, target phase + tolerance, lock threshold),
  per-control quality (channel match, frequency/gain/filter/phase quality
  and their raw errors), overall quality, limiting factor, lock state +
  progress, hold quality, decode state + progress, and the list of decoded
  signal ids — refreshed at a reduced rate (every 15 frames while visible).
- Entirely absent in production builds — only constructed when
  `context.environment.isDevelopment`.

Toggle with `F11`. Unlike the compact F3 rows (current values + computed
quality only), F11 is the one place target/solution values are shown — by
design, so a developer can verify tuning against the answer without that
leaking into anything a player would see.

## F3 — extended debug overlay

`FacilityGreyboxScene.ts`'s `getDebugFields()` gained a compact receiver
summary via `formatReceiverCompactFields()`
(`src/game/receiver/ReceiverDebugView.ts`): receiver mode, channel,
frequency, gain/filter, phase, signal strength, noise, overall quality,
lock state + progress, decode state + progress, decoded count — plus the
signal-progression phase (`ReceiverOffline`…`SignalPuzzleComplete`). No
target values here, consistent with F3's existing "current state only, no
solutions" convention across power/generator rows.

## Dev bridge (`window.__TLS_TEST__`, development only)

Beyond the existing M0.3–0.6 surface, the facility scene adds:

- `getReceiverSnapshot()` — full `ReceiverController.getSnapshot()`
  (mode, controls, boot progress, panel-open/scanning flags, active
  signal id, metrics, lock/decode state + progress, decoded signal ids).
- `getSignalRuntimeSnapshot()` — `ReceiverRuntimeState.getSnapshot()`
  (signal-progression phase, decoded signal ids, transcript availability,
  puzzle-complete flag).
- `openReceiverPanel()` / `closeReceiverPanel()` / `isReceiverPanelOpen()`
  — mirror the distribution-panel bridge trio; `openReceiverPanel()`
  routes through `interaction.devActivate('fg-receiver')`, same headless-
  friendly path `openDistributionPanel()` uses.
- `receiverAction(name, value?)` — `setChannel`, `setFrequency`,
  `setGain`, `setFilter`, `setPhase` (all take `value`); `startScan`,
  `cancelScan`, `resetControls` (no value). Each calls the exact same
  `ReceiverController` method a real keyboard/mouse interaction would —
  **there is no action that sets quality, lock, decode, or completion
  state directly.**
- `getDecodedTranscript(signalId)` — returns the `DocumentDefinition` for
  an already-decoded signal, or `null` if unknown/not yet decoded.
- `getSignalEventCounters()` — cumulative `{ lockAcquired, lockLost,
decodeCompleted, channelActivityDetected }` counts, subscribed once at
  scene creation. Used by the repetition e2e suite to prove completion
  events never double-fire (including across a close/reopen cycle of an
  already-decoded receiver).

`resetFacility()` (existing) now also calls `receiverController.reset()`
and `receiverRuntimeState.reset()` — see `debugging.md`'s Milestone 0.7
section.

**As with the generator's starter hold, none of these bridge functions
set quality/lock/decode/completion state on the player's behalf** — the
only way to actually reach `Locked`/`Decoded`, in tests or in the browser,
is tuning `ReceiverControls` close enough to a real signal's target and
letting the real `SignalEvaluator`/`SignalLockController`/`DecodeController`
do the rest. This is what lets `tests/e2e/signal.spec.ts`'s full-puzzle
test claim it exercises the real evaluator end to end.
