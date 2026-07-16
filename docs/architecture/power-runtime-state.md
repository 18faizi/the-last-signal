# Power Runtime State

`FacilityRuntimeState.ts` (spec §27) gained a plain, serializable
`PowerRuntimeSnapshot` mirror alongside its existing zone/door/pickup/phase
tracking:

```ts
interface PowerRuntimeSnapshot {
  generatorState: string;
  fuelValve: string;
  starterBattery: string;
  emergencyStop: string;
  controlSelector: string;
  mainBreaker: string;
  circuits: Record<string, { requested: string; effective: string }>;
  sourceAvailability: Record<string, string>;
  receiverActivated: boolean;
  powerNetworkOperational: boolean;
}
```

## It's a read model, not a second source of truth

`GeneratorController` and `PowerNetwork` remain the canonical live state —
this mirror exists so `getFacilityState()` (the dev/test bridge surface) can
expose power state alongside the existing progression snapshot without a
separate bridge function per subsystem, and so a future save-game layer has
one place to serialize from. `FacilityGreyboxScene.ts` wires it with two
subscriptions set up once at scene creation:

```ts
generatorController.subscribe((event) => {
  /* mirror every control field */
});
powerNetwork.subscribe((event) => {
  /* mirror circuit/source fields touched by this event */
});
```

Exactly like the rest of `FacilityRuntimeState`, these are coarse,
event-driven writes — never per-frame.

## Why preservation is automatic

Checkpoint respawn and out-of-bounds recovery
(`FacilityGreyboxScene.ts`'s `zoneObserver`) only ever call
`controller.teleportTo(...)` on the _player_. They never touch
`facilityState`, `powerNetwork`, or `generatorController`. Since those three
services live for the entire scene lifetime and are only ever reset by the
explicit dev "full reset" action (`resetFacility()` on the test bridge —
see `distribution-panel.md` and `debugging.md`), the generator never stops,
the panel never resets, and no startup sequence ever re-triggers itself as a
side effect of falling off a ledge. This is deliberate, not incidental: the
respawn path's simplicity _is_ the preservation guarantee, verified by
`tests/e2e/power.spec.ts`'s "respawn preserves generator and power state"
test.

## What full reset clears

`resetFacility()` (dev-only) calls, in order: `facilityState.reset()`,
`powerNetwork.reset()`, `generatorController.reset()`, every
`BreakerController.reset()`, `distributionPanel.closePanel()`, and
re-runs `emergencyPower.initializeEmergencyPower()` — restoring the exact
boot-time state (battery powering the emergency circuit, everything else
off), then teleports the player back to the scene's spawn position.
