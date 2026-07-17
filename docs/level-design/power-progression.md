# Power Progression

Milestone 0.6 extends `ProgressionPhase` (`src/game/facility/ProgressionPhase.ts`)
with a linear chain hanging off the M0.5 terminal phase:

```
GreyboxComplete → GeneratorStarted → MainPowerAvailable → ControlRoomPowered
  → ReceiverActivated → PowerNetworkOperational
```

## Why extend the shared enum rather than add a parallel field

The milestone spec allows either approach, with a preference for whichever
doesn't risk breaking M0.5's existing progression tests. Extending
`ProgressionPhase` turned out to be safe and was kept:

- `TRANSITIONS['GreyboxComplete']` changed from `[]` to `['GeneratorStarted']`
  — purely additive. No M0.5 test asserts that `GreyboxComplete` has _no_
  successors; they assert the _specific_ forward chain into it, which is
  untouched.
- `PHASE_ORDER` gained five new entries appended after `GreyboxComplete` —
  `comparePhase` for every M0.5 phase pair is unaffected.
- `isPhaseComplete()` still checks `phase === 'GreyboxComplete'` only, and
  `FacilityRuntimeState.isComplete` still latches `true` the moment
  `GreyboxComplete` is reached and stays `true` through the rest of the
  power chain (nothing resets it) — so the M0.5 "complete" signal keeps its
  original meaning for anything that only cares about greybox completion.

`pnpm test` confirmed all pre-existing M0.5 progression tests
(`progressionPhase.test.ts`, `facilityRuntimeState.test.ts`) pass unchanged
after this extension; new tests (`progressionPhasePower.test.ts`) cover the
extension itself and its non-interference with the original chain.

## Trigger points

| Transition                                    | Fires when                                                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `GreyboxComplete → GeneratorStarted`          | `GeneratorEvent.GeneratorStarted` (the crank succeeds, entering `RunningUnstable`).                                             |
| `GeneratorStarted → MainPowerAvailable`       | `GeneratorEvent.MainBreakerClosed`.                                                                                             |
| `MainPowerAvailable → ControlRoomPowered`     | The Control Room circuit's `PoweredStateBinding` callback fires `powered = true` (i.e. the player energized it from the panel). |
| `ControlRoomPowered → ReceiverActivated`      | The receiver finishes booting for the first time (`ReceiverController` reaches `Idle`) — see the Milestone 0.7 note below.      |
| `ReceiverActivated → PowerNetworkOperational` | Immediately follows, same boot-completion event — still one-shot.                                                               |

Each transition uses `tryAdvancePhase`, so calling it out of order (e.g. the
generator starting before `GreyboxComplete` is reached, which can't happen
through normal play but is exercised directly in unit tests) is a silent
no-op rather than a crash.

## Milestone 0.7 update: the receiver is no longer a one-shot

M0.6's provisional receiver was a single `interact()` call ("activate")
that fired both `ReceiverActivated` and `PowerNetworkOperational` at once.
Milestone 0.7 replaces that provisional target with a real tunable
receiver console (`docs/gameplay/signal-receiver.md`), so the natural
successor event becomes "the hardware is powered and reachable" — i.e. it
finishes booting — rather than a single click. This preserves the exact
meaning `ReceiverActivated`/`PowerNetworkOperational` always had (the
receiver hardware is live) without redefining it. All wiring lives in
`src/scenes/facility-greybox/signal/facilityReceiverBindings.ts`.

The deeper tune/detect/lock/decode puzzle Milestone 0.7 actually adds is
tracked by a **separate**, dedicated phase chain (`SignalProgressionPhase`
— see `docs/architecture/signal-runtime-state.md`), not appended here —
this table was already five phases deep into what started as pure
world-exploration progression; a sixth concern (the receiver puzzle) got
its own model instead of extending this one further.
