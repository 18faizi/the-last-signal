# Input suspension

## Token-based locks

`FirstPersonController.acquireInputLock(reason)` returns a unique token;
`releaseInputLock(token)` releases exactly that token. Gameplay locomotion
and look are suspended while **any** token is held (`InputLockSet`,
`src/game/player/InputLock.ts`). Because tokens are object identities:

- inspection and reading (and future menus/cutscenes) can overlap safely —
  releasing one lock never resumes input while another remains;
- double-release is a no-op;
- two locks with the same reason are still independent.

Reasons (`inspection` | `document` | `transition` | `inventory` |
`power-panel` | `receiver` | `antenna-panel`) are labels for debugging
(shown in the debug overlay), not keys. `power-panel` (M0.6) is
acquired/released by `PowerPanelSession`
(`src/game/interaction/power/PowerPanelSession.ts`), which mirrors
`DocumentController` almost exactly: acquire on open, suppress the
pointer-lock prompt, release pointer lock (the distribution panel dialog
needs a free cursor to click its toggle buttons), release the lock on
close. `receiver` (M0.7) is acquired/released by `ReceiverPanelSession`
(`src/game/interaction/receiver/ReceiverPanelSession.ts`), which mirrors
`PowerPanelSession` exactly — including the same one-directional close
flow (the session's `close()` calls into `ReceiverPanelView.close()`,
never the reverse). `antenna-panel` (M0.8) is acquired/released by
`AntennaPanelSession`
(`src/game/interaction/antenna/AntennaPanelSession.ts`), which mirrors
`ReceiverPanelSession` exactly — same acquire-on-open/release-on-close
shape, same one-directional close flow.

## What suspension does

The controller's per-frame update computes
`movementActive = (pointerLocked || devBypass) && windowFocused && !locked`.
While suspended: movement intent is idle (the motor keeps integrating, so
velocity settles and gravity still applies — the player never floats),
look deltas are ignored, and queued edge actions (jump, dev-reset R) are
discarded. The `InputManager` itself is untouched — suspension is a
routing decision in the controller, so overlays (inspection rotation) can
still read the same frame snapshot via `controller.currentSnapshot`.

## Resuming without stale input

When the last lock is released the controller:

1. resets its edge-detection baseline to the _current_ pressed-key set —
   keys held before/during the overlay cannot produce press edges, so
   leaving a document never fires a buffered jump or re-starts movement
   from a key pressed minutes ago (a fresh keydown is required);
2. clears the queued jump/reset edges;
3. pointer deltas need no clearing — the snapshot cycle resets them every
   frame, and the controller additionally drops the first delta after any
   pointer-lock re-acquisition to prevent relock camera jumps.

## Mode routing for the R conflict

`R` is both dev-respawn (gameplay) and inspection-reset (inspecting). The
InputManager action event fans out to both systems, but the player
controller discards its R while input is locked and the InteractionSystem
handles R only while `mode === 'inspecting'` — the two can never fire on
the same press.

`R` is also the receiver panel's "reset tuning controls" key (M0.7). Unlike
inspection-reset, the receiver panel doesn't route through
`InputAction`/`InputManager` at all for its tuning keys — it attaches its
own scoped `document.addEventListener('keydown', ...)` while open (the
same technique `DistributionPanelView`/`DocumentReaderView` already use for
Escape), so `InputManager`'s window-level listener and the panel's
document-level listener both see the same keydown. `InputManager` still
queues a `ResetPlayer` action from it, but since the `receiver` input lock
is held for the panel's entire lifetime, `movementActive` is false and
`FirstPersonController.update()` discards the queued action before it
could ever call `respawn()` — the two still never fire on the same press.
See `docs/development/receiver-ui.md`'s "Input handling" section for the
full key list.

The antenna panel (M0.8) also reserves `R` (park the selected array) and
`Space` (emergency stop) while open, via the same scoped
`document.addEventListener('keydown', ...)` technique — never through
`InputAction`/`InputManager` — so it can never collide with dev-respawn or
jump even though it reuses the same physical keys. See
`docs/development/antenna-panel.md`.
