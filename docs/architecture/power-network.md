# Power Network Architecture

`src/game/power/` is the pure-TypeScript domain layer for facility
electrical power. No Babylon, no DOM, no audio — rendering observes this
layer through typed events (`PowerEvent`) and read-only queries; it never
defines power state itself.

## Three distinct concepts

Per the milestone's non-negotiable constraint, Source/Circuit/Load are three
separate typed entities, not collapsed into per-object booleans:

- **`PowerSource`** (`PowerSource.ts` / `PowerSourceState.ts`) — a generator
  or emergency battery. Has a kind, display name, `maxCapacity`, and a
  runtime `availability` (`offline` | `available`) plus `allocatedCapacity`.
- **`PowerCircuit`** (`PowerCircuit.ts` / `PowerCircuitState.ts`) — a named,
  capacity-costed group of loads switched as a unit. Has a `requested`
  state (what the player asked for) and an `effective` state (what's
  actually happening — they can differ after a rejected request) plus the
  `sourceId` currently supplying it.
- **`PowerLoad`** (`PowerLoad.ts` / `PowerLoadState.ts`) — a single lamp,
  terminal, door actuator, etc. belonging to exactly one circuit, with a
  `powered` boolean derived entirely from its circuit's effective state.

## PowerNetwork — the orchestrator

`PowerNetwork` owns all three registries and is the only thing that mutates
their runtime state. Its API:

- `registerSource/Circuit/Load(def)` — throws on duplicate ids or dangling
  circuit references.
- `requestCircuit(circuitId, sourceId, 'on' | 'off')` — the one path that
  changes circuit state. **Atomic**: it calls `validateAllocation()`
  (`PowerAllocation.ts`, a pure function) to build a full plan _before_
  touching anything; on rejection, nothing is mutated and an
  `allocation-rejected` event fires with a reason. On success, the plan is
  applied as a single unit — source capacity, circuit state, and every
  affected load's `powered` flag update together, followed by
  `circuit-energized`/`circuit-de-energized` and `load-powered`/
  `load-unpowered` events.
- `setSourceAvailability(sourceId, 'offline' | 'available')` — going
  offline cascades: every circuit currently drawn from that source is
  de-energized atomically (no "phantom" allocated capacity left behind).
- `transferCircuits(fromSourceId, toSourceId)` — best-effort re-homing used
  by `EmergencyPowerController`; a circuit that doesn't fit on the target
  stays put rather than being dropped.
- `getSnapshot()` — an immutable `PowerSnapshot` for debugging, UI, and
  tests.
- `subscribe(listener)` — returns a disposable unsubscribe function, same
  shape as `InventoryService.subscribe`.
- `reset()` — power-off defaults (dev "full reset" only; never called by
  checkpoint/OOB recovery).

## Capacity math

`PowerCapacity.ts` holds the arithmetic (`remainingCapacity`,
`canFitAdditionalCost`) — trivial on purpose, kept separate so
`PowerAllocation.ts`'s validation logic reads as a sequence of named checks
rather than inline arithmetic.

## Validation

`PowerValidation.ts` mirrors `FacilityValidator.ts`'s contract: a pure
function over plain definition arrays, run once at scene creation in
development builds, throwing a descriptive error on integrity failure. See
`power-validation.md` for the full check list.

## Why not Zustand

Per the M0.4 `InventoryService` precedent, this is domain-service state with
typed events — never written into Zustand every frame. The distribution
panel UI, indicator lights, and debug overlays all observe `PowerNetwork`
through `subscribe()` or `PoweredStateBinding`, not through a store.

## Milestone 0.7: the signal receiver reuses this layer unchanged

The receiver console (`docs/architecture/receiver-state-model.md`) is
powered through the exact same `PoweredStateBinding.forCircuit()`
mechanism as every other powered load — `ReceiverController.powerOn()`/
`powerOff()` are called by a subscription in
`src/scenes/facility-greybox/signal/facilityReceiverBindings.ts`, never by
the receiver polling `PowerNetwork` itself. Nothing in `src/game/power/`
changed for Milestone 0.7.

## Milestone 0.8: the antenna cabinet reuses this layer unchanged too

The rooftop antenna cabinet (`docs/architecture/antenna-state-model.md`)
is powered through the same `fg-circuit-rooftop-antenna` circuit that
already existed from M0.6 (previously feeding only the deck lights/beacon)
and the exact same `PoweredStateBinding.forCircuit()` mechanism —
`AntennaController.powerOn()`/`powerOff()` are called by a subscription in
`src/scenes/facility-greybox/antenna/facilityAntennaBindings.ts`, never by
polling `PowerNetwork` directly. Power loss routes every registered array
to `Offline` and freezes (never discards) in-flight mechanical positions —
see `antenna-state-model.md`. Nothing in `src/game/power/` changed for
Milestone 0.8.

## Milestone 0.9: power state as a perception input and event condition

Nothing in `src/game/power/` changed for Milestone 0.9 either. The threat
layer consumes power state strictly through the existing public surface:
the event director's `circuit-energized` condition queries
`PowerNetwork.isCircuitEnergized()` via a narrow context callback, the
exposure model reads the control-room circuit's energized state (powered
zones = higher visual exposure; unpowered = concealment), and the
generator's `GeneratorStarted` event is translated into one large authored
sound stimulus by a subscription in `buildThreatEventBindings.ts` — the
generator itself is untouched.
