/**
 * Generator building builder.
 *
 * East side of compound: x ∈ [40, 54], z ∈ [-6, 6]
 * Sub-rooms: generator hall, battery bank, electrical control annex
 * Items: maintenance card (maintenance locker), override seals x2 (electrical annex)
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import { DoorController } from '../../../game/doors/DoorController';
import { DoorInteractionTarget } from '../../../game/doors/DoorInteractionTarget';
import { createPickup } from '../../../game/pickups/PickupController';
import { createReadableDocument } from '../../interaction-test/testTargets/documentTargets';
import { DOOR_DEF_GENERATOR, DOOR_DEF_TUNNEL_MAINTENANCE } from '../facilityDoorDefinitions';
import { FACILITY_PICKUP_DEFS } from '../facilityItemDefinitions';

export function buildGeneratorBuilding(ctx: FacilitySceneContext, scene: Scene): void {
  const { geo, materials } = ctx;

  // ----- Exterior walls ---------------------------------------------------
  // South wall (main entrance side)
  geo.wallWithOpening('gen-s-wall', {
    cx: 47,
    cy: 2,
    cz: -6,
    wallW: 14,
    wallH: 4,
    wallD: 0.4,
    openW: 2.5,
    openH: 3,
    openOffsetX: -3.5,
    color: materials.palette.exterior.diffuseColor,
  });
  // North wall
  geo.wall('gen-n-wall', {
    cx: 47,
    cy: 2,
    cz: 6,
    w: 14,
    h: 4,
    d: 0.4,
    color: materials.palette.exterior.diffuseColor,
  });
  // East wall (rear service exit side)
  geo.wallWithOpening('gen-e-wall', {
    cx: 54,
    cy: 2,
    cz: 0,
    wallW: 0.4,
    wallH: 4,
    wallD: 12,
    openW: 0,
    openH: 0,
    color: materials.palette.exterior.diffuseColor,
  });
  // West wall
  geo.wall('gen-w-wall', {
    cx: 40,
    cy: 2,
    cz: 0,
    w: 0.4,
    h: 4,
    d: 12,
    color: materials.palette.exterior.diffuseColor,
  });

  // Floor and ceiling
  geo.floor('gen-floor', { cx: 47, cy: 0, cz: 0, w: 14, d: 12 });
  geo.ceiling('gen-ceil', { cx: 47, cy: 4, cz: 0, w: 14, d: 12 });

  // ----- Internal dividers ------------------------------------------------
  // Battery bank partition (east side)
  geo.wallWithOpening('gen-battery-div', {
    cx: 48,
    cy: 2,
    cz: -2,
    wallW: 12,
    wallH: 4,
    wallD: 0.3,
    openW: 1.5,
    openH: 2.5,
    openOffsetX: 3,
  });

  // ----- Generator units (decorative blocks) ------------------------------
  for (let i = 0; i < 2; i++) {
    geo.equipmentSolid(`gen-unit-${i}`, {
      cx: 44 + i * 4,
      cy: 1,
      cz: 4,
      w: 3,
      h: 2,
      d: 2,
    });
  }
  // Fuel service area (low tank shape)
  geo.equipmentSolid('gen-fuel-tank', { cx: 53, cy: 0.75, cz: -4, w: 1.5, h: 1.5, d: 2.5 });

  // Battery bank (south-east)
  for (let i = 0; i < 3; i++) {
    geo.equipmentSolid(`gen-battery-${i}`, {
      cx: 52,
      cy: 0.6,
      cz: -5 + i * 1.5,
      w: 1.5,
      h: 1.2,
      d: 1,
    });
  }

  // Electrical control panel (annex)
  geo.equipmentSolid('gen-elec-panel', { cx: 41, cy: 1, cz: 3, w: 0.4, h: 2, d: 3 });

  // Maintenance locker
  geo.equipmentSolid('gen-maint-locker', { cx: 41, cy: 1, cz: -4, w: 0.6, h: 2, d: 0.8 });

  // ----- Main entrance door -----------------------------------------------
  const genDoor = new DoorController(
    DOOR_DEF_GENERATOR,
    new Vector3(42, 1.5, -6),
    scene,
    ctx.inventory,
    ctx.itemRegistry,
  );
  ctx.doorRegistry.register(genDoor);
  const genTarget = new DoorInteractionTarget(genDoor, scene);
  ctx.interactionRegistry.register(genTarget);

  // Door event listener to track opening
  genDoor.onEvent((e) => {
    if (e.kind === 'door-unlocked') {
      ctx.facilityState.recordDoorOpened('fg-door-generator');
    }
  });

  // ----- Tunnel maintenance door (floor hatch in generator building) ------
  // Tunnel entrance hatch in floor
  geo.wall('gen-tunnel-hatch-frame', {
    cx: 47,
    cy: -0.1,
    cz: 0,
    w: 2,
    h: 0.2,
    d: 2,
    color: materials.palette.metal.diffuseColor,
  });

  const tunnelDoor = new DoorController(
    DOOR_DEF_TUNNEL_MAINTENANCE,
    new Vector3(47, 0, 0),
    scene,
    ctx.inventory,
    ctx.itemRegistry,
  );
  ctx.doorRegistry.register(tunnelDoor);
  const tunnelTarget = new DoorInteractionTarget(tunnelDoor, scene);
  ctx.interactionRegistry.register(tunnelTarget);

  // Tunnel stairs down from generator
  geo.stairs('gen-tunnel-stairs', {
    x0: 47,
    y0: 0,
    z0: 1,
    stepW: 2,
    stepH: -0.3,
    stepD: 0.4,
    count: 10,
  });

  // ----- Maintenance card pickup (maintenance locker) ---------------------
  const cardDef = FACILITY_PICKUP_DEFS.find((p) => p.id === 'fg-pickup-maintenance-card');
  if (cardDef !== undefined) {
    const target = createPickup(
      cardDef,
      new Vector3(41.5, 2.1, -4),
      scene,
      ctx.inventory,
      ctx.interactionRegistry,
    );
    ctx.pickupRegistry.register(target);
  }

  // ----- Override seals (electrical annex cabinet) -----------------------
  const seal1Def = FACILITY_PICKUP_DEFS.find((p) => p.id === 'fg-pickup-override-seal-1');
  if (seal1Def !== undefined) {
    const target = createPickup(
      seal1Def,
      new Vector3(41.5, 1.2, 3),
      scene,
      ctx.inventory,
      ctx.interactionRegistry,
    );
    ctx.pickupRegistry.register(target);
  }
  const seal2Def = FACILITY_PICKUP_DEFS.find((p) => p.id === 'fg-pickup-override-seal-2');
  if (seal2Def !== undefined) {
    const target = createPickup(
      seal2Def,
      new Vector3(41.5, 1.2, 4),
      scene,
      ctx.inventory,
      ctx.interactionRegistry,
    );
    ctx.pickupRegistry.register(target);
  }

  // ----- Generator maintenance document -----------------------------------
  const maintDoc = createReadableDocument(scene, new Vector3(43, 1.1, -5.5), {
    id: 'fg-doc-generator-maint-readable',
    documentId: 'doc-generator-maintenance-sheet',
    label: 'MAINTENANCE RECORD',
    rotationY: 0,
  });
  ctx.interactionRegistry.register(maintDoc);

  // ----- Labels ----------------------------------------------------------
  geo.label('GENERATOR BUILDING', new Vector3(47, 3, 0), 3.5);
  geo.label('MAINTENANCE LOCKER', new Vector3(41.5, 2.5, -4), 2.5);
  geo.label('TUNNEL ACCESS ↓', new Vector3(47, 2, 0), 2.5);

  // ----- Zone triggers ---------------------------------------------------
  ctx.triggerVolumes.add({
    id: 'trig-generator-hall',
    aabb: { minX: 39, minY: -1, minZ: -7, maxX: 55, maxY: 5, maxZ: 7 },
    repeatable: false,
    onEnter: () => {
      ctx.facilityState.tryAdvancePhase('GeneratorAccessed');
      ctx.facilityState.recordZoneDiscovered('fg-zone-generator-hall');
    },
  });

  ctx.triggerVolumes.add({
    id: 'trig-generator-electrical',
    aabb: { minX: 39, minY: -1, minZ: 0, maxX: 45, maxY: 5, maxZ: 7 },
    repeatable: false,
    onEnter: () => {
      ctx.facilityState.recordZoneDiscovered('fg-zone-generator-electrical');
    },
  });
}
