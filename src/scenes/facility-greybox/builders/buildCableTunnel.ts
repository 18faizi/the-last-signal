/**
 * Cable tunnel builder.
 *
 * Underground route at Y ≈ -3m connecting:
 *   - Generator building basement (east, x ≈ 47)
 *   - Control building basement (west, x ≈ -4)
 *   - Branch south to staff quarters (junction at x ≈ 20, z ≈ -2)
 *
 * Features:
 *   - Cable trays (decorative equipment on ceiling)
 *   - Junction alcoves
 *   - Standing-water depression (low floor section)
 *   - Collapsed branch (blocked passage, visual only)
 *   - Crouch-only maintenance bypass (ceiling height 1.1m, short section)
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { FacilitySceneContext } from '../FacilitySceneContext';

export function buildCableTunnel(ctx: FacilitySceneContext): void {
  const { geo } = ctx;
  const TY = -3; // tunnel centre Y

  // ----- Main east-west tunnel (generator to control) --------------------
  // Segment 1: x ∈ [36, 47], z ≈ 0 (from generator basement)
  geo.tunnelSegment('main-east', {
    cx: 41.5,
    cy: TY,
    cz: 0,
    len: 11,
    width: 2.2,
    height: 2.4,
  });

  // Segment 2: x ∈ [20, 36], z ≈ 0 (central run)
  geo.tunnelSegment('main-centre', {
    cx: 28,
    cy: TY,
    cz: 0,
    len: 32,
    width: 2.2,
    height: 2.4,
  });

  // Standing water depression (slight dip in floor)
  geo.course.box('fac-tun-water', {
    width: 2,
    height: 0.15,
    depth: 3,
    position: new Vector3(25, TY - 1.05, 0),
    color: ctx.materials.palette.tunnel.diffuseColor,
  });

  // Segment 3: x ∈ [-5, 20], z ≈ 0 (toward control basement)
  geo.tunnelSegment('main-west', {
    cx: 7.5,
    cy: TY,
    cz: 0,
    len: 25,
    width: 2.2,
    height: 2.4,
  });

  // ----- Crouch-only maintenance bypass (around junction area) -----------
  // Ceiling is 1.1m height — player must crouch (crouchedHeight = 1.2m, minus margins)
  geo.tunnelSegment('bypass', {
    cx: 21,
    cy: TY + 0.05,
    cz: -3,
    len: 6,
    width: 1.8,
    height: 1.1,
  });
  // Bypass connects back to main tunnel via a z-offset segment
  geo.tunnelSegment('bypass-join-n', {
    cx: 21,
    cy: TY + 0.05,
    cz: -0.85,
    len: 2.3,
    width: 1.8,
    height: 1.4,
  });
  geo.tunnelSegment('bypass-join-s', {
    cx: 21,
    cy: TY + 0.05,
    cz: -5.15,
    len: 2.3,
    width: 1.8,
    height: 1.4,
  });

  // ----- South branch: junction to staff quarters -------------------------
  // Junction alcove
  geo.tunnelSegment('branch-jct', {
    cx: 20,
    cy: TY,
    cz: -4,
    len: 4,
    width: 2.2,
    height: 2.4,
  });
  // South run to staff quarters
  geo.tunnelSegment('branch-south', {
    cx: 20,
    cy: TY,
    cz: -14,
    len: 20,
    width: 2.2,
    height: 2.4,
  });
  // Branch tunnel end (emerges in staff basement)
  geo.tunnelSegment('branch-exit', {
    cx: 20,
    cy: TY,
    cz: -22,
    len: 4,
    width: 2.2,
    height: 2.4,
  });

  // Tunnel exit stairs up to staff quarters
  geo.stairs('tunnel-staff-exit', {
    x0: 20,
    y0: TY + 1.2,
    z0: -23,
    stepW: 2,
    stepH: 0.3,
    stepD: 0.4,
    count: 10,
  });

  // ----- Collapsed branch (visual only — dead end) ----------------------
  // Rubble fill blocking passage
  geo.course.box('fac-tun-collapse', {
    width: 2.5,
    height: 2.5,
    depth: 1.5,
    position: new Vector3(5, TY, -5),
    color: ctx.materials.palette.concrete.diffuseColor,
  });

  // ----- Cable trays (decorative) ----------------------------------------
  for (let i = 0; i < 6; i++) {
    geo.equipment('cable-tray-' + i, {
      cx: 10 + i * 6,
      cy: TY + 0.9,
      cz: 0.8,
      w: 5.5,
      h: 0.1,
      d: 0.2,
    });
  }

  // Junction alcove cutout labels
  geo.label('TUNNEL → GENERATOR', new Vector3(38, TY + 1.5, 0), 2.5);
  geo.label('TUNNEL → CONTROL', new Vector3(5, TY + 1.5, 0), 2.5);
  geo.label('BYPASS (CROUCH)', new Vector3(21, TY + 0.7, -3), 2);
  geo.label('↓ STAFF QUARTERS', new Vector3(20, TY + 1.5, -10), 2);

  // ----- Zone triggers ---------------------------------------------------
  ctx.triggerVolumes.add({
    id: 'trig-tunnel-main',
    aabb: { minX: -8, minY: -5.5, minZ: -2, maxX: 49, maxY: -1, maxZ: 2 },
    repeatable: false,
    onEnter: () => {
      ctx.facilityState.tryAdvancePhase('TunnelAccessed');
      ctx.checkpointRegistry.activate('fg-cp-tunnel-entrance');
      ctx.facilityState.recordZoneDiscovered('fg-zone-tunnel-main');
    },
  });

  ctx.triggerVolumes.add({
    id: 'trig-tunnel-bypass',
    aabb: { minX: 18, minY: -5, minZ: -6, maxX: 24, maxY: -1.5, maxZ: 0 },
    repeatable: false,
    onEnter: () => {
      ctx.facilityState.recordZoneDiscovered('fg-zone-tunnel-bypass');
    },
  });
}
