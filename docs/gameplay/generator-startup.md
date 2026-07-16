# Generator Startup

The facility generator (`src/game/generator/`) is a nine-state machine gating
the whole power network. Nothing is energized from the generator until the
player has walked the full startup sequence in the generator hall.

## Controls (generator hall, north wall)

| Control                  | Interaction                              | Effect                                                                                    |
| ------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| Status panel             | `[E] VIEW GENERATOR STATUS`              | Marks the generator inspected; `Offline → InspectionRequired → NotReady`.                 |
| Fuel valve               | `[E] OPEN/CLOSE FUEL VALVE`              | Toggles `Closed ↔ Open`.                                                                  |
| Starter battery isolator | `[E] CONNECT/DISCONNECT STARTER BATTERY` | Toggles `Disconnected ↔ Connected`.                                                       |
| Emergency stop           | `[E] RELEASE/ENGAGE EMERGENCY STOP`      | Toggles `Engaged ↔ Released`; engaging while running forces an immediate stop.            |
| Mode selector            | `[E] SET SELECTOR (...)`                 | Cycles `Off → Manual → Automatic → Off`. Only `Manual` allows local starting.             |
| Starter                  | `[HOLD E] START GENERATOR` (2s)          | Attempts a crank once all four conditions are met.                                        |
| Main breaker             | `[E] CLOSE/OPEN MAIN BREAKER`            | Only closable once `Running`; shows `MAIN BREAKER LOCKED — GENERATOR UNSTABLE` otherwise. |

## Readiness

Four conditions gate `ReadyToStart` (see `GeneratorStartupSequence.ts`):
fuel valve open, starter battery connected, emergency stop released, selector
set to Manual. Losing any one of them while `ReadyToStart` drops the
controller back to `NotReady` immediately — there's no grace period, since a
missing condition means the crank truly cannot succeed.

## Startup sequence

1. Inspect the status panel once (flavour gate; also usable later for a
   status readout).
2. Open the fuel valve, connect the battery, release the e-stop, select
   Manual — any order.
3. Hold the starter for 2 seconds. Completion transitions
   `ReadyToStart → Cranking → RunningUnstable` — cranking itself resolves
   synchronously; the 2-second hold _is_ the crank duration, visualized by
   the existing hold-progress UI (no separate "cranking" animation timer).
4. Warm-up: the generator stays `RunningUnstable` for ~5 seconds
   (`GeneratorDefinition.warmUpSeconds`), then settles into `Running`.
5. Close the main breaker. This is the moment the generator actually starts
   supplying the distribution network — see `power-routing.md`.

## Stopping

`stop()` (or engaging the e-stop while running) transitions
`Running/RunningUnstable → Stopping`, opens the main breaker automatically
after ~1 second (`stopDownSeconds`), and returns to `Offline → InspectionRequired
→ NotReady`. Because `stop()` never touches the valve/battery/e-stop/selector
controls, if they were all still satisfied the controller immediately
re-evaluates to `ReadyToStart` — restarting doesn't require re-flipping every
switch.

## Fault

A depleted starter battery (`simulateBatteryDepletion()` — a test/
fault-injection hook, never triggered by normal play; this milestone
explicitly excludes real electrical simulation and random crank failure)
forces `Fault`, recoverable only via `reset()`.
