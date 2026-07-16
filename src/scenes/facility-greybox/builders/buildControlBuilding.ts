/**
 * Control building builder.
 *
 * Two-story structure: x ∈ [-10, 10], z ∈ [12, 27]
 *   Floor 0 (y ∈ [0, 3]): lobby, main control room, archive (optional), stairwell
 *   Floor 1 (y ∈ [3, 6]): upper relay room, roof corridor
 *   Rooftop (y = 6): antenna deck (separate builder)
 *
 * Items placed here:
 *   - Generator key (duty desk, control room)
 *   - Archive key (filing cabinet)
 *   - F3 debug overlay fields contributed via facilityState
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import { DoorController } from '../../../game/doors/DoorController';
import { DoorInteractionTarget } from '../../../game/doors/DoorInteractionTarget';
import { createPickup } from '../../../game/pickups/PickupController';
import { createReadableDocument } from '../../interaction-test/testTargets/documentTargets';
import {
  DOOR_DEF_CONTROL_ENTRANCE,
  DOOR_DEF_ARCHIVE,
  DOOR_DEF_TUNNEL_SHORTCUT,
} from '../facilityDoorDefinitions';
import { FACILITY_PICKUP_DEFS } from '../facilityItemDefinitions';

export function buildControlBuilding(ctx: FacilitySceneContext, scene: Scene): void {
  const { geo, materials } = ctx;

  // ----- Floor 0 exterior walls -------------------------------------------
  // South wall (with entrance opening)
  geo.wallWithOpening('ctrl-s-wall', {
    cx: 0,
    cy: 1.5,
    cz: 12,
    wallW: 20,
    wallH: 3,
    wallD: 0.4,
    openW: 2,
    openH: 2.5,
    openOffsetX: 0,
    color: materials.palette.exterior.diffuseColor,
  });
  // North wall
  geo.wall('ctrl-n-wall', {
    cx: 0,
    cy: 1.5,
    cz: 27,
    w: 20,
    h: 3,
    d: 0.4,
    color: materials.palette.exterior.diffuseColor,
  });
  // East wall
  geo.wall('ctrl-e-wall', {
    cx: 10,
    cy: 1.5,
    cz: 19.5,
    w: 0.4,
    h: 3,
    d: 15,
    color: materials.palette.exterior.diffuseColor,
  });
  // West wall
  geo.wall('ctrl-w-wall', {
    cx: -10,
    cy: 1.5,
    cz: 19.5,
    w: 0.4,
    h: 3,
    d: 15,
    color: materials.palette.exterior.diffuseColor,
  });
  // Floor 0 floor
  geo.floor('ctrl-f0', { cx: 0, cy: 0, cz: 19.5, w: 20, d: 15 });
  // Floor 0 ceiling / floor 1 floor
  geo.ceiling('ctrl-f0-ceil', { cx: 0, cy: 3, cz: 19.5, w: 20, d: 15 });

  // ----- Floor 0 interior divisions ----------------------------------------
  // Lobby partition wall (separates lobby from control room)
  geo.wallWithOpening('ctrl-lobby-div', {
    cx: 0,
    cy: 1.5,
    cz: 16,
    wallW: 20,
    wallH: 3,
    wallD: 0.3,
    openW: 2,
    openH: 2.5,
    openOffsetX: 0,
  });

  // Archive partition (east half of control room)
  geo.wallWithOpening('ctrl-archive-div', {
    cx: 5,
    cy: 1.5,
    cz: 20,
    wallW: 10,
    wallH: 3,
    wallD: 0.3,
    openW: 0, // sealed wall; door is separate
    openH: 0,
    openOffsetX: 0,
  });

  // ----- Entrance door (unlocked) -----------------------------------------
  const entranceDoor = new DoorController(
    DOOR_DEF_CONTROL_ENTRANCE,
    new Vector3(0, 1.2, 12),
    scene,
    ctx.inventory,
    ctx.itemRegistry,
  );
  ctx.doorRegistry.register(entranceDoor);
  const entranceTarget = new DoorInteractionTarget(entranceDoor, scene);
  ctx.interactionRegistry.register(entranceTarget);

  // ----- Archive door (optional, locked) ----------------------------------
  const archiveDoor = new DoorController(
    DOOR_DEF_ARCHIVE,
    new Vector3(5, 1.1, 20),
    scene,
    ctx.inventory,
    ctx.itemRegistry,
  );
  ctx.doorRegistry.register(archiveDoor);
  const archiveTarget = new DoorInteractionTarget(archiveDoor, scene);
  ctx.interactionRegistry.register(archiveTarget);

  // ----- Equipment racks in control room ----------------------------------
  for (let i = 0; i < 3; i++) {
    geo.equipmentSolid(`ctrl-rack-${i}`, {
      cx: -7 + i * 3,
      cy: 1,
      cz: 24,
      w: 0.7,
      h: 2,
      d: 0.5,
    });
  }

  // Communications desk
  geo.equipmentSolid('ctrl-comm-desk', { cx: -4, cy: 0.45, cz: 18, w: 4, h: 0.9, d: 1.2 });

  // Facility map (wall decal — decorative equipment block)
  geo.equipment('ctrl-map', { cx: -9.7, cy: 1.5, cz: 20, w: 0.1, h: 1.5, d: 2.5 });

  // Duty desk (where generator key lives)
  geo.equipmentSolid('ctrl-duty-desk', { cx: 3, cy: 0.45, cz: 17, w: 2, h: 0.9, d: 1 });

  // ----- Generator key pickup (on duty desk) ------------------------------
  const genKeyDef = FACILITY_PICKUP_DEFS.find((p) => p.id === 'fg-pickup-generator-key');
  if (genKeyDef !== undefined) {
    const target = createPickup(
      genKeyDef,
      new Vector3(3, 1.1, 16.5),
      scene,
      ctx.inventory,
      ctx.interactionRegistry,
    );
    ctx.pickupRegistry.register(target);
  }

  // ----- Archive key (optional, filing cabinet) ---------------------------
  const archiveKeyDef = FACILITY_PICKUP_DEFS.find((p) => p.id === 'fg-pickup-archive-key');
  if (archiveKeyDef !== undefined) {
    const target = createPickup(
      archiveKeyDef,
      new Vector3(-6, 1.1, 23),
      scene,
      ctx.inventory,
      ctx.interactionRegistry,
    );
    ctx.pickupRegistry.register(target);
  }

  // Archive document (inside archive area)
  const archiveDoc = createReadableDocument(scene, new Vector3(7, 1.0, 23), {
    id: 'fg-doc-archive-readable',
    documentId: 'doc-archive-report',
    label: 'SIGNAL ANOMALY REPORT',
    rotationY: 0.2,
  });
  ctx.interactionRegistry.register(archiveDoc);

  // ----- Stairwell (NW corner) -------------------------------------------
  // Stairwell box enclosure
  geo.wall('ctrl-stair-e', { cx: -4, cy: 3, cz: 26, w: 0.3, h: 3, d: 2 });
  geo.wall('ctrl-stair-w', { cx: -10, cy: 3, cz: 26, w: 0.3, h: 3, d: 2 });
  geo.wall('ctrl-stair-n', { cx: -7, cy: 3, cz: 27, w: 6.3, h: 3, d: 0.3 });

  // Stair steps (going up from floor 0 to floor 1)
  geo.stairs('ctrl-up', {
    x0: -7,
    y0: 0,
    z0: 24.5,
    stepW: 3,
    stepH: 0.3,
    stepD: 0.4,
    count: 10,
  });

  // ----- Floor 1 exterior walls -------------------------------------------
  geo.wall('ctrl-f1-s-wall', {
    cx: 0,
    cy: 4.5,
    cz: 12,
    w: 20,
    h: 3,
    d: 0.4,
    color: materials.palette.exterior.diffuseColor,
  });
  geo.wall('ctrl-f1-n-wall', {
    cx: 0,
    cy: 4.5,
    cz: 27,
    w: 20,
    h: 3,
    d: 0.4,
    color: materials.palette.exterior.diffuseColor,
  });
  geo.wall('ctrl-f1-e-wall', {
    cx: 10,
    cy: 4.5,
    cz: 19.5,
    w: 0.4,
    h: 3,
    d: 15,
    color: materials.palette.exterior.diffuseColor,
  });
  geo.wall('ctrl-f1-w-wall', {
    cx: -10,
    cy: 4.5,
    cz: 19.5,
    w: 0.4,
    h: 3,
    d: 15,
    color: materials.palette.exterior.diffuseColor,
  });
  // Floor 1 ceiling (becomes rooftop base)
  geo.ceiling('ctrl-f1-ceil', { cx: 0, cy: 6, cz: 19.5, w: 20, d: 15 });

  // ----- Relay room (F1, optional gated) ----------------------------------
  // Relay room divider
  geo.wallWithOpening('ctrl-relay-div', {
    cx: 0,
    cy: 4.5,
    cz: 20,
    wallW: 20,
    wallH: 3,
    wallD: 0.3,
    openW: 0,
    openH: 0,
  });

  // Relay room door position (AllOf lock)
  // (door is created in the rooftop builder since it's a rooftop approach)

  // ----- Tunnel shortcut door (from control basement) ---------------------
  // Basement hatch area (underground, reachable from inside the building)
  // The door is at the south end of the tunnel, accessible from inside the building
  geo.floor('ctrl-basement-floor', { cx: -4, cy: -3, cz: 14, w: 4, d: 4 });
  geo.wall('ctrl-basement-w', { cx: -6, cy: -1.5, cz: 14, w: 0.3, h: 3, d: 4 });
  geo.wall('ctrl-basement-e', { cx: -2, cy: -1.5, cz: 14, w: 0.3, h: 3, d: 4 });
  geo.wall('ctrl-basement-n', { cx: -4, cy: -1.5, cz: 16, w: 4.3, h: 3, d: 0.3 });
  geo.ceiling('ctrl-basement-ceil', { cx: -4, cy: -0.15, cz: 14, w: 4, d: 4 });

  // Basement access stairs from lobby (going down: y0 at basement floor, stair rises to ground)
  geo.stairs('ctrl-basement-down', {
    x0: -4,
    y0: -3,
    z0: 11.8,
    stepW: 3,
    stepH: 0.3,
    stepD: 0.35,
    count: 10,
  });

  // Tunnel shortcut door (can be opened from control side)
  const shortcutDoor = new DoorController(
    DOOR_DEF_TUNNEL_SHORTCUT,
    new Vector3(-4, -2.8, 13),
    scene,
    ctx.inventory,
    ctx.itemRegistry,
  );
  ctx.doorRegistry.register(shortcutDoor);
  const shortcutTarget = new DoorInteractionTarget(shortcutDoor, scene);
  ctx.interactionRegistry.register(shortcutTarget);

  // ----- Labels ----------------------------------------------------------
  geo.label('CONTROL BUILDING', new Vector3(0, 2, 13), 3);
  geo.label('MAIN CONTROL ROOM', new Vector3(-3, 2, 22), 3);
  geo.label('ARCHIVE →', new Vector3(4, 2, 18), 2);

  // ----- Zone triggers ---------------------------------------------------
  ctx.triggerVolumes.add({
    id: 'trig-control-lobby',
    aabb: { minX: -10, minY: -1, minZ: 11, maxX: 10, maxY: 4, maxZ: 16 },
    repeatable: false,
    onEnter: () => {
      ctx.facilityState.tryAdvancePhase('ControlBuildingReached');
      ctx.checkpointRegistry.activate('fg-cp-control-lobby');
      ctx.facilityState.recordZoneDiscovered('fg-zone-control-lobby');
    },
  });

  ctx.triggerVolumes.add({
    id: 'trig-control-room',
    aabb: { minX: -10, minY: -1, minZ: 16, maxX: 6, maxY: 4, maxZ: 27 },
    repeatable: false,
    onEnter: () => {
      ctx.facilityState.recordZoneDiscovered('fg-zone-control-room');
    },
  });

  ctx.triggerVolumes.add({
    id: 'trig-archive',
    aabb: { minX: 0, minY: -1, minZ: 16, maxX: 10, maxY: 4, maxZ: 27 },
    repeatable: false,
    onEnter: () => {
      ctx.facilityState.recordZoneDiscovered('fg-zone-archive');
    },
  });
}
