import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../config/gameConfig';
import { performanceConfig, validatePerformanceConfig } from '../../config/performanceConfig';

describe('performance config validation', () => {
  it('accepts the shipped configuration', () => {
    expect(validatePerformanceConfig(performanceConfig)).toEqual([]);
  });

  it('rejects a non-positive target FPS', () => {
    const problems = validatePerformanceConfig({ ...performanceConfig, targetFps: 0 });
    expect(problems.some((p) => p.includes('targetFps'))).toBe(true);
  });

  it('rejects a pixel-ratio cap below 1', () => {
    const problems = validatePerformanceConfig({ ...performanceConfig, maxDevicePixelRatio: 0.5 });
    expect(problems.some((p) => p.includes('maxDevicePixelRatio'))).toBe(true);
  });

  it('rejects per-frame debug overlay refresh intervals', () => {
    const problems = validatePerformanceConfig({
      ...performanceConfig,
      debugOverlayUpdateIntervalMs: 1,
    });
    expect(problems.some((p) => p.includes('debugOverlayUpdateIntervalMs'))).toBe(true);
  });
});

describe('game config', () => {
  it('declares downward gravity', () => {
    expect(gameConfig.gravity.y).toBeLessThan(0);
  });

  it('keeps audio defaults within [0, 1]', () => {
    for (const value of Object.values(gameConfig.audio)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
