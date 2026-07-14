import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../../core/input/InputAction';
import {
  computeMoveAxes,
  computeMovementIntent,
  isSprintAllowed,
  type MovementIntent,
} from '../../game/player/MovementIntent';

function pressed(...codes: string[]): ReadonlySet<string> {
  return new Set(codes);
}

const NONE = pressed();

describe('computeMoveAxes', () => {
  it('maps single keys to unit axes', () => {
    expect(computeMoveAxes(pressed('KeyW'), DEFAULT_BINDINGS)).toEqual({ x: 0, z: 1 });
    expect(computeMoveAxes(pressed('KeyS'), DEFAULT_BINDINGS)).toEqual({ x: 0, z: -1 });
    expect(computeMoveAxes(pressed('KeyD'), DEFAULT_BINDINGS)).toEqual({ x: 1, z: 0 });
    expect(computeMoveAxes(pressed('KeyA'), DEFAULT_BINDINGS)).toEqual({ x: -1, z: 0 });
  });

  it('cancels opposing inputs exactly', () => {
    expect(computeMoveAxes(pressed('KeyW', 'KeyS'), DEFAULT_BINDINGS)).toEqual({ x: 0, z: 0 });
    expect(computeMoveAxes(pressed('KeyA', 'KeyD'), DEFAULT_BINDINGS)).toEqual({ x: 0, z: 0 });
  });

  it('normalizes diagonals so they are never faster than straight movement', () => {
    const { x, z } = computeMoveAxes(pressed('KeyW', 'KeyD'), DEFAULT_BINDINGS);
    expect(Math.hypot(x, z)).toBeCloseTo(1);
    expect(x).toBeCloseTo(Math.SQRT1_2);
    expect(z).toBeCloseTo(Math.SQRT1_2);
  });

  it('returns zero for no input', () => {
    expect(computeMoveAxes(NONE, DEFAULT_BINDINGS)).toEqual({ x: 0, z: 0 });
  });
});

describe('computeMovementIntent', () => {
  it('fires jumpPressed only on the press transition, not while held', () => {
    const first = computeMovementIntent(pressed('Space'), NONE, DEFAULT_BINDINGS);
    expect(first.jumpPressed).toBe(true);
    const held = computeMovementIntent(pressed('Space'), pressed('Space'), DEFAULT_BINDINGS);
    expect(held.jumpPressed).toBe(false);
    const released = computeMovementIntent(NONE, pressed('Space'), DEFAULT_BINDINGS);
    expect(released.jumpPressed).toBe(false);
  });

  it('fires resetPressed only on the press transition', () => {
    expect(computeMovementIntent(pressed('KeyR'), NONE, DEFAULT_BINDINGS).resetPressed).toBe(true);
    expect(
      computeMovementIntent(pressed('KeyR'), pressed('KeyR'), DEFAULT_BINDINGS).resetPressed,
    ).toBe(false);
  });

  it('reports held sprint and crouch', () => {
    const intent = computeMovementIntent(pressed('ShiftLeft', 'KeyC'), NONE, DEFAULT_BINDINGS);
    expect(intent.sprintHeld).toBe(true);
    expect(intent.crouchHeld).toBe(true);
  });
});

describe('isSprintAllowed', () => {
  function intent(overrides: Partial<MovementIntent>): MovementIntent {
    return {
      moveX: 0,
      moveZ: 1,
      sprintHeld: true,
      crouchHeld: false,
      jumpPressed: false,
      resetPressed: false,
      ...overrides,
    };
  }

  it('allows forward sprint while standing', () => {
    expect(isSprintAllowed(intent({}), false)).toBe(true);
  });

  it('rejects sprint while crouched', () => {
    expect(isSprintAllowed(intent({}), true)).toBe(false);
  });

  it('rejects sprint without the key held', () => {
    expect(isSprintAllowed(intent({ sprintHeld: false }), false)).toBe(false);
  });

  it('rejects sprint without meaningful directional input', () => {
    expect(isSprintAllowed(intent({ moveZ: 0 }), false)).toBe(false);
  });

  it('rejects backward sprint (documented design choice)', () => {
    expect(isSprintAllowed(intent({ moveZ: -1 }), false)).toBe(false);
  });

  it('allows forward-diagonal sprint', () => {
    expect(isSprintAllowed(intent({ moveX: Math.SQRT1_2, moveZ: Math.SQRT1_2 }), false)).toBe(true);
  });
});
