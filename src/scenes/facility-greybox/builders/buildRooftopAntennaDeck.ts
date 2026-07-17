/**
 * Rooftop antenna deck builder.
 *
 * Atop control building at Y = 6: x ∈ [-10, 10], z ∈ [12, 27]
 * Features:
 *   - Parapet railings
 *   - Microwave dish placeholders (cylinder stumps)
 *   - Waveguide geometry (cable conduits)
 *   - Antenna control cabinet placeholder
 *   - Tower base geometry
 *   - Relay room door (AllOf lock)
 *   - Final milestone completion trigger
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import { DoorController } from '../../../game/doors/DoorController';
import { DoorInteractionTarget } from '../../../game/doors/DoorInteractionTarget';
import { DOOR_DEF_ROOFTOP, DOOR_DEF_RELAY_ROOM } from '../facilityDoorDefinitions';

export function buildRooftopAntennaDeck(ctx: FacilitySceneContext, scene: Scene): void {
  const { geo, materials } = ctx;
  const RY = 6; // rooftop base Y

  // ----- Rooftop surface -------------------------------------------------
  geo.floor('roof-surface', { cx: 0, cy: RY, cz: 19.5, w: 20, d: 15, h: 0.15 });

  // ----- Parapet railings -----------------------------------------------
  geo.railing('railing-n', { cx: 0, cy: RY + 0.6, cz: 27, w: 20, d: 0.2 });
  geo.railing('railing-s', { cx: 0, cy: RY + 0.6, cz: 12, w: 20, d: 0.2 });
  geo.railing('railing-e', { cx: 10, cy: RY + 0.6, cz: 19.5, w: 0.2, d: 15 });
  geo.railing('railing-w', { cx: -10, cy: RY + 0.6, cz: 19.5, w: 0.2, d: 15 });

  // ----- Rooftop access door (from roof corridor) -----------------------
  const roofDoor = new DoorController(
    DOOR_DEF_ROOFTOP,
    new Vector3(0, RY + 1.1, 17),
    scene,
    ctx.inventory,
    ctx.itemRegistry,
  );
  ctx.doorRegistry.register(roofDoor);
  const roofTarget = new DoorInteractionTarget(roofDoor, scene);
  ctx.interactionRegistry.register(roofTarget);

  roofDoor.onEvent((e) => {
    if (e.kind === 'door-unlocked') {
      ctx.facilityState.recordDoorOpened('fg-door-rooftop');
      ctx.facilityState.tryAdvancePhase('RooftopAccessed');
    }
  });

  // Door housing (stairwell box on roof)
  geo.wall('roof-door-house-e', { cx: 2, cy: RY + 1.5, cz: 15, w: 0.3, h: 3, d: 4 });
  geo.wall('roof-door-house-w', { cx: -2, cy: RY + 1.5, cz: 15, w: 0.3, h: 3, d: 4 });
  geo.ceiling('roof-door-house-top', { cx: 0, cy: RY + 2.9, cz: 15, w: 4, d: 4, h: 0.2 });

  // ----- Microwave dish placeholders ------------------------------------
  // Two stumps representing dish mounts
  geo.course.pillar('fac-dish-mount-1', new Vector3(-6, RY + 1.2, 24), 0.3, 2.4);
  geo.course.pillar('fac-dish-mount-2', new Vector3(6, RY + 1.2, 24), 0.3, 2.4);

  // Dish face placeholders (tilted box)
  geo.course.box('fac-dish-1', {
    width: 3,
    height: 0.15,
    depth: 3,
    position: new Vector3(-6, RY + 2.5, 24),
    rotationX: -Math.PI / 6,
    color: materials.palette.metal.diffuseColor,
  });
  geo.course.box('fac-dish-2', {
    width: 3,
    height: 0.15,
    depth: 3,
    position: new Vector3(6, RY + 2.5, 24),
    rotationX: -Math.PI / 6,
    color: materials.palette.metal.diffuseColor,
  });

  // ----- Waveguide conduit runs ------------------------------------------
  geo.course.box('fac-waveguide-1', {
    width: 0.2,
    height: 0.2,
    depth: 8,
    position: new Vector3(-6, RY + 0.2, 20),
    color: materials.palette.metal.diffuseColor,
  });
  geo.course.box('fac-waveguide-2', {
    width: 0.2,
    height: 0.2,
    depth: 8,
    position: new Vector3(6, RY + 0.2, 20),
    color: materials.palette.metal.diffuseColor,
  });

  // ----- Antenna control cabinet -------------------------------------------
  // M0.5's static placeholder here (previously `geo.equipmentSolid('roof-
  // antenna-ctrl', ...)`) is REPLACED by Milestone 0.8's real interactive
  // cabinet — see antenna/buildAntennaControls.ts — at the exact same
  // position, mirroring buildReceiverConsole.ts's identical replacement of
  // M0.6's provisional receiver placeholder. Keeping both would leave a
  // non-interactive static collider occupying the same volume as the new
  // 'antenna'-kind InteractionTarget's mesh, blocking its raycast.

  // ----- Tower base geometry -------------------------------------------
  // Lattice tower base legs (four box posts)
  for (let i = 0; i < 4; i++) {
    const ox = i < 2 ? -1.5 : 1.5;
    const oz = i % 2 === 0 ? -1 : 1;
    geo.course.pillar(`fac-tower-leg-${i}`, new Vector3(ox, RY + 3, 20 + oz), 0.2, 6);
  }
  // Cross brace
  geo.course.box('fac-tower-brace', {
    width: 3,
    height: 0.15,
    depth: 2,
    position: new Vector3(0, RY + 4, 20),
    color: materials.palette.metal.diffuseColor,
  });

  // ----- Relay room door (AllOf: antenna card + override seal) -----------
  // Relay room is the north section of the upper floor (accessible from rooftop)
  const relayDoor = new DoorController(
    DOOR_DEF_RELAY_ROOM,
    new Vector3(-7, RY + 1.1, 20),
    scene,
    ctx.inventory,
    ctx.itemRegistry,
  );
  ctx.doorRegistry.register(relayDoor);
  const relayTarget = new DoorInteractionTarget(relayDoor, scene);
  ctx.interactionRegistry.register(relayTarget);

  // ----- Labels ---------------------------------------------------------
  geo.label('ANTENNA DECK', new Vector3(0, RY + 2, 19.5), 3);
  geo.label('RELAY ROOM →', new Vector3(-5, RY + 1.8, 20), 2);
  geo.label('⬡ FINAL OBJECTIVE', new Vector3(0, RY + 2, 23), 3);

  // ----- Zone triggers --------------------------------------------------
  // Roof corridor trigger (after coming up stairs)
  ctx.triggerVolumes.add({
    id: 'trig-roof-corridor',
    aabb: { minX: -4, minY: 5.5, minZ: 12, maxX: 4, maxY: 9, maxZ: 18 },
    repeatable: false,
    onEnter: () => {
      ctx.facilityState.recordZoneDiscovered('fg-zone-roof-corridor');
    },
  });

  // Antenna deck entry trigger
  ctx.triggerVolumes.add({
    id: 'trig-antenna-deck',
    aabb: { minX: -10, minY: 5.5, minZ: 17, maxX: 10, maxY: 10, maxZ: 28 },
    repeatable: false,
    onEnter: () => {
      ctx.facilityState.recordZoneDiscovered('fg-zone-antenna-deck');
    },
  });

  // ----- Completion trigger (standing near the tower base) ---------------
  ctx.triggerVolumes.add({
    id: 'trig-completion',
    aabb: { minX: -3, minY: 5.5, minZ: 18, maxX: 3, maxY: 10, maxZ: 23 },
    repeatable: false,
    onEnter: () => {
      ctx.facilityState.tryAdvancePhase('GreyboxComplete');
    },
  });
}
