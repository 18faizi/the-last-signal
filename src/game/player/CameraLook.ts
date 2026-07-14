/**
 * Pure yaw/pitch math for mouse look. Kept free of Babylon so the clamp and
 * inversion behavior is unit-testable.
 *
 * Mouse deltas are per-event pixel displacements — they are NOT multiplied
 * by frame delta time. Scaling displacement by dt would make look speed
 * frame-rate dependent, which is exactly the bug this comment exists to
 * prevent reintroducing.
 */
export interface LookState {
  readonly yaw: number;
  readonly pitch: number;
}

export interface LookTuning {
  /** Radians per pixel before the user preference multiplier. */
  readonly baseSensitivity: number;
  /** User preference multiplier from the settings store. */
  readonly userSensitivity: number;
  readonly invertY: boolean;
  readonly minPitch: number;
  readonly maxPitch: number;
}

export function applyLookDelta(
  state: LookState,
  deltaX: number,
  deltaY: number,
  tuning: LookTuning,
): LookState {
  const scale = tuning.baseSensitivity * tuning.userSensitivity;
  const yaw = normalizeAngle(state.yaw + deltaX * scale);
  const pitchDelta = (tuning.invertY ? -deltaY : deltaY) * scale;
  // Screen-space +Y is downward; uninverted mouse-down should look down
  // (decrease pitch), hence the subtraction.
  const pitch = clampPitch(state.pitch - pitchDelta, tuning.minPitch, tuning.maxPitch);
  return { yaw, pitch };
}

export function clampPitch(pitch: number, minPitch: number, maxPitch: number): number {
  return Math.min(maxPitch, Math.max(minPitch, pitch));
}

/** Keeps yaw within (-PI, PI] so it never grows unbounded. */
export function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  let result = angle % twoPi;
  if (result > Math.PI) {
    result -= twoPi;
  } else if (result <= -Math.PI) {
    result += twoPi;
  }
  return result;
}
