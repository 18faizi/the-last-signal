import { describe, expect, it } from 'vitest';
import { selectMovementMode } from '../../game/player/MovementMode';

describe('selectMovementMode', () => {
  it('reports airborne whenever ungrounded, regardless of stance', () => {
    expect(
      selectMovementMode({ grounded: false, horizontalSpeed: 0, sprinting: false, crouched: true }),
    ).toBe('airborne');
    expect(
      selectMovementMode({ grounded: false, horizontalSpeed: 5, sprinting: true, crouched: false }),
    ).toBe('airborne');
  });

  it('reports crouching while grounded and crouched', () => {
    expect(
      selectMovementMode({
        grounded: true,
        horizontalSpeed: 1.5,
        sprinting: false,
        crouched: true,
      }),
    ).toBe('crouching');
  });

  it('reports idle below the speed epsilon', () => {
    expect(
      selectMovementMode({
        grounded: true,
        horizontalSpeed: 0.05,
        sprinting: false,
        crouched: false,
      }),
    ).toBe('idle');
  });

  it('distinguishes walking from sprinting', () => {
    expect(
      selectMovementMode({ grounded: true, horizontalSpeed: 3, sprinting: false, crouched: false }),
    ).toBe('walking');
    expect(
      selectMovementMode({ grounded: true, horizontalSpeed: 5, sprinting: true, crouched: false }),
    ).toBe('sprinting');
  });
});
