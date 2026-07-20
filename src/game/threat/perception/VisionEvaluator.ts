/**
 * Pure, deterministic vision evaluation (Milestone 0.9).
 *
 * ARCHITECTURE DECISION — the LOS split: this evaluator NEVER raycasts. The
 * physical line-of-sight occlusion test lives in the scene-side adapter
 * (buildThreatEventBindings.ts), which owns one reused Ray + Vector3 pair and
 * probes at a controlled cadence (not every frame), feeding the resulting
 * `losBlocked` boolean into this pure function. That keeps the perception
 * domain Babylon-free and unit-testable with plain numbers, and keeps all
 * raycast cost scoped to the adapter (zero while the threat is dormant).
 *
 * The score is an explicit product of authored, inspectable factors — no
 * omniscience: distance window, FOV window, vertical tolerance, occlusion,
 * distance falloff, lighting exposure, movement multiplier, hiding override,
 * peripheral penalty, behind-threat difficulty. Deterministic: same inputs,
 * same score, no randomness anywhere.
 */
import type { Point3 } from '../../facility/FacilityZone';
import type { ThreatVisionConfig } from '../ThreatDefinition';

export type PlayerStance = 'sprint' | 'walk' | 'crouch' | 'still';

export interface VisionInput {
  readonly threatPosition: Point3;
  /** Threat facing yaw in radians (same convention as the player: 0 = +Z). */
  readonly threatFacingYaw: number;
  readonly playerPosition: Point3;
  /** Result of the scene-side occlusion probe (true = wall in the way). */
  readonly losBlocked: boolean;
  /** Normalized 0-1 lighting/stance exposure from ExposureEvaluator. */
  readonly exposure: number;
  readonly playerStance: PlayerStance;
  /** True when the player occupies a fully-hiding spot — hard zero. */
  readonly playerFullyHidden: boolean;
}

export interface VisionResult {
  /** 0-1 visibility score feeding the suspicion/detection model. */
  readonly score: number;
  /** True when the player is inside distance + FOV + vertical windows. */
  readonly inCone: boolean;
  /** True when the player is within the outer third of the FOV cone. */
  readonly peripheral: boolean;
  /** True when the player is outside the FOV entirely (behind the threat). */
  readonly behind: boolean;
  readonly distance: number;
}

const NO_VISION: Omit<VisionResult, 'distance'> = {
  score: 0,
  inCone: false,
  peripheral: false,
  behind: false,
};

export function stanceMultiplier(config: ThreatVisionConfig, stance: PlayerStance): number {
  switch (stance) {
    case 'sprint':
      return config.sprintMultiplier;
    case 'walk':
      return config.walkMultiplier;
    case 'crouch':
      return config.crouchMultiplier;
    case 'still':
      // A motionless player is as hard to see as a crouched one.
      return config.crouchMultiplier;
  }
}

export function evaluateVision(config: ThreatVisionConfig, input: VisionInput): VisionResult {
  const dx = input.playerPosition.x - input.threatPosition.x;
  const dy = input.playerPosition.y - input.threatPosition.y;
  const dz = input.playerPosition.z - input.threatPosition.z;
  const horizontalDistance = Math.hypot(dx, dz);
  const distance = Math.hypot(dx, dy, dz);

  // Hard windows first — outside any of them the score is exactly 0.
  if (input.playerFullyHidden) {
    return { ...NO_VISION, distance };
  }
  if (distance > config.maxViewDistance) {
    return { ...NO_VISION, distance };
  }
  if (Math.abs(dy) > config.verticalToleranceMeters) {
    return { ...NO_VISION, distance };
  }

  // Angle between threat facing and the direction to the player (yaw plane).
  // Facing convention matches the camera rig: yaw 0 looks along +Z.
  const angleToPlayer = Math.atan2(dx, dz);
  let delta = angleToPlayer - input.threatFacingYaw;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  const halfFovRad = (config.horizontalFovDeg * Math.PI) / 360;
  const behind = Math.abs(delta) > halfFovRad;
  const peripheral = !behind && Math.abs(delta) > halfFovRad * (2 / 3);

  if (input.losBlocked) {
    return { score: 0, inCone: !behind, peripheral, behind, distance };
  }

  // Distance falloff: 1 inside falloffStartDistance, linear to 0 at max.
  let falloff = 1;
  if (horizontalDistance > config.falloffStartDistance) {
    const range = Math.max(config.maxViewDistance - config.falloffStartDistance, 1e-6);
    falloff = Math.max(0, 1 - (horizontalDistance - config.falloffStartDistance) / range);
  }

  const angleFactor = behind ? config.behindMultiplier : peripheral ? config.peripheralPenalty : 1;

  const exposure = Math.min(Math.max(input.exposure, 0), 1);
  const movement = stanceMultiplier(config, input.playerStance);

  const score = Math.min(Math.max(falloff * angleFactor * exposure * movement, 0), 1);
  return { score, inCone: !behind, peripheral, behind, distance };
}
