# Generator State Model

`src/game/generator/GeneratorState.ts` defines a nine-state machine with an
explicit transition table (`canTransitionGeneratorState` /
`tryTransitionGeneratorState`), mirroring `DoorState.ts` and
`ProgressionPhase.ts`'s pattern: illegal transitions are rejected, not
silently coerced.

```
Offline → InspectionRequired → NotReady ⇄ ReadyToStart → Cranking ─┬→ RunningUnstable → Running
                                                                     └→ Fault
RunningUnstable/Running → Stopping → Offline
RunningUnstable/Running → Fault → Offline (reset only)
```

`NotReady ⇄ ReadyToStart` is driven by `reevaluateReadiness()`, called after
every control change — losing any of the four readiness conditions while
`ReadyToStart` drops straight back to `NotReady`, no grace period.

## Cranking is synchronous

There is no async engine simulation. `attemptStart()` (called once by
`GeneratorInteractionTargets`'s starter target, on hold completion) moves
`ReadyToStart → Cranking → RunningUnstable` within a single call — the
`GeneratorCranking` event still fires for observability, but the _visible_
2-second crank duration is entirely the existing hold-progress UI
(`HoldInteraction.ts`, M0.3), not a second timer inside the domain layer.

## Warm-up and stop-down: scoped, disposable timers

Per the milestone's explicit constraint, warm-up
(`RunningUnstable → Running`, ~5s) and stop-down (`Stopping → Offline`, ~1s)
are **not** `setTimeout`/`setInterval`. `GeneratorController.update(deltaSeconds)`
accumulates delta time into `warmUpElapsed`/`stopElapsed` and transitions once
the configured duration is reached. The Babylon-facing adapter
(`GeneratorInteractionTargets`'s status-panel target) is the _only_ thing
that calls `update()`, from a single `onBeforeRenderObservable` hook —
exactly mirroring how `DoorInteractionTarget` drives `DoorController.update()`.
Disposing that one target removes the observer; the controller itself holds
no timer handles to leak.

## Controls (not part of the state machine, but readiness inputs)

`FuelValveState`, `StarterBatteryState`, `EmergencyStopState`,
`ControlSelectorState`, `MainBreakerState` are independent small enums owned
by `GeneratorController`. See `docs/gameplay/generator-startup.md` for their
gameplay meaning.

### Starter battery: simplified to 3 states

The milestone text mentions `Disconnected/Connected/Depleted/Ready`. Since
the battery "may begin disconnected but charged" — i.e. connecting always
succeeds immediately, no charge-up delay — `Connected` and `Ready` collapse
into one state (`Connected`). `Depleted` exists as a terminal fault state
reachable only through `simulateBatteryDepletion()`, a test/fault-injection
hook never triggered by normal play (this milestone explicitly excludes real
electrical simulation and random crank failure).

## Events

`GeneratorEvent.ts` — see `power-events.md`.
