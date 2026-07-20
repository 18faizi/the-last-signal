/**
 * Plain-data movement intent produced by ThreatBehaviorController each tick
 * and consumed by the scene adapter, which applies it as a KINEMATIC
 * transform on the pooled actor mesh (mirrors doors/antennas — no rigid
 * body, no physics impulses, no tumbling).
 */
import type { Point3 } from '../../facility/FacilityZone';

export interface ThreatMovementIntent {
  /** Current logical world position of the threat actor. */
  readonly position: Point3;
  /** Facing yaw in radians (faces the movement direction, or a target). */
  readonly facingYaw: number;
  /** True while translating this tick (drives subtle scene-side cues). */
  readonly moving: boolean;
}

export function createMovementIntent(position: Point3, facingYaw: number): ThreatMovementIntent {
  return { position: { ...position }, facingYaw, moving: false };
}
