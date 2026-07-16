/**
 * Mountain approach builder.
 *
 * Service road running west from the compound gate, with a utility vehicle
 * silhouette, concrete barriers and a fence perimeter on the north side.
 * Player spawns here at x = -58.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { FacilitySceneContext } from '../FacilitySceneContext';

export function buildMountainApproach(ctx: FacilitySceneContext): void {
  const { geo } = ctx;

  // Road surface (-62 to -20, width 10)
  geo.outdoor('approach-road', { cx: -42, cz: 0, w: 40, d: 10 });

  // Road shoulders (gravel/dirt verges)
  geo.outdoor('approach-verge-n', { cx: -42, cz: 7, w: 40, d: 4 });
  geo.outdoor('approach-verge-s', { cx: -42, cz: -7, w: 40, d: 4 });

  // Mountain embankment walls (north and south sides) — act as out-of-bounds
  geo.wall('approach-embank-n', {
    cx: -42,
    cy: 1.5,
    cz: 11,
    w: 40,
    h: 3,
    d: 0.4,
  });
  geo.wall('approach-embank-s', {
    cx: -42,
    cy: 1.5,
    cz: -11,
    w: 40,
    h: 3,
    d: 0.4,
  });

  // Utility vehicle silhouette (parked off-road, north side)
  // Main body
  geo.course.box('fac-vehicle-body', {
    width: 5,
    height: 2,
    depth: 2.2,
    position: new Vector3(-50, 1, 9),
    color: ctx.materials.palette.exterior.diffuseColor,
  });
  // Cab section
  geo.course.box('fac-vehicle-cab', {
    width: 2,
    height: 1.6,
    depth: 2.2,
    position: new Vector3(-47, 1.8, 9),
    color: ctx.materials.palette.metal.diffuseColor,
  });

  // Concrete road barriers along the north edge near gate
  for (let i = 0; i < 4; i++) {
    geo.course.box(`fac-barrier-${i}`, {
      width: 0.6,
      height: 0.8,
      depth: 2,
      position: new Vector3(-24 + i * 2.5, 0.4, 6),
      color: ctx.materials.palette.concrete.diffuseColor,
    });
  }

  // Approach label
  geo.label('MOUNTAIN APPROACH', new Vector3(-42, 2.5, 0), 4);

  // Register spawn checkpoint trigger
  ctx.triggerVolumes.add({
    id: 'trig-approach-spawn',
    aabb: { minX: -65, minY: -2, minZ: -8, maxX: -30, maxY: 6, maxZ: 8 },
    repeatable: false,
    onEnter: () => {
      ctx.checkpointRegistry.activate('fg-cp-spawn');
      ctx.facilityState.recordZoneDiscovered('fg-zone-approach');
    },
  });
}
