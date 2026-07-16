/**
 * Supervisor office builder.
 *
 * Small building: x ∈ [20, 34], z ∈ [-22, -12]
 * Items: antenna access card pickup (on desk)
 * Documents: antenna access memo
 * Requires: supervisor key to enter (door)
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import { DoorController } from '../../../game/doors/DoorController';
import { DoorInteractionTarget } from '../../../game/doors/DoorInteractionTarget';
import { createPickup } from '../../../game/pickups/PickupController';
import { createReadableDocument } from '../../interaction-test/testTargets/documentTargets';
import { DOOR_DEF_SUPERVISOR } from '../facilityDoorDefinitions';
import { FACILITY_PICKUP_DEFS } from '../facilityItemDefinitions';

export function buildSupervisorOffice(ctx: FacilitySceneContext, scene: Scene): void {
  const { geo, materials } = ctx;

  // ----- Exterior walls ---------------------------------------------------
  geo.wall('sup-w-wall', {
    cx: 20,
    cy: 1.5,
    cz: -17,
    w: 0.4,
    h: 3,
    d: 10,
    color: materials.palette.exterior.diffuseColor,
  });
  geo.wall('sup-e-wall', {
    cx: 34,
    cy: 1.5,
    cz: -17,
    w: 0.4,
    h: 3,
    d: 10,
    color: materials.palette.exterior.diffuseColor,
  });
  geo.wall('sup-n-wall', {
    cx: 27,
    cy: 1.5,
    cz: -12,
    w: 14,
    h: 3,
    d: 0.4,
    color: materials.palette.exterior.diffuseColor,
  });
  geo.wallWithOpening('sup-s-wall', {
    cx: 27,
    cy: 1.5,
    cz: -22,
    wallW: 14,
    wallH: 3,
    wallD: 0.4,
    openW: 1.8,
    openH: 2.4,
    openOffsetX: -3,
    color: materials.palette.exterior.diffuseColor,
  });

  // Floor and ceiling
  geo.floor('sup-floor', { cx: 27, cy: 0, cz: -17, w: 14, d: 10 });
  geo.ceiling('sup-ceil', { cx: 27, cy: 3, cz: -17, w: 14, d: 10 });

  // Window cutout on north wall (view toward control building)
  geo.wallWithOpening('sup-window', {
    cx: 27,
    cy: 1.5,
    cz: -12,
    wallW: 14,
    wallH: 3,
    wallD: 0.4,
    openW: 2,
    openH: 1.2,
    openOffsetX: 3,
    color: materials.palette.exterior.diffuseColor,
  });

  // ----- Furniture -------------------------------------------------------
  // Supervisor desk (large)
  geo.equipmentSolid('sup-desk', { cx: 27, cy: 0.45, cz: -15, w: 3, h: 0.9, d: 1.5 });
  // Filing cabinet
  geo.equipmentSolid('sup-filing', { cx: 33.3, cy: 0.75, cz: -21, w: 0.7, h: 1.5, d: 0.6 });
  // Wall safe placeholder (mounted on east wall)
  geo.equipment('sup-safe', { cx: 33.7, cy: 1.5, cz: -15, w: 0.2, h: 0.6, d: 0.5 });
  // Chair
  geo.equipment('sup-chair', { cx: 27, cy: 0.25, cz: -16, w: 0.6, h: 0.5, d: 0.6 });

  // ----- Supervisor door -------------------------------------------------
  const supDoor = new DoorController(
    DOOR_DEF_SUPERVISOR,
    new Vector3(23, 1.2, -22),
    scene,
    ctx.inventory,
    ctx.itemRegistry,
  );
  ctx.doorRegistry.register(supDoor);
  const supTarget = new DoorInteractionTarget(supDoor, scene);
  ctx.interactionRegistry.register(supTarget);

  // ----- Antenna access card pickup (on desk) ----------------------------
  const antennaDef = FACILITY_PICKUP_DEFS.find((p) => p.id === 'fg-pickup-antenna-access-card');
  if (antennaDef !== undefined) {
    const target = createPickup(
      antennaDef,
      new Vector3(26, 1.1, -14.5),
      scene,
      ctx.inventory,
      ctx.interactionRegistry,
    );
    ctx.pickupRegistry.register(target);
  }

  // ----- Antenna access memo document ------------------------------------
  const memoDoc = createReadableDocument(scene, new Vector3(28, 1.1, -14.5), {
    id: 'fg-doc-antenna-memo-readable',
    documentId: 'doc-antenna-access-memo',
    label: 'ROOFTOP ACCESS MEMO',
    rotationY: -0.2,
  });
  ctx.interactionRegistry.register(memoDoc);

  // ----- Labels ----------------------------------------------------------
  geo.label("SUPERVISOR'S OFFICE", new Vector3(27, 2.5, -17), 3.5);

  // ----- Zone triggers ---------------------------------------------------
  ctx.triggerVolumes.add({
    id: 'trig-supervisor-office',
    aabb: { minX: 19, minY: -1, minZ: -23, maxX: 35, maxY: 4, maxZ: -11 },
    repeatable: false,
    onEnter: () => {
      ctx.facilityState.tryAdvancePhase('SupervisorOfficeReached');
      ctx.checkpointRegistry.activate('fg-cp-supervisor');
      ctx.facilityState.recordZoneDiscovered('fg-zone-supervisor-office');
    },
  });
}
