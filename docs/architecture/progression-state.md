# Progression State — Milestone 0.5

## FacilityRuntimeState

`src/game/facility/FacilityRuntimeState.ts` is a plain TypeScript class (no
Babylon dependency) that tracks all coarse facility progress:

- Current `ProgressionPhase` (string union)
- Set of collected pickup IDs
- Set of opened door IDs
- Set of discovered zone IDs

It is the single source of truth for "what has happened so far" in the
facility scene. It does **not** persist across sessions (Milestone 0.5 is
a greybox prototype).

## ProgressionPhase

`src/game/facility/ProgressionPhase.ts` defines:

```ts
type ProgressionPhase =
  | 'Approach'
  | 'SecurityCheckpoint'
  | 'CompoundEntered'
  | 'ControlBuildingReached'
  | 'GeneratorAccessed'
  | 'RelayRoomAccessed'
  | 'StaffQuartersReached'
  | 'SupervisorOfficeReached'
  | 'RooftopAccessed'
  | 'GreyboxComplete';
```

Helper functions:

- `canAdvancePhase(from, to): boolean` — true for exactly one valid forward
  step (or the bidirectional `ControlBuildingReached`/`GeneratorAccessed` pair)
- `tryAdvancePhase(from, to): ProgressionPhase | null` — returns `to` if valid,
  `null` otherwise
- `comparePhase(a, b): number` — negative/zero/positive ordering
- `isPhaseComplete(phase): boolean` — true iff `phase === 'GreyboxComplete'`

## Subscription model

```ts
const unsub = state.subscribe((snap) => {
  console.log(snap.progressionPhase, snap.isComplete);
});
// later:
unsub();
```

Listeners are called on coarse phase transitions and on first pickup/door/zone
record calls. They are **not** called per frame. Errors thrown inside listeners
are swallowed (logged to console) so a bad listener cannot break progression.

## Snapshot

`state.getSnapshot()` returns a plain-data object safe for serialisation and
for the dev test bridge:

```ts
interface FacilitySnapshot {
  progressionPhase: ProgressionPhase;
  isComplete: boolean;
  collectedPickupIds: string[];
  openedDoorIds: string[];
  discoveredZoneIds: string[];
}
```

## Reset

`state.reset()` returns the instance to its initial `'Approach'` phase and
clears all sets. Used in dev tooling and future save/load integration.

## Milestone 0.7: a sibling model for the signal puzzle, not an extension

Milestone 0.7's receiver/decode puzzle does **not** extend
`FacilityRuntimeState` or `ProgressionPhase` further — it introduces a
separate `ReceiverRuntimeState` (`src/game/receiver/ReceiverRuntimeState.ts`)
and `SignalProgressionPhase` (`src/game/receiver/SignalProgressionPhase.ts`),
constructed alongside `FacilityRuntimeState` by `FacilityGreyboxScene.ts`
rather than folded into it. See `docs/architecture/signal-runtime-state.md`
for the full reasoning and `docs/level-design/power-progression.md` for how
the existing `ReceiverActivated`/`PowerNetworkOperational` phases were
preserved (not removed) with an updated trigger.
