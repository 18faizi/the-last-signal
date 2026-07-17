# Signal Events

`src/game/signal/SignalEvent.ts` defines one shared typed-event union —
mirrors `PowerEvent.ts`'s "fields optional per-kind, narrow on `kind`"
shape — plus a tiny `SignalEventBus` (subscribe/emit/dispose) used by both
`SignalLockController` and `DecodeController`.

## Kinds

| Kind                      | Emitted by                                                      | Fires when                                                                                                                    |
| ------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ChannelActivityDetected` | `SignalLockController` (also `ReceiverController`'s scan sweep) | Quality first crosses the candidate threshold (`Searching`→`Candidate`), or the scripted scan pauses on the activity channel. |
| `LockAcquired`            | `SignalLockController`                                          | Acquisition progress fills to 1 (`Acquiring`→`Locked`). Exactly once per acquisition.                                         |
| `LockLost`                | `SignalLockController`                                          | Hold quality is exhausted (`Locked`→`Lost`). Exactly once per loss.                                                           |
| `DecodeStarted`           | `DecodeController`                                              | Decode begins accumulating from zero progress.                                                                                |
| `DecodeProgressed`        | `DecodeController`                                              | Progress crosses a new 10%-decile boundary (throttled — not every tick).                                                      |
| `DecodePaused`            | `DecodeController`                                              | Transitions `InProgress`→`Paused` (moderate quality degradation).                                                             |
| `DecodeCompleted`         | `DecodeController`                                              | Progress reaches 1. Exactly once.                                                                                             |

## Forwarding

`ReceiverController` (`src/game/receiver/`) subscribes to every registered
signal's `SignalLockController`/`DecodeController` at `registerSignal()`
time and re-emits their events through its own `subscribe()` — so a single
subscription on `ReceiverController` sees the full stream for whichever
channel is currently tuned. `ReceiverController` also emits
`ChannelActivityDetected` itself from the deterministic scan sweep (see
`receiver-state-model.md`).

Listener errors are swallowed by `SignalEventBus.emit()` (try/catch per
listener), matching every other event bus in the codebase — a broken UI
listener can never corrupt domain state.

## What's NOT an event

Continuous values (current tuning controls, live quality, live progress
percentages) are **not** pushed as events — they're read via
`ReceiverController.getSnapshot()` / `getSignalDefinition()`, polled by the
UI's own render loop (see `docs/development/receiver-ui.md`) or by debug
overlays at a throttled rate. This keeps the event stream to genuinely
discrete, rare occurrences, consistent with every other domain event bus
in this codebase (`PowerEvent`, `GeneratorEvent`).
