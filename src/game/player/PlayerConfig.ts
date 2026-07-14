/**
 * Static design configuration for the first-person controller.
 *
 * All tuning lives here — nothing is scattered through the motor or scene
 * code, and none of it goes through Zustand (user *preferences* like mouse
 * sensitivity and invert-Y stay in the settings store).
 *
 * World units are metres; angles are radians unless suffixed otherwise.
 */
export interface PlayerConfig {
  // Collider dimensions
  readonly colliderRadius: number;
  readonly standingHeight: number;
  readonly crouchedHeight: number;
  readonly standingEyeHeight: number;
  readonly crouchedEyeHeight: number;

  // Horizontal movement
  readonly walkSpeed: number;
  readonly sprintSpeed: number;
  readonly crouchSpeed: number;
  readonly groundAcceleration: number;
  readonly groundDeceleration: number;
  readonly airAcceleration: number;
  readonly maxAirControlSpeed: number;

  // Vertical movement
  readonly jumpVelocity: number;
  readonly gravityY: number;
  /** Jump is allowed this long after leaving the ground (coyote time). */
  readonly coyoteTimeSeconds: number;
  /** A jump press this long before landing still triggers on touchdown. */
  readonly jumpBufferSeconds: number;

  // Terrain limits
  readonly maxSlopeAngleDeg: number;
  readonly maxStepHeight: number;

  // Crouch transition
  readonly crouchTransitionSeconds: number;
  readonly headClearanceMargin: number;

  // Probing
  readonly groundProbeDistance: number;

  // Camera
  readonly mouseSensitivityBase: number;
  readonly maxPitch: number;
  readonly minPitch: number;

  // Recovery
  /** Falling below this world Y resets the player to spawn. */
  readonly outOfBoundsY: number;
  /** Whether respawn also resets camera yaw/pitch to the spawn orientation. */
  readonly resetCameraOnRespawn: boolean;

  /** Simulation delta-time clamp; protects against tab-restore spikes. */
  readonly maxDeltaTimeSeconds: number;
}

export const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
  colliderRadius: 0.35,
  standingHeight: 1.8,
  crouchedHeight: 1.2,
  standingEyeHeight: 1.66,
  crouchedEyeHeight: 1.06,

  walkSpeed: 3.2,
  sprintSpeed: 5.4,
  crouchSpeed: 1.6,
  groundAcceleration: 22,
  groundDeceleration: 28,
  airAcceleration: 6,
  maxAirControlSpeed: 3.2,

  jumpVelocity: 4.4,
  gravityY: -9.81,
  coyoteTimeSeconds: 0.1,
  jumpBufferSeconds: 0.1,

  maxSlopeAngleDeg: 46,
  maxStepHeight: 0.35,

  crouchTransitionSeconds: 0.22,
  headClearanceMargin: 0.05,

  groundProbeDistance: 0.6,

  // Radians of rotation per pixel of mouse movement before the user
  // sensitivity multiplier is applied. Deliberately NOT scaled by delta
  // time: browser mouse deltas are already per-event displacement.
  mouseSensitivityBase: 0.0022,
  maxPitch: (89 * Math.PI) / 180,
  minPitch: (-89 * Math.PI) / 180,

  outOfBoundsY: -12,
  resetCameraOnRespawn: false,

  maxDeltaTimeSeconds: 0.05,
};

/** Returns human-readable problems; an empty array means the config is valid. */
export function validatePlayerConfig(config: PlayerConfig): string[] {
  const problems: string[] = [];
  const positive: Array<[string, number]> = [
    ['colliderRadius', config.colliderRadius],
    ['standingHeight', config.standingHeight],
    ['crouchedHeight', config.crouchedHeight],
    ['walkSpeed', config.walkSpeed],
    ['sprintSpeed', config.sprintSpeed],
    ['crouchSpeed', config.crouchSpeed],
    ['groundAcceleration', config.groundAcceleration],
    ['groundDeceleration', config.groundDeceleration],
    ['airAcceleration', config.airAcceleration],
    ['jumpVelocity', config.jumpVelocity],
    ['crouchTransitionSeconds', config.crouchTransitionSeconds],
    ['groundProbeDistance', config.groundProbeDistance],
    ['mouseSensitivityBase', config.mouseSensitivityBase],
    ['maxDeltaTimeSeconds', config.maxDeltaTimeSeconds],
  ];
  for (const [name, value] of positive) {
    if (!Number.isFinite(value) || value <= 0) {
      problems.push(`${name} must be a positive number, got ${value}`);
    }
  }
  if (config.gravityY >= 0) {
    problems.push(`gravityY must be negative (downward), got ${config.gravityY}`);
  }
  if (config.crouchedHeight >= config.standingHeight) {
    problems.push('crouchedHeight must be smaller than standingHeight');
  }
  if (config.standingHeight < 2 * config.colliderRadius) {
    problems.push('standingHeight must be at least twice colliderRadius (capsule geometry)');
  }
  if (config.crouchedHeight < 2 * config.colliderRadius) {
    problems.push('crouchedHeight must be at least twice colliderRadius (capsule geometry)');
  }
  if (config.standingEyeHeight >= config.standingHeight) {
    problems.push('standingEyeHeight must sit below the top of the standing collider');
  }
  if (config.crouchedEyeHeight >= config.crouchedHeight) {
    problems.push('crouchedEyeHeight must sit below the top of the crouched collider');
  }
  if (config.maxSlopeAngleDeg <= 0 || config.maxSlopeAngleDeg >= 90) {
    problems.push(`maxSlopeAngleDeg must be in (0, 90), got ${config.maxSlopeAngleDeg}`);
  }
  if (config.maxStepHeight < 0) {
    problems.push('maxStepHeight must not be negative');
  }
  if (config.minPitch >= config.maxPitch) {
    problems.push('minPitch must be below maxPitch');
  }
  if (config.maxPitch > Math.PI / 2 || config.minPitch < -Math.PI / 2) {
    problems.push('pitch limits must stay within ±90 degrees');
  }
  if (config.coyoteTimeSeconds < 0 || config.jumpBufferSeconds < 0) {
    problems.push('coyoteTimeSeconds and jumpBufferSeconds must not be negative');
  }
  return problems;
}
