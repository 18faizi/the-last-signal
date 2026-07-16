# Progression System — Milestone 0.5

The facility uses a monotonic phase-based progression system. Each phase
represents a coarse narrative beat. Phases advance as the player reaches
key zones and completes objectives.

## Phase state machine

```
Approach
  └→ SecurityCheckpoint
       └→ CompoundEntered
            ├→ ControlBuildingReached
            │    └→ GeneratorAccessed ←┐
            └→ GeneratorAccessed       │
                 └→ ControlBuildingReached (bidirectional branch)
                      └→ RelayRoomAccessed
                           └→ StaffQuartersReached
                                └→ SupervisorOfficeReached
                                     └→ RooftopAccessed
                                          └→ GreyboxComplete
```

The `ControlBuildingReached` ↔ `GeneratorAccessed` pair forms the only
bidirectional branch in the graph: the player may reach either before the
other.

## Progression API

All progression is managed through `FacilityRuntimeState`
(`src/game/facility/FacilityRuntimeState.ts`):

```ts
state.advancePhase('CompoundEntered'); // advances if valid
state.recordPickupCollected('fg-pickup-gate-key');
state.recordDoorOpened('fg-door-compound-gate');
state.recordZoneDiscovered('fg-zone-compound-exterior');

const snap = state.getSnapshot();
// { progressionPhase, isComplete, collectedPickupIds, openedDoorIds, discoveredZoneIds }
```

Phase changes emit a notification to subscribed listeners. Listeners are
called once per coarse change, not per frame.

## Rules

- Phases are strictly monotonic: you cannot go back.
- `canAdvancePhase(from, to)` returns `true` only for a single valid forward
  step (or the bidirectional branch pair).
- `isPhaseComplete(phase)` returns `true` when `phase === 'GreyboxComplete'`.
- `getSnapshot()` returns a plain-data copy — no Babylon objects, safe to
  serialise.

## Zone → phase mapping (scene)

The facility scene polls the player's AABB position every frame and calls
`state.advancePhase()` when the player enters a key zone for the first time:

| Zone entered                | Phase advanced to         |
| --------------------------- | ------------------------- |
| `fg-zone-compound-exterior` | `CompoundEntered`         |
| `fg-zone-control-building`  | `ControlBuildingReached`  |
| `fg-zone-generator-room`    | `GeneratorAccessed`       |
| `fg-zone-relay-room`        | `RelayRoomAccessed`       |
| `fg-zone-staff-quarters`    | `StaffQuartersReached`    |
| `fg-zone-supervisor-office` | `SupervisorOfficeReached` |
| `fg-zone-rooftop`           | `RooftopAccessed`         |
| (all key zones discovered)  | `GreyboxComplete`         |
