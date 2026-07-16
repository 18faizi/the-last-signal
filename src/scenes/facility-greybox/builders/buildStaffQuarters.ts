/**
 * Staff quarters builder.
 *
 * South-east of compound: x ∈ [38, 58], z ∈ [-24, -10]
 * Rooms: dormitory, kitchen, dining area, washroom corridor, two private
 * rooms, storage room, exterior veranda/service exit.
 *
 * Items: supervisor key (storage room)
 * Documents: staff shift note (kitchen)
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import { createPickup } from '../../../game/pickups/PickupController';
import { createReadableDocument } from '../../interaction-test/testTargets/documentTargets';
import { FACILITY_PICKUP_DEFS } from '../facilityItemDefinitions';

export function buildStaffQuarters(ctx: FacilitySceneContext, scene: Scene): void {
  const { geo, materials } = ctx;

  // ----- Exterior walls ---------------------------------------------------
  geo.wall('staff-w-wall', {
    cx: 38,
    cy: 1.5,
    cz: -17,
    w: 0.4,
    h: 3,
    d: 14,
    color: materials.palette.exterior.diffuseColor,
  });
  geo.wall('staff-e-wall', {
    cx: 58,
    cy: 1.5,
    cz: -17,
    w: 0.4,
    h: 3,
    d: 14,
    color: materials.palette.exterior.diffuseColor,
  });
  geo.wallWithOpening('staff-s-wall', {
    cx: 48,
    cy: 1.5,
    cz: -24,
    wallW: 20,
    wallH: 3,
    wallD: 0.4,
    openW: 2,
    openH: 2.5,
    openOffsetX: 6,
    color: materials.palette.exterior.diffuseColor,
  });
  geo.wallWithOpening('staff-n-wall', {
    cx: 48,
    cy: 1.5,
    cz: -10,
    wallW: 20,
    wallH: 3,
    wallD: 0.4,
    openW: 2,
    openH: 2.5,
    openOffsetX: 0,
    color: materials.palette.exterior.diffuseColor,
  });

  // Floor and ceiling
  geo.floor('staff-floor', { cx: 48, cy: 0, cz: -17, w: 20, d: 14 });
  geo.ceiling('staff-ceil', { cx: 48, cy: 3, cz: -17, w: 20, d: 14 });

  // ----- Interior walls ---------------------------------------------------
  // Kitchen divider from dormitory
  geo.wallWithOpening('staff-kitchen-div', {
    cx: 48,
    cy: 1.5,
    cz: -14,
    wallW: 20,
    wallH: 3,
    wallD: 0.3,
    openW: 2,
    openH: 2.5,
    openOffsetX: -2,
  });

  // Storage divider (east side)
  geo.wallWithOpening('staff-storage-div', {
    cx: 55,
    cy: 1.5,
    cz: -19,
    wallW: 6,
    wallH: 3,
    wallD: 0.3,
    openW: 1.5,
    openH: 2.5,
    openOffsetX: 1.5,
  });

  // Private rooms dividers (west end)
  geo.wallWithOpening('staff-room-a-div', {
    cx: 40.5,
    cy: 1.5,
    cz: -19.5,
    wallW: 5,
    wallH: 3,
    wallD: 0.3,
    openW: 1.2,
    openH: 2.2,
    openOffsetX: -1,
  });

  // ----- Furniture -------------------------------------------------------
  // Dormitory bunks (decorative)
  for (let i = 0; i < 3; i++) {
    geo.equipmentSolid(`staff-bunk-${i}`, {
      cx: 41 + i * 4,
      cy: 0.5,
      cz: -22,
      w: 2,
      h: 1,
      d: 0.9,
    });
  }

  // Kitchen counter
  geo.equipmentSolid('staff-counter', { cx: 42, cy: 0.45, cz: -12, w: 4, h: 0.9, d: 1 });
  geo.equipmentSolid('staff-table', { cx: 50, cy: 0.38, cz: -12.5, w: 3, h: 0.75, d: 1.5 });

  // Storage shelves
  geo.equipmentSolid('staff-shelf-1', { cx: 55, cy: 1, cz: -23, w: 0.4, h: 2, d: 1 });
  geo.equipmentSolid('staff-shelf-2', { cx: 57, cy: 1, cz: -23, w: 0.4, h: 2, d: 1 });

  // ----- Exterior veranda/service exit path -------------------------------
  geo.outdoor('staff-veranda', { cx: 54, cz: -26, w: 8, d: 4 });

  // ----- Supervisor key (storage room) ------------------------------------
  const supKeyDef = FACILITY_PICKUP_DEFS.find((p) => p.id === 'fg-pickup-supervisor-key');
  if (supKeyDef !== undefined) {
    const target = createPickup(
      supKeyDef,
      new Vector3(56, 1.1, -21),
      scene,
      ctx.inventory,
      ctx.interactionRegistry,
    );
    ctx.pickupRegistry.register(target);
  }

  // ----- Staff shift note document (kitchen) ------------------------------
  const shiftDoc = createReadableDocument(scene, new Vector3(44, 1.1, -12), {
    id: 'fg-doc-staff-shift-readable',
    documentId: 'doc-staff-shift-note',
    label: 'SHIFT NOTE',
    rotationY: 0.3,
  });
  ctx.interactionRegistry.register(shiftDoc);

  // ----- Labels ----------------------------------------------------------
  geo.label('STAFF QUARTERS', new Vector3(48, 2.5, -17), 3);
  geo.label('STORAGE ROOM →', new Vector3(54, 2, -17), 2);
  geo.label('← KITCHEN', new Vector3(44, 2, -13), 2);

  // ----- Zone triggers ---------------------------------------------------
  ctx.triggerVolumes.add({
    id: 'trig-staff-dormitory',
    aabb: { minX: 37, minY: -1, minZ: -25, maxX: 59, maxY: 4, maxZ: -13 },
    repeatable: false,
    onEnter: () => {
      ctx.facilityState.tryAdvancePhase('StaffQuartersReached');
      ctx.checkpointRegistry.activate('fg-cp-staff-quarters');
      ctx.facilityState.recordZoneDiscovered('fg-zone-staff-dormitory');
    },
  });

  ctx.triggerVolumes.add({
    id: 'trig-staff-storage',
    aabb: { minX: 50, minY: -1, minZ: -25, maxX: 59, maxY: 4, maxZ: -13 },
    repeatable: false,
    onEnter: () => {
      ctx.facilityState.recordZoneDiscovered('fg-zone-staff-storage');
    },
  });
}
