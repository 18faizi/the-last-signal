# Facility Scene Architecture — Milestone 0.5

## Entry point

`src/scenes/facility-greybox/FacilityGreyboxScene.ts` exports
`facilityGreyboxSceneDefinition`, a `SceneDefinition` with id
`'facility-greybox'`. It is the boot scene from Milestone 0.5 onward.

## Module tree

```
src/scenes/facility-greybox/
  FacilityGreyboxScene.ts          — SceneDefinition, wiring, observer, bridge
  FacilitySceneContext.ts          — shared context bag (services, registries, scene)
  FacilityMaterials.ts             — 12-material FacilityPalette (StandardMaterial)
  FacilityGeometryHelper.ts        — wraps CourseBuilder; adds stairs(), railing()
  builders/
    buildMountainApproach.ts       — exterior approach terrain
    buildCompoundExterior.ts       — outer compound walls, courtyard
    buildMaintenanceTunnel.ts      — underground tunnel shortcut
    buildControlBuilding.ts        — main building interior, basement stairs
    buildGeneratorRoom.ts          — generator sub-room
    buildRelayRoom.ts              — antenna relay equipment room
    buildRooftop.ts                — rooftop access and antenna structure
    buildSupervisorOffice.ts       — supervisor's office area
    buildStaffQuarters.ts          — staff sleeping quarters
  definitions/
    facilityItems.ts               — InventoryItemDefinition[] (7 items)
    facilityDoors.ts               — DoorDefinition[] with AccessRequirement trees
    facilityPickups.ts             — PickupDefinition[] (7 pickups)
    facilityZones.ts               — FacilityZoneDefinition[] (9 zones)
    facilityCheckpoints.ts         — CheckpointDefinition[] (4 checkpoints)
    facilityTeleports.ts           — TeleportDefinition[] (6 teleport positions)
  overlay/
    FacilityDebugOverlay.ts        — F9 overlay: phase, zones, doors, pickups
    TeleportMenuOverlay.ts         — F8 overlay: list of teleport positions

src/game/facility/
  ProgressionPhase.ts              — phase union type + canAdvancePhase / tryAdvancePhase
  FacilityRuntimeState.ts          — coarse state object: phase, collected IDs, subscribe
  FacilityZone.ts                  — FacilityZoneDefinition type
  ZoneRegistry.ts                  — AABB membership + discovered/entered/exited events
  TriggerVolumeSet.ts              — one-shot or repeatable enter/exit callbacks
  CheckpointDefinition.ts          — checkpoint type
  CheckpointRegistry.ts            — register, activate, latestCheckpoint
  TeleportDefinition.ts            — teleport type + validateTeleportDefinition
  TeleportRegistry.ts              — register, get, getAll, clear
  FacilityValidator.ts             — static validation (duplicates, softlocks, refs)
```

## Scene creation sequence

1. Create Babylon `Scene` and configure rendering (gravity, fog, ambient light).
2. Instantiate services: `InventoryService`, `PickupRegistry`, `DoorController`,
   `InteractionRegistry`, `InteractionSystem`.
3. Instantiate facility registries: `ZoneRegistry`, `TriggerVolumeSet`,
   `CheckpointRegistry`, `TeleportRegistry`, `FacilityRuntimeState`.
4. Create `FacilityMaterials` (palette) and `FacilityGeometryHelper`.
5. Assemble `FacilitySceneContext` from all of the above.
6. In development: run `validateFacilityData()` and `console.warn` any problems.
7. Run all 9 builder functions, each receiving the context.
8. Create `FirstPersonController` at the spawn checkpoint.
9. Wire input: `F7` respawn, `F8` teleport menu toggle, `F9` facility debug toggle.
10. Register teleport definitions; wire `TeleportMenuOverlay`.
11. Create `FacilityDebugOverlay`.
12. Install the dev test bridge extensions (`getFacilityState`, `teleportTo`).
13. Register `onBeforeRenderObservable`: AABB zone polling + progression advance +
    out-of-bounds respawn (Y < -10).

## Performance constraints (greybox)

| Resource                   | Target |
| -------------------------- | ------ |
| Mesh count                 | < 600  |
| Physics bodies             | < 120  |
| `onBeforeRender` observers | < 20   |

Zones are polled by AABB position tests only (no Havok overlap queries). Player
position is cached with a 0.1 m change threshold so zone tests run only on
meaningful movement.

## Disposal

All resources are collected into a `DisposableBag` on the returned
`SceneHandle`. Disposing the scene removes all observers, overlays, and the
test bridge extensions. The Babylon scene itself is disposed last.

## Milestone 0.6 additions

`FacilitySceneContext` gained five new fields: `powerNetwork`,
`generatorController`, `distributionPanel`, `emergencyPower`, and
`powerQuery` (the `PowerAccessQuery` fed to doors that combine item + power
requirements — see `../gameplay/powered-access.md`). New modules:

```
src/scenes/facility-greybox/power/
  facilityPowerDefinitions.ts   — 2 sources, 7 circuits, 14 loads
  facilityPowerBindings.ts      — bindEmissiveToCircuit / bindLightToCircuit helpers
  buildGeneratorControls.ts     — generator hall control panel geometry + targets
  buildDistributionPanel.ts     — panel geometry + panel target + field receiver
  buildPoweredIndicators.ts     — one indicator lamp + PointLight per circuit
src/scenes/facility-greybox/overlay/
  PowerDebugOverlay.ts          — F10 overlay (mirrors FacilityDebugOverlay)
```

`buildGeneratorControls.ts` is called from inside `buildGeneratorBuilding.ts`
(the existing generator building builder); `buildDistributionPanel.ts` and
`buildPoweredIndicators.ts` are called directly from
`FacilityGreyboxScene.ts` after the existing builder sequence, since they
touch multiple already-built areas (control room + zone-spanning indicator
lamps) rather than extending a single existing room. `buildPoweredIndicators`
returns its `PoweredStateBinding[]` for the scene to dispose on teardown —
they're plain `PowerNetwork` subscriptions, not owned by any
`InteractionTarget`.

Scene creation sequence gained, between steps 5 and 6: register power
sources/circuits/loads with `PowerNetwork`, run `validatePowerNetworkData()`
(development only, throws on integrity failure — unlike the softer
`validateFacilityData()` warning), construct breakers/panel/emergency-power
controllers, and call `emergencyPower.initializeEmergencyPower()` so the
emergency circuit is live from the very first frame. `F10` was added
alongside `F7`–`F9` in the input-wiring step.
