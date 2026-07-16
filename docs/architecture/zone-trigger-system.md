# Zone Trigger System — Milestone 0.5

## Overview

Zone triggers detect when the player enters or exits a named region of the
world. The implementation uses AABB (axis-aligned bounding box) point-in-box
tests polled from `onBeforeRenderObservable` — **not** Havok physics overlap
queries.

## Why AABB polling instead of physics triggers

- Physics overlap queries require physics bodies on all boundaries, which
  would push the physics body count over the greybox budget.
- AABB tests run in O(n) pure JavaScript with no engine round-trip.
- All facility zones are rectangular rooms; AABB is exact for this geometry.
- Tests can run without a physics world, making them trivially unit-testable.

## ZoneRegistry

`src/game/facility/ZoneRegistry.ts`

Each zone is described by a `FacilityZoneDefinition`:

```ts
interface FacilityZoneDefinition {
  id: string;
  label: string;
  isKeyZone: boolean;
  aabb: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
}
```

`ZoneRegistry.register(def)` adds a zone. `ZoneRegistry.update(position)` is
called once per frame (from the scene's `onBeforeRenderObservable`) with the
player's world position. It computes membership by inclusive `>=` / `<=`
bounds checks, emits `discovered`, `entered`, and `exited` events as needed,
and tracks `discoveredCount` for progression.

Player position is cached at the scene level: the observer only calls
`ZoneRegistry.update()` when the player has moved more than 0.1 m since the
last update.

## TriggerVolumeSet

`src/game/facility/TriggerVolumeSet.ts`

A lighter-weight companion to `ZoneRegistry` for one-off trigger regions
(checkpoint activation, scripted events). Each volume is an AABB with
`onEnter` / `onExit` callbacks and an optional `oneShot` flag. One-shot
volumes automatically deactivate after the first trigger.

## Event flow

```
onBeforeRenderObservable (scene)
  └─ [cache position if Δ > 0.1 m]
       └─ ZoneRegistry.update(pos)
            ├─ aabbContains check per zone
            ├─ emit 'entered' / 'exited' / 'discovered'
            └─ FacilityRuntimeState.recordZoneDiscovered()
                 └─ FacilityRuntimeState.advancePhase()  (if progression zone)
```

## Unit testing

`ZoneRegistry` and `TriggerVolumeSet` have no Babylon dependencies and are
fully unit-tested in `src/tests/unit/zoneRegistry.test.ts` and
`src/tests/unit/triggerVolume.test.ts`.
