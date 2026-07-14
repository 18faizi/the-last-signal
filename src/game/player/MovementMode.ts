/**
 * Coarse movement mode derived from motor state each frame. Used by the
 * debug overlay, the test bridge and (later) audio/animation systems.
 */
export type MovementMode = 'idle' | 'walking' | 'sprinting' | 'crouching' | 'airborne';

/** Speeds below this are treated as standing still. */
const IDLE_SPEED_EPSILON = 0.15;

export function selectMovementMode(state: {
  grounded: boolean;
  horizontalSpeed: number;
  sprinting: boolean;
  crouched: boolean;
}): MovementMode {
  if (!state.grounded) {
    return 'airborne';
  }
  if (state.crouched) {
    return 'crouching';
  }
  if (state.horizontalSpeed < IDLE_SPEED_EPSILON) {
    return 'idle';
  }
  return state.sprinting ? 'sprinting' : 'walking';
}
