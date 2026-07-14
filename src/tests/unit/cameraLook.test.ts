import { describe, expect, it } from 'vitest';
import { applyLookDelta, clampPitch, normalizeAngle } from '../../game/player/CameraLook';

const TUNING = {
  baseSensitivity: 0.002,
  userSensitivity: 1,
  invertY: false,
  minPitch: -1.5,
  maxPitch: 1.5,
};

describe('applyLookDelta', () => {
  it('accumulates yaw from horizontal delta', () => {
    const next = applyLookDelta({ yaw: 0, pitch: 0 }, 100, 0, TUNING);
    expect(next.yaw).toBeCloseTo(0.2);
    expect(next.pitch).toBe(0);
  });

  it('mouse-down looks down when not inverted', () => {
    const next = applyLookDelta({ yaw: 0, pitch: 0 }, 0, 100, TUNING);
    expect(next.pitch).toBeLessThan(0);
  });

  it('invert-Y flips vertical response', () => {
    const normal = applyLookDelta({ yaw: 0, pitch: 0 }, 0, 100, TUNING);
    const inverted = applyLookDelta({ yaw: 0, pitch: 0 }, 0, 100, { ...TUNING, invertY: true });
    expect(inverted.pitch).toBeCloseTo(-normal.pitch);
  });

  it('scales with the user sensitivity multiplier', () => {
    const base = applyLookDelta({ yaw: 0, pitch: 0 }, 50, 0, TUNING);
    const doubled = applyLookDelta({ yaw: 0, pitch: 0 }, 50, 0, {
      ...TUNING,
      userSensitivity: 2,
    });
    expect(doubled.yaw).toBeCloseTo(base.yaw * 2);
  });

  it('clamps pitch at the configured limits', () => {
    const up = applyLookDelta({ yaw: 0, pitch: 1.4 }, 0, -10_000, TUNING);
    expect(up.pitch).toBe(TUNING.maxPitch);
    const down = applyLookDelta({ yaw: 0, pitch: -1.4 }, 0, 10_000, TUNING);
    expect(down.pitch).toBe(TUNING.minPitch);
  });

  it('keeps yaw bounded after large accumulated rotation', () => {
    let state = { yaw: 0, pitch: 0 };
    for (let i = 0; i < 100; i += 1) {
      state = applyLookDelta(state, 500, 0, TUNING);
    }
    expect(state.yaw).toBeGreaterThan(-Math.PI);
    expect(state.yaw).toBeLessThanOrEqual(Math.PI);
  });
});

describe('clampPitch', () => {
  it('passes through in-range values', () => {
    expect(clampPitch(0.5, -1.5, 1.5)).toBe(0.5);
  });
  it('clamps both ends', () => {
    expect(clampPitch(2, -1.5, 1.5)).toBe(1.5);
    expect(clampPitch(-2, -1.5, 1.5)).toBe(-1.5);
  });
});

describe('normalizeAngle', () => {
  it('wraps angles into (-PI, PI]', () => {
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(-Math.PI * 2.5)).toBeCloseTo(-Math.PI * 0.5);
    expect(normalizeAngle(0.3)).toBeCloseTo(0.3);
  });
});
