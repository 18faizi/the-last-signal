import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAYER_CONFIG, validatePlayerConfig } from '../../game/player/PlayerConfig';

describe('validatePlayerConfig', () => {
  it('accepts the shipped defaults', () => {
    expect(validatePlayerConfig(DEFAULT_PLAYER_CONFIG)).toEqual([]);
  });

  it('rejects upward gravity', () => {
    const problems = validatePlayerConfig({ ...DEFAULT_PLAYER_CONFIG, gravityY: 9.81 });
    expect(problems.some((p) => p.includes('gravityY'))).toBe(true);
  });

  it('rejects a crouched height taller than standing', () => {
    const problems = validatePlayerConfig({ ...DEFAULT_PLAYER_CONFIG, crouchedHeight: 2.5 });
    expect(problems.some((p) => p.includes('crouchedHeight'))).toBe(true);
  });

  it('rejects capsules shorter than their diameter', () => {
    const problems = validatePlayerConfig({
      ...DEFAULT_PLAYER_CONFIG,
      colliderRadius: 0.7,
      crouchedHeight: 1.2,
    });
    expect(problems.some((p) => p.includes('capsule geometry'))).toBe(true);
  });

  it('rejects eye heights above the collider top', () => {
    const problems = validatePlayerConfig({ ...DEFAULT_PLAYER_CONFIG, standingEyeHeight: 1.9 });
    expect(problems.some((p) => p.includes('standingEyeHeight'))).toBe(true);
  });

  it('rejects slope limits outside (0, 90)', () => {
    expect(
      validatePlayerConfig({ ...DEFAULT_PLAYER_CONFIG, maxSlopeAngleDeg: 95 }).length,
    ).toBeGreaterThan(0);
    expect(
      validatePlayerConfig({ ...DEFAULT_PLAYER_CONFIG, maxSlopeAngleDeg: 0 }).length,
    ).toBeGreaterThan(0);
  });

  it('rejects inverted pitch limits', () => {
    const problems = validatePlayerConfig({
      ...DEFAULT_PLAYER_CONFIG,
      minPitch: 1,
      maxPitch: -1,
    });
    expect(problems.some((p) => p.includes('minPitch'))).toBe(true);
  });

  it('rejects negative grace windows', () => {
    const problems = validatePlayerConfig({ ...DEFAULT_PLAYER_CONFIG, coyoteTimeSeconds: -0.1 });
    expect(problems.some((p) => p.includes('coyote'))).toBe(true);
  });
});
