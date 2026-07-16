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
| `ControlRoomPowered → ReceiverActivated`      | The field receiver's `interact()` succeeds (control room powered, not already activated).                                       |
| `ReceiverActivated → PowerNetworkOperational` | Immediately follows, same `interact()` call — one-shot.                                                                         |

Each transition uses `tryAdvancePhase`, so calling it out of order (e.g. the
generator starting before `GreyboxComplete` is reached, which can't happen
through normal play but is exercised directly in unit tests) is a silent
no-op rather than a crash.
