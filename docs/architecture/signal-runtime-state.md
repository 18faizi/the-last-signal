# Signal Runtime State

## Architecture decision: a dedicated model, not a bigger `ProgressionPhase`

Milestone 0.6 already extended the shared `ProgressionPhase`
(`src/game/facility/ProgressionPhase.ts`) with five power-network phases,
bringing it to fifteen values that conflate three unrelated concerns:
world exploration (`Approach`…`RooftopAccessed`), power-network setup
(`GeneratorStarted`…`PowerNetworkOperational`), and — if Milestone 0.7
had appended more — the deeper tune/detect/lock/decode puzzle.

Milestone 0.7 instead introduces a **separate, small, dedicated** phase
chain — `SignalProgressionPhase` (`src/game/receiver/SignalProgressionPhase.ts`)
— tracked by its own container class, `ReceiverRuntimeState`
(`src/game/receiver/ReceiverRuntimeState.ts`), constructed and owned
alongside `FacilityRuntimeState` by `FacilityGreyboxScene.ts` (via
`FacilitySceneContext.receiverRuntimeState`), rather than folding into
`FacilityRuntimeState` itself. Reasoning:

1. **Existing M0.6 milestone preserved as-is.** `'ReceiverActivated'` →
   `'PowerNetworkOperational'` already mean "the receiver hardware is
   powered and reachable" — that's preserved exactly, now firing the first
   time the receiver finishes booting (the direct successor of M0.6's
   one-shot activation) instead of a placeholder click. See
   `docs/level-design/power-progression.md`'s updated trigger table.
2. **The new puzzle is conceptually downstream of that milestone**, not a
   replacement for it — a dedicated chain keeps that relationship explicit
   rather than implicit in enum ordering.
3. **Zero risk to M0.5/M0.6 tests.** `pnpm test` was run immediately after
   adding the `'receiver'` interaction mode and the new runtime-state class
   to confirm every pre-existing `progressionPhase*.test.ts` and
   `facilityRuntimeState*.test.ts` assertion still passes completely
   unmodified — there is no shared table to accidentally perturb.

## SignalProgressionPhase

```
ReceiverOffline → ReceiverOnline → SignalDetected → SignalLocked
  → TransmissionDecoded → SignalPuzzleComplete
```

Strictly linear, monotonic — same `canAdvance`/`tryAdvance`/`compare` shape
as `ProgressionPhase.ts`, for consistency and testability
(`signalProgressionPhase.test.ts`).

| Transition                                   | Fires when                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `ReceiverOffline → ReceiverOnline`           | `ReceiverController` first reaches `Idle` (boot completes).                                                     |
| `ReceiverOnline → SignalDetected`            | A `ChannelActivityDetected` event (candidate quality, or scan pause).                                           |
| `SignalDetected → SignalLocked`              | A `LockAcquired` event.                                                                                         |
| `SignalLocked → TransmissionDecoded`         | A `DecodeCompleted` event.                                                                                      |
| `TransmissionDecoded → SignalPuzzleComplete` | Every `requiredForProgression` signal is in `decodedSignalIds` (currently just `first_anomalous_transmission`). |

All wiring lives in `src/scenes/facility-greybox/signal/facilityReceiverBindings.ts`.

## ReceiverRuntimeState — deliberately narrow scope

Unlike `FacilityRuntimeState`'s power-domain mirror (which duplicates
generator/circuit fields for the F3 overlay and dev-reset), this class
**does not** mirror `ReceiverController`'s continuously-changing tuning
fields (channel, frequency, gain, filter, phase, live lock/decode
progress). Two reasons:

- `ReceiverController.getSnapshot()` is already a plain getter (not a
  per-frame _write_) — the F3/F11 overlays and the dev bridge read it
  directly, exactly like `PowerNetwork.getSnapshot()`.
- `ReceiverController` itself is a long-lived singleton, never recreated
  across checkpoints/respawn (same as `PowerNetwork`/`GeneratorController`)
  — so its state already persists "for free," and re-mirroring continuous
  fields into a second class on every tick would be a pure per-frame-write
  cost for no benefit, violating the "no per-frame writes to secondary
  state" discipline for nothing in return.

`ReceiverRuntimeState` therefore only records the coarse, **event-driven**
milestones: `signalPhase` and `decodedSignalIds` — the same discipline
`FacilityRuntimeState` already applies to door/zone/checkpoint events.

## Persistence across checkpoints / OOB recovery

Neither `ReceiverController` nor `ReceiverRuntimeState` is recreated by the
checkpoint/out-of-bounds respawn path (`FacilityGreyboxScene.ts`'s
`controller.teleportTo(...)` calls never touch either) — respawn preserves
tuning, lock/decode progress, and signal-phase state automatically, the
same way `PowerNetwork`/`GeneratorController` survive respawn already.

## Development full reset

`resetFacility()` (dev bridge) calls `receiverController.reset()` and
`receiverRuntimeState.reset()` alongside the existing power/generator
resets — both return to their power-off/`ReceiverOffline` factory defaults,
clearing `decodedSignalIds` and every live lock/decode controller.
