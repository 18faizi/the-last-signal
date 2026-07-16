/**
 * Courtyard builder.
 *
 * Open outdoor area at the heart of the compound.  Contains service paths,
 * exterior stairs to control building roof, and the locked tunnel entrance
 * hatch in the ground (decorative visual only — actual tunnel access is via
 * the generator building).
 *
 * Courtyard: x ∈ [-20, 60], z ∈ [-30, 30]
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { FacilitySceneContext } from '../FacilitySceneContext';

export function buildCourtyard(ctx: FacilitySceneContext): void {
  const { geo } = ctx;

  // Main compound ground surface
  geo.outdoor('courtyard-main', { cx: 21, cz: 0, w: 80, d: 60 });

  // Service path (east-west axial path)
  geo.floor('path-ew', { cx: 21, cy: 0.02, cz: 0, w: 80, d: 3, h: 0.05 });

  // Service path (north-south from gate to control building)
  geo.floor('path-ns-ctrl', { cx: -2, cy: 0.02, cz: 6, w: 3, d: 12, h: 0.05 });

  // Path to generator
  geo.floor('path-gen', { cx: 40, cy: 0.02, cz: 0, w: 20, d: 3, h: 0.05 });

  // Path to staff quarters
  geo.floor('path-staff', { cx: 43, cy: 0.02, cz: -9, w: 3, d: 18, h: 0.05 });

  // Decorative tunnel hatch (visual, ground level)
  geo.course.box('fac-tunnel-hatch', {
    width: 1.2,
    height: 0.1,
    depth: 1.2,
    position: new Vector3(10, 0.05, 0),
    color: ctx.materials.palette.metal.diffuseColor,
  });

  // Lamp posts
  for (let i = 0; i < 4; i++) {
    const x = -10 + i * 20;
    geo.course.pillar(`fac-lamp-${i}`, new Vector3(x, 2.5, 3.5), 0.15, 5);
  }

  // Exterior stairs block toward control building
  geo.stairs('exterior-ctrl', {
    x0: -2,
    y0: 0,
    z0: 11.2,
    stepW: 3,
    stepH: 0.2,
    stepD: 0.4,
    count: 2,
  });

  // Low concrete barriers along south edge of compound
  for (let i = 0; i < 5; i++) {
    geo.course.box(`fac-barrier-s-${i}`, {
      width: 4,
      height: 0.6,
      depth: 0.3,
      position: new Vector3(-10 + i * 14, 0.3, -29.7),
      color: ctx.materials.palette.concrete.diffuseColor,
    });
  }

  // Courtyard label (floating)
  geo.label('COURTYARD', new Vector3(10, 2.5, 0), 3);

  // Zone trigger: courtyard
  ctx.triggerVolumes.add({
    id: 'trig-courtyard',
    aabb: { minX: -15, minY: -1, minZ: -28, maxX: 55, maxY: 6, maxZ: 28 },
    repeatable: false,
    onEnter: () => {
      ctx.checkpointRegistry.activate('fg-cp-courtyard');
      ctx.facilityState.recordZoneDiscovered('fg-zone-courtyard');
    },
  });
}
