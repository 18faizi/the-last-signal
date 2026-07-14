/**
 * Coyote-time and jump-buffer bookkeeping.
 *
 * Pure, time-based state: the caller advances it with delta time and events
 * (left ground, landed, jump pressed) and asks whether a jump should fire.
 * Both windows are configurable and default to 100 ms.
 */
export interface JumpTimingConfig {
  readonly coyoteTimeSeconds: number;
  readonly jumpBufferSeconds: number;
}

export interface JumpTimingState {
  /** Seconds since the player was last grounded. 0 while grounded. */
  readonly timeSinceGrounded: number;
  /** Seconds since jump was pressed; Infinity when no press is buffered. */
  readonly timeSinceJumpPressed: number;
}

export const INITIAL_JUMP_TIMING: JumpTimingState = {
  timeSinceGrounded: Number.POSITIVE_INFINITY,
  timeSinceJumpPressed: Number.POSITIVE_INFINITY,
};

export function advanceJumpTiming(
  state: JumpTimingState,
  deltaSeconds: number,
  events: { grounded: boolean; jumpPressed: boolean },
): JumpTimingState {
  return {
    timeSinceGrounded: events.grounded ? 0 : state.timeSinceGrounded + deltaSeconds,
    timeSinceJumpPressed: events.jumpPressed ? 0 : state.timeSinceJumpPressed + deltaSeconds,
  };
}

/**
 * A jump fires when a recent-enough press meets a recent-enough grounded
 * state — covering plain grounded jumps, coyote jumps just after walking off
 * a ledge, and buffered presses just before landing.
 */
export function shouldJump(state: JumpTimingState, config: JumpTimingConfig): boolean {
  return (
    state.timeSinceJumpPressed <= config.jumpBufferSeconds &&
    state.timeSinceGrounded <= config.coyoteTimeSeconds
  );
}

/** Consumes the buffered press so one press never fires two jumps. */
export function consumeJump(_state: JumpTimingState): JumpTimingState {
  return {
    // Leaving the ground is recorded immediately so a held/late press
    // cannot re-fire within the same coyote window.
    timeSinceGrounded: Number.POSITIVE_INFINITY,
    timeSinceJumpPressed: Number.POSITIVE_INFINITY,
  };
}
