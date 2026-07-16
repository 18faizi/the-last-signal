# Facility Greybox Developer Guide — Milestone 0.5

## Running the scene

```bash
pnpm dev
```

The app boots directly to `facility-greybox`. You will see a white-box
facility complex. The player spawns on the mountain approach facing the
compound gate (-58, 0.1, 0, yaw = 0°).

## Controls

| Key            | Action                              |
| -------------- | ----------------------------------- |
| `WASD`         | Move                                |
| `Shift`        | Sprint                              |
| `C` / `Ctrl`   | Crouch                              |
| `Space`        | Jump                                |
| `E`            | Interact (or hold where prompted)   |
| `R`            | Respawn to last checkpoint          |
| `F7`           | Respawn to original spawn point     |
| `F8`           | Toggle teleport menu (dev)          |
| `F9`           | Toggle facility debug overlay (dev) |
| `` ` `` / `F3` | Toggle engine debug overlay (dev)   |
| `F4`           | Toggle player debug overlay (dev)   |
| `F6`           | Toggle interaction-ray debug (dev)  |

## Dev tools

### F8 — Teleport menu

Shows a clickable list of named positions. Click a row to teleport instantly.
No physics is bypassed — the player simply appears at the target position.
Close with `F8` again or `Escape`.

### F9 — Facility debug overlay

Shows:

- Current progression phase and completion flag
- Zone membership (which zones the player is currently inside)
- Zone discovery count
- Opened door IDs
- Collected pickup IDs

Updated every 30 frames.

## Test bridge (browser console)

In development builds `window.__TLS_TEST__` exposes:

```js
// Core (from TestBridge)
__TLS_TEST__.getInventorySnapshot(); // { itemCount, entries: [{itemId, quantity}] }
__TLS_TEST__.collectPickup(id); // force-collect a pickup by ID
__TLS_TEST__.openDoor(id); // attempt to open a door; returns true on success
__TLS_TEST__.getDoorState(id); // { access: 'locked'|'unlocked', physical: 'closed'|'open' }
__TLS_TEST__.getPlayerState(); // { position, velocity, mode, stance, yaw, pitch }
__TLS_TEST__.getDiagnostics(); // { cameraCount, beforeRenderObserverCount }
__TLS_TEST__.teleportTo(id); // teleport to a named position; returns true on success
__TLS_TEST__.getFacilityState(); // { progressionPhase, isComplete, collectedPickupIds, … }
```

Example usage in the browser console:

```js
// Collect the gate key and open the compound gate:
__TLS_TEST__.collectPickup('fg-pickup-compound-gate-key');
__TLS_TEST__.openDoor('fg-door-compound-gate');

// Teleport to the rooftop:
__TLS_TEST__.teleportTo('fg-tp-rooftop');

// Inspect current facility state:
console.log(__TLS_TEST__.getFacilityState());
```

## Adding a new zone

1. Add a `FacilityZoneDefinition` entry to
   `src/scenes/facility-greybox/definitions/facilityZones.ts`.
2. Register it in the appropriate builder via
   `ctx.zoneRegistry.register(def)`.
3. If it triggers a phase change, add a case to the zone → phase map
   in `FacilityGreyboxScene.ts` (`ZONE_PHASE_MAP`).
4. Add a unit test for the AABB (ensure it does not overlap an adjacent zone
   unintentionally).

## Adding a new door

1. Add an `ItemDefinition` to `facilityItems.ts` for any new required item.
2. Build the `AccessRequirement` tree (see `src/game/access/AccessRequirement.ts`).
3. Add the door geometry in the appropriate builder using `FacilityGeometryHelper`
   and register it with `DoorController`.
4. Add a `DoorInteractionTarget` and register it with `InteractionRegistry`.
5. Add the pickup(s) in `facilityPickups.ts` and place them with `createPickup`.
6. Add a `doorGrant` entry to `facilityDoors.ts` for `validateFacilityData`.

## Running tests

```bash
pnpm test          # unit tests (includes 7 facility-specific suites)
pnpm test:e2e      # all Playwright tests (37 total, 15 facility-specific)
```
