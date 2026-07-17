# Manual Power Network Test Plan

Companion to `docs/development/manual-facility-test-plan.md`, scoped to
Milestone 0.6. Run through this in a real browser after any change touching
`src/game/power/`, `src/game/generator/`, `src/game/electrical/`, or the
`src/scenes/facility-greybox/power/` builders.

## Generator startup

1. Walk to the generator hall control panel (north wall).
2. `[E]` the status panel → F3 overlay shows `Gen state: NotReady`.
3. Try `[HOLD E]` the starter with the valve closed → prompt shows
   `FUEL VALVE OPEN` as the blocking reason, hold doesn't start.
4. Open the valve, connect the battery, release the e-stop, select Manual
   (any order) → F3 shows `ReadyToStart`; the starter prompt becomes
   `[HOLD E] START GENERATOR`.
5. Hold the starter for the full 2 seconds → engine catches
   (`RunningUnstable`), warm-up begins.
6. Try `[E]` the main breaker during warm-up → prompt/rejection reads
   `MAIN BREAKER LOCKED — GENERATOR UNSTABLE`.
7. Wait ~5s → `Running`. Close the main breaker → succeeds; F3 shows
   `Gen capacity: 1/10 (available)` (the transferred emergency circuit).

## Distribution panel

1. Walk to the control room panel, `[E] OPEN DISTRIBUTION PANEL`.
2. Confirm gameplay input is suspended (mouse look and WASD do nothing
   while the dialog is open) and the interaction prompt is hidden.
3. Turn on Control Room, Cable Tunnel, Staff Quarters — all succeed;
   capacity reads `10/10`.
4. Try Rooftop/Antenna → rejected inline, capacity unchanged, every other
   row stays as it was.
5. `Escape` → dialog closes, gameplay resumes immediately.

## World feedback

1. With Cable Tunnel off, the tunnel indicator lamp (near the tunnel
   junction) is dark. Turn it on → lamp lights, tunnel `PointLight`
   turns on.
2. Walk to the tunnel maintenance door with only the maintenance card (no
   tunnel power) → locked, prompt shows the combined reason. Energize the
   tunnel circuit → door opens.
3. With Control Room off, the field receiver prompt reads `NO POWER`. Turn
   the circuit on → the receiver boots (~1.5s) and the prompt becomes
   `[E] OPERATE SIGNAL RECEIVER`; F3 shows `Power milestone: OPERATIONAL`
   as soon as it finishes booting. See
   `docs/development/manual-signal-receiver-test-plan.md` for the full
   Milestone 0.7 tuning-puzzle test pass (Milestone 0.6's provisional
   one-shot "ACTIVATE RECEIVER" no longer exists — the receiver is now a
   real tunable console).

## Fail-safes

1. With the tunnel door unlocked and open, turn the tunnel circuit back
   off. Confirm the door does **not** slam shut or relock — it stays
   exactly as it was.
2. Fall off a ledge (or use dev respawn) mid-startup with the valve open
   and battery connected → confirm those control states are unchanged
   after respawn (F3 overlay).

## Dev tools

1. `F10` → power debug overlay appears (top-right), lists every
   source/circuit/load; colour-coded markers appear at each indicator
   location. `F10` again → both disappear.
2. Trigger a full reset via the dev bridge (`window.__TLS_TEST__.resetFacility()`
   in devtools console) → generator, panel, and every circuit return to
   boot-time defaults (emergency circuit back on battery power); player
   returns to spawn.

## Production build

`pnpm build && pnpm preview`, then in devtools console:
`window.__TLS_TEST__` → `undefined`. `F10` → no overlay, no console errors.
