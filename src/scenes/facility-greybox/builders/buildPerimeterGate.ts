/**
 * Perimeter gate and security booth builder.
 *
 * Vehicle gate (wide, visual only), pedestrian gate (interactive, locked),
 * security booth with desk, locker, filing cabinet, entry log document and
 * the compound access key pickup.
 *
 * World layout:
 *   x ≈ -20: compound perimeter fence line
 *   Pedestrian gate: x = -20, z ∈ [3, 6]
 *   Vehicle gate: x = -20, z ∈ [-5, 2]
 *   Security booth: x ∈ [-20, -12], z ∈ [4, 11]
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import { DoorController } from '../../../game/doors/DoorController';
import { DoorInteractionTarget } from '../../../game/doors/DoorInteractionTarget';
import { createPickup } from '../../../game/pickups/PickupController';
import { createReadableDocument } from '../../interaction-test/testTargets/documentTargets';
import { DOOR_DEF_COMPOUND_GATE } from '../facilityDoorDefinitions';
import { FACILITY_PICKUP_DEFS } from '../facilityItemDefinitions';

export function buildPerimeterGate(ctx: FacilitySceneContext, scene: Scene): void {
  const { geo, materials } = ctx;

  // ----- Perimeter fence (concrete pillars + fence panels) ---------------
  // North fence
  geo.fence('fence-n', { cx: 31, cy: 1.5, cz: 32, w: 100, h: 3, d: 0.3 });
  // South fence
  geo.fence('fence-s', { cx: 31, cy: 1.5, cz: -32, w: 100, h: 3, d: 0.3 });
  // West fence (north of gate)
  geo.fence('fence-w-n', { cx: -20, cy: 1.5, cz: 19.5, w: 0.3, h: 3, d: 25 });
  // West fence (south of gate + vehicle gate area)
  geo.fence('fence-w-s', { cx: -20, cy: 1.5, cz: -19.5, w: 0.3, h: 3, d: 25 });
  // East fence
  geo.fence('fence-e', { cx: 62, cy: 1.5, cz: 0, w: 0.3, h: 3, d: 64 });

  // ----- Vehicle gate (visual, non-interactive wide barrier) -------------
  geo.wall('vehicle-gate-bar', {
    cx: -20,
    cy: 1.5,
    cz: -1.5,
    w: 0.3,
    h: 0.2,
    d: 7,
    color: materials.palette.metal.diffuseColor,
  });
  // Gate pillars
  geo.wall('gate-pillar-n', { cx: -20, cy: 2, cz: 2.5, w: 0.8, h: 4, d: 0.8 });
  geo.wall('gate-pillar-s', { cx: -20, cy: 2, cz: -5.5, w: 0.8, h: 4, d: 0.8 });

  // ----- Pedestrian gate frame -------------------------------------------
  // North pillar of pedestrian gate
  geo.wall('ped-gate-pillar-n', { cx: -20, cy: 1.5, cz: 6.5, w: 0.8, h: 3, d: 0.8 });
  // South pillar (same as vehicle gate north pillar)
  // Lintel above pedestrian gate
  geo.wall('ped-gate-lintel', {
    cx: -20,
    cy: 2.6,
    cz: 4.5,
    w: 0.3,
    h: 0.5,
    d: 2.5,
    color: materials.palette.metal.diffuseColor,
  });

  // ----- Pedestrian gate door --------------------------------------------
  const gatePos = new Vector3(-20, 1.1, 4);
  const gateDoor = new DoorController(
    DOOR_DEF_COMPOUND_GATE,
    gatePos,
    scene,
    ctx.inventory,
    ctx.itemRegistry,
  );
  ctx.doorRegistry.register(gateDoor);
  const gateTarget = new DoorInteractionTarget(gateDoor, scene);
  ctx.interactionRegistry.register(gateTarget);

  // ----- Security booth --------------------------------------------------
  // Floor
  geo.floor('booth-floor', { cx: -16, cy: 0, cz: 7.5, w: 8, d: 7 });
  // Ceiling
  geo.ceiling('booth-ceil', { cx: -16, cy: 3, cz: 7.5, w: 8, d: 7 });
  // Walls
  geo.wall('booth-wall-e', { cx: -12, cy: 1.5, cz: 7.5, w: 0.3, h: 3, d: 7 });
  geo.wall('booth-wall-n', { cx: -16, cy: 1.5, cz: 11, w: 8, h: 3, d: 0.3 });
  geo.wall('booth-wall-s', { cx: -16, cy: 1.5, cz: 4, w: 8, h: 3, d: 0.3 });
  // West wall with window (opening)
  geo.wallWithOpening('booth-wall-w', {
    cx: -20,
    cy: 1.5,
    cz: 7.5,
    wallW: 7,
    wallH: 3,
    wallD: 0.3,
    openW: 1.8,
    openH: 1.4,
    openOffsetX: 0,
  });

  // Desk
  geo.equipmentSolid('booth-desk', { cx: -14.5, cy: 0.45, cz: 8, w: 2.5, h: 0.9, d: 1.2 });
  // Locker
  geo.equipmentSolid('booth-locker', { cx: -19.3, cy: 1, cz: 6, w: 0.6, h: 2, d: 0.7 });
  // Filing cabinet
  geo.equipmentSolid('booth-filing', { cx: -19.3, cy: 0.5, cz: 9, w: 0.6, h: 1, d: 0.5 });

  // Gate control box on wall
  geo.equipment('booth-gate-ctrl', {
    cx: -12.5,
    cy: 1.4,
    cz: 10,
    w: 0.2,
    h: 0.5,
    d: 0.4,
  });

  // ----- Compound gate key pickup ----------------------------------------
  const gateKeyDef = FACILITY_PICKUP_DEFS.find((p) => p.id === 'fg-pickup-compound-gate-key');
  if (gateKeyDef !== undefined) {
    const target = createPickup(
      gateKeyDef,
      new Vector3(-19, 1.1, 6),
      scene,
      ctx.inventory,
      ctx.interactionRegistry,
    );
    ctx.pickupRegistry.register(target);

    // Track collection
    const origInteract = target.interact.bind(target);
    target.interact = (c) => {
      const result = origInteract(c);
      ctx.facilityState.recordPickupCollected('fg-pickup-compound-gate-key');
      return result;
    };
  }

  // ----- Entry log document -----------------------------------------------
  const logTarget = createReadableDocument(scene, new Vector3(-14.5, 1.0, 8.3), {
    id: 'fg-doc-entry-log-readable',
    documentId: 'doc-facility-entry-log',
    label: 'ENTRY LOG',
    rotationY: 0,
  });
  ctx.interactionRegistry.register(logTarget);

  // ----- Gate area label -------------------------------------------------
  geo.label('SECURITY CHECKPOINT', new Vector3(-16, 3.5, 7.5), 3.5);

  // ----- Zone trigger: security checkpoint --------------------------------
  ctx.triggerVolumes.add({
    id: 'trig-security-booth',
    aabb: { minX: -21, minY: -1, minZ: 2, maxX: -10, maxY: 5, maxZ: 11 },
    repeatable: false,
    onEnter: () => {
      ctx.facilityState.tryAdvancePhase('SecurityCheckpoint');
      ctx.checkpointRegistry.activate('fg-cp-gate');
    },
  });

  // ----- Zone trigger: compound entered (crossed the gate) ----------------
  ctx.triggerVolumes.add({
    id: 'trig-compound-entered',
    aabb: { minX: -18, minY: -1, minZ: -6, maxX: -10, maxY: 5, maxZ: 6 },
    repeatable: false,
    onEnter: () => {
      ctx.facilityState.tryAdvancePhase('CompoundEntered');
      ctx.checkpointRegistry.activate('fg-cp-gate');
    },
  });
}
