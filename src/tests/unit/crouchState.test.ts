import { describe, expect, it } from 'vitest';
import { isCrouchedState, updateCrouchState } from '../../game/player/CrouchState';

describe('updateCrouchState', () => {
  it('crouches while the key is held', () => {
    expect(updateCrouchState('standing', { crouchHeld: true, clearanceAvailable: true })).toBe(
      'crouched',
    );
  });

  it('stays standing when nothing is held', () => {
    expect(updateCrouchState('standing', { crouchHeld: false, clearanceAvailable: true })).toBe(
      'standing',
    );
  });

  it('stands on release when clearance exists', () => {
    expect(updateCrouchState('crouched', { crouchHeld: false, clearanceAvailable: true })).toBe(
      'standing',
    );
  });

  it('blocks standing under low geometry', () => {
    expect(updateCrouchState('crouched', { crouchHeld: false, clearanceAvailable: false })).toBe(
      'stand-blocked',
    );
  });

  it('stands promptly once clearance appears while stand-blocked', () => {
    expect(
      updateCrouchState('stand-blocked', { crouchHeld: false, clearanceAvailable: true }),
    ).toBe('standing');
  });

  it('remains blocked while clearance is missing', () => {
    expect(
      updateCrouchState('stand-blocked', { crouchHeld: false, clearanceAvailable: false }),
    ).toBe('stand-blocked');
  });

  it('re-crouches from stand-blocked when the key is held again', () => {
    expect(
      updateCrouchState('stand-blocked', { crouchHeld: true, clearanceAvailable: false }),
    ).toBe('crouched');
  });

  it('classifies crouched-like states', () => {
    expect(isCrouchedState('crouched')).toBe(true);
    expect(isCrouchedState('stand-blocked')).toBe(true);
    expect(isCrouchedState('standing')).toBe(false);
  });
});
