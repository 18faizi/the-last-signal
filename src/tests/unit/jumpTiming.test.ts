import { describe, expect, it } from 'vitest';
import {
  advanceJumpTiming,
  consumeJump,
  INITIAL_JUMP_TIMING,
  shouldJump,
  type JumpTimingState,
} from '../../game/player/JumpTiming';

const CONFIG = { coyoteTimeSeconds: 0.1, jumpBufferSeconds: 0.1 };

function step(
  state: JumpTimingState,
  dt: number,
  grounded: boolean,
  jumpPressed = false,
): JumpTimingState {
  return advanceJumpTiming(state, dt, { grounded, jumpPressed });
}

describe('jump timing', () => {
  it('does not jump without a press', () => {
    const state = step(INITIAL_JUMP_TIMING, 0.016, true);
    expect(shouldJump(state, CONFIG)).toBe(false);
  });

  it('jumps when pressed while grounded', () => {
    const state = step(INITIAL_JUMP_TIMING, 0.016, true, true);
    expect(shouldJump(state, CONFIG)).toBe(true);
  });

  it('allows a coyote jump shortly after leaving the ground', () => {
    let state = step(INITIAL_JUMP_TIMING, 0.016, true);
    state = step(state, 0.05, false); // left ground 50 ms ago
    state = step(state, 0.016, false, true); // press mid-air
    expect(shouldJump(state, CONFIG)).toBe(true);
  });

  it('rejects a jump after the coyote window closes', () => {
    let state = step(INITIAL_JUMP_TIMING, 0.016, true);
    state = step(state, 0.2, false); // airborne 200 ms
    state = step(state, 0.016, false, true);
    expect(shouldJump(state, CONFIG)).toBe(false);
  });

  it('buffers a press made just before landing', () => {
    let state = step(INITIAL_JUMP_TIMING, 0.016, false, true); // press in air
    state = step(state, 0.05, false);
    state = step(state, 0.016, true); // touch down within buffer window
    expect(shouldJump(state, CONFIG)).toBe(true);
  });

  it('expires a buffered press that is too old', () => {
    let state = step(INITIAL_JUMP_TIMING, 0.016, false, true);
    state = step(state, 0.3, false);
    state = step(state, 0.016, true);
    expect(shouldJump(state, CONFIG)).toBe(false);
  });

  it('consuming the jump prevents a double jump from one press', () => {
    let state = step(INITIAL_JUMP_TIMING, 0.016, true, true);
    expect(shouldJump(state, CONFIG)).toBe(true);
    state = consumeJump(state);
    expect(shouldJump(state, CONFIG)).toBe(false);
    // Even immediately re-advancing airborne does not re-fire.
    state = step(state, 0.016, false);
    expect(shouldJump(state, CONFIG)).toBe(false);
  });
});
