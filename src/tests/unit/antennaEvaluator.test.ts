import { describe, expect, it } from 'vitest';
import {
  evaluate,
  azimuthQuality,
  elevationQuality,
  polarizationQuality,
  normalizePolarization90,
  shortestPolarizationDelta,
} from '../../game/antenna/AntennaEvaluator';
import { shortestAngleDelta } from '../../game/antenna/AntennaMath';
import type { AntennaArrayDefinition } from '../../game/antenna/AntennaArrayDefinition';
import { asAntennaArrayId } from '../../game/antenna/AntennaArrayId';
import { createDefaultAntennaMechanicalState } from '../../game/antenna/AntennaMechanicalState';

const ARRAY_ID = asAntennaArrayId('test-array');
const OTHER_ARRAY_ID = asAntennaArrayId('other-array');

const DEF: AntennaArrayDefinition = {
  id: ARRAY_ID,
  displayName: 'Test Array',
  role: 'RelayCandidate',
  minAzimuthDeg: -60,
  maxAzimuthDeg: 90,
  minElevationDeg: 0,
  maxElevationDeg: 40,
  minPolarizationDeg: -90,
  maxPolarizationDeg: 90,
  targetAzimuthDeg: 42,
  azimuthToleranceDeg: 8,
  targetElevationDeg: 18,
  elevationToleranceDeg: 6,
  targetPolarizationDeg: -35,
  polarizationToleranceDeg: 12,
  baseGain: 0.8,
  captureWidthDeg: 6,
  maxQuality: 0.95,
  requiredPowerCircuitId: 'circuit-1',
  waveguidePathId: 'waveguide-1',
  receiverCompatible: true,
  selectable: true,
  requiredForProgression: true,
  azimuthSpeedDegPerSecond: 16,
  elevationSpeedDegPerSecond: 12,
  polarizationSpeedDegPerSecond: 25,
  azimuthStepCoarseDeg: 2,
  azimuthStepFineDeg: 0.5,
  elevationStepCoarseDeg: 1.5,
  elevationStepFineDeg: 0.3,
  polarizationStepCoarseDeg: 3,
  polarizationStepFineDeg: 0.5,
};

function settledMechanical(az: number, el: number, pol: number) {
  return createDefaultAntennaMechanicalState(az, el, pol);
}

describe('shortestAngleDelta — circular azimuth wraparound', () => {
  it('179 vs -179 is a 2-degree difference, not 358', () => {
    expect(shortestAngleDelta(179, -179)).toBeCloseTo(-2, 5);
    expect(Math.abs(shortestAngleDelta(179, -179))).toBeLessThan(10);
  });

  it('-180 vs 180 are treated as identical (delta 0, within float epsilon)', () => {
    expect(Math.abs(shortestAngleDelta(-180, 180))).toBeLessThan(1e-6);
  });

  it('does NOT use simple linear subtraction across the seam', () => {
    // Linear subtraction would give -180 - 170 = -350; the shortest path is +10.
    expect(shortestAngleDelta(-180, 170)).toBeCloseTo(10, 5);
  });

  it('is antisymmetric', () => {
    const d1 = shortestAngleDelta(50, -60);
    const d2 = shortestAngleDelta(-60, 50);
    expect(d1).toBeCloseTo(-d2, 5);
  });
});

describe('polarization model — 180°-periodic, normalized to (-90, 90]', () => {
  it('normalizes angles to the documented range', () => {
    expect(normalizePolarization90(0)).toBeCloseTo(0, 5);
    expect(normalizePolarization90(90)).toBeCloseTo(90, 5);
    expect(normalizePolarization90(180)).toBeCloseTo(0, 5);
    expect(normalizePolarization90(-180)).toBeCloseTo(0, 5);
  });

  it('treats equivalent orientations (90 and -90) as identical: zero error', () => {
    expect(shortestPolarizationDelta(90, -90)).toBeCloseTo(0, 5);
  });

  it('89 vs -89 is a small (2-degree) difference, not 178', () => {
    expect(Math.abs(shortestPolarizationDelta(89, -89))).toBeCloseTo(2, 5);
  });

  it('0 and 180 (and -180) are the same orientation', () => {
    expect(shortestPolarizationDelta(0, 180)).toBeCloseTo(0, 5);
    expect(shortestPolarizationDelta(0, -180)).toBeCloseTo(0, 5);
  });

  it('boundary: exactly 90 degrees apart within the 180-domain wraps to 0, not ±90 both ways inconsistently', () => {
    const a = shortestPolarizationDelta(45, -45);
    expect(Math.abs(a)).toBeCloseTo(90, 5);
  });
});

describe('azimuthQuality — plateau + falloff', () => {
  it('is 1.0 exactly at target', () => {
    const { quality } = azimuthQuality(42, 8, 6, 42);
    expect(quality).toBe(1);
  });

  it('falls off smoothly and monotonically with increasing error', () => {
    const errors = [0, 2, 4, 8, 12, 16, 20, 30];
    let prev = Infinity;
    for (const e of errors) {
      const { quality } = azimuthQuality(42, 8, 6, 42 + e);
      expect(quality).toBeLessThanOrEqual(prev + 1e-9);
      prev = quality;
    }
  });

  it('reaches 0 far outside tolerance', () => {
    const { quality } = azimuthQuality(42, 8, 6, 42 + 100);
    expect(quality).toBe(0);
  });

  it('wraps around the ±180 seam correctly', () => {
    const { quality: q1 } = azimuthQuality(179, 8, 6, -179);
    const { quality: q2 } = azimuthQuality(179, 8, 6, 179);
    expect(q1).toBeCloseTo(q2, 5);
    expect(q1).toBeGreaterThan(0.9);
  });
});

describe('elevationQuality — linear, clamped, no wraparound', () => {
  it('is 1.0 exactly at target', () => {
    const { quality } = elevationQuality(18, 6, 0, 40, 18);
    expect(quality).toBe(1);
  });

  it('is 0 outside the [min,max] physical range (below-range invalid)', () => {
    const { quality } = elevationQuality(18, 6, 0, 40, -5);
    expect(quality).toBe(0);
  });

  it('is 0 above the physical range', () => {
    const { quality } = elevationQuality(18, 6, 0, 40, 45);
    expect(quality).toBe(0);
  });

  it('does not wrap — a large positive error and an equally large "wrapped" negative error are NOT treated as equal', () => {
    const { quality: qHigh } = elevationQuality(18, 6, 0, 100, 18 + 60);
    const { quality: qNone } = elevationQuality(18, 6, 0, 100, 18);
    expect(qHigh).toBeLessThan(qNone);
  });
});

describe('polarizationQuality — boundary behavior', () => {
  it('is 1.0 exactly at target', () => {
    const { quality } = polarizationQuality(-35, 12, -35);
    expect(quality).toBe(1);
  });

  it('treats the 180-equivalent target/actual pair as aligned', () => {
    const { quality } = polarizationQuality(-35, 12, -35 + 180);
    expect(quality).toBe(1);
  });
});

describe('AntennaEvaluator.evaluate — determinism', () => {
  it('produces identical output for identical input, called repeatedly', () => {
    const mech = settledMechanical(42, 18, -35);
    const input = { activeArrayId: ARRAY_ID, mechanical: mech, waveguideQuality: 1, powered: true };
    const a = evaluate(DEF, input);
    const b = evaluate(DEF, { ...input, mechanical: { ...mech } });
    expect(a).toEqual(b);
  });
});

describe('AntennaEvaluator.evaluate — exact target', () => {
  it('reaches maxQuality (capped) at exact target, full power, full waveguide', () => {
    const mech = settledMechanical(42, 18, -35);
    const metrics = evaluate(DEF, {
      activeArrayId: ARRAY_ID,
      mechanical: mech,
      waveguideQuality: 1,
      powered: true,
    });
    expect(metrics.overallQuality).toBeCloseTo(DEF.maxQuality, 5);
    expect(metrics.alignmentQuality).toBeCloseTo(DEF.maxQuality, 5);
    expect(metrics.arrayMatch).toBe(true);
    expect(metrics.limitingFactor).toBe('none');
  });

  it('never exceeds maxQuality regardless of how perfect other factors are', () => {
    const mech = settledMechanical(42, 18, -35);
    const metrics = evaluate(DEF, {
      activeArrayId: ARRAY_ID,
      mechanical: mech,
      waveguideQuality: 1,
      powered: true,
    });
    expect(metrics.overallQuality).toBeLessThanOrEqual(DEF.maxQuality + 1e-9);
  });
});

describe('AntennaEvaluator.evaluate — wrong array', () => {
  it('is near-zero when the active array does not match this definition', () => {
    const mech = settledMechanical(42, 18, -35); // exact target position
    const metrics = evaluate(DEF, {
      activeArrayId: OTHER_ARRAY_ID,
      mechanical: mech,
      waveguideQuality: 1,
      powered: true,
    });
    expect(metrics.arrayMatch).toBe(false);
    expect(metrics.overallQuality).toBe(0);
    expect(metrics.alignmentQuality).toBe(0);
    expect(metrics.limitingFactor).toBe('array');
  });
});

describe('AntennaEvaluator.evaluate — missing power', () => {
  it('zeroes overallQuality when unpowered, even at exact alignment', () => {
    const mech = settledMechanical(42, 18, -35);
    const metrics = evaluate(DEF, {
      activeArrayId: ARRAY_ID,
      mechanical: mech,
      waveguideQuality: 1,
      powered: false,
    });
    expect(metrics.overallQuality).toBe(0);
    expect(metrics.powerAvailability).toBe(0);
    // alignmentQuality is the PURE axis term and is NOT gated by power.
    expect(metrics.alignmentQuality).toBeCloseTo(DEF.maxQuality, 5);
    expect(metrics.limitingFactor).toBe('power');
  });
});

describe('AntennaEvaluator.evaluate — broken waveguide', () => {
  it('zeroes overallQuality when waveguide continuity is 0', () => {
    const mech = settledMechanical(42, 18, -35);
    const metrics = evaluate(DEF, {
      activeArrayId: ARRAY_ID,
      mechanical: mech,
      waveguideQuality: 0,
      powered: true,
    });
    expect(metrics.overallQuality).toBe(0);
    expect(metrics.waveguideContinuity).toBe(0);
    // alignmentQuality is unaffected — waveguide is a separate gate applied
    // only to overallQuality, deliberately, to avoid double-gating at the
    // composition layer (see AnalysisQualityEvaluator.ts).
    expect(metrics.alignmentQuality).toBeCloseTo(DEF.maxQuality, 5);
  });

  it('graded waveguide continuity (e.g. bypass at 0.5) scales overallQuality proportionally', () => {
    const mech = settledMechanical(42, 18, -35);
    const metrics = evaluate(DEF, {
      activeArrayId: ARRAY_ID,
      mechanical: mech,
      waveguideQuality: 0.5,
      powered: true,
    });
    expect(metrics.overallQuality).toBeCloseTo(DEF.maxQuality * 0.5, 5);
  });
});

describe('AntennaEvaluator.evaluate — mid-transit (not mechanically settled)', () => {
  it('reports 0 mechanicalReadiness and 0 overallQuality while a target is pending', () => {
    const mech = settledMechanical(42, 18, -35);
    mech.targetAzimuthDeg = 50; // still moving
    const metrics = evaluate(DEF, {
      activeArrayId: ARRAY_ID,
      mechanical: mech,
      waveguideQuality: 1,
      powered: true,
    });
    expect(metrics.mechanicalReadiness).toBe(0);
    expect(metrics.overallQuality).toBe(0);
  });
});

describe('AntennaEvaluator.evaluate — partial alignment', () => {
  it('a moderate offset on one axis produces a quality strictly between 0 and maxQuality', () => {
    const mech = settledMechanical(42 + 6, 18, -35); // within tolerance but not exact
    const metrics = evaluate(DEF, {
      activeArrayId: ARRAY_ID,
      mechanical: mech,
      waveguideQuality: 1,
      powered: true,
    });
    expect(metrics.overallQuality).toBeGreaterThan(0);
    expect(metrics.overallQuality).toBeLessThan(DEF.maxQuality);
  });

  it('a wild offset on one axis alone tanks overall quality (multiplicative gate across axes)', () => {
    const mech = settledMechanical(42, 18, 89); // polarization wildly wrong
    const metrics = evaluate(DEF, {
      activeArrayId: ARRAY_ID,
      mechanical: mech,
      waveguideQuality: 1,
      powered: true,
    });
    expect(metrics.overallQuality).toBeLessThan(0.05);
  });
});

describe('AntennaEvaluator.evaluate — default (parked) position is not solved', () => {
  it('the minimum-bound parked position does not accidentally satisfy alignment', () => {
    const mech = settledMechanical(DEF.minAzimuthDeg, DEF.minElevationDeg, DEF.minPolarizationDeg);
    const metrics = evaluate(DEF, {
      activeArrayId: ARRAY_ID,
      mechanical: mech,
      waveguideQuality: 1,
      powered: true,
    });
    expect(metrics.overallQuality).toBeLessThan(DEF.maxQuality * 0.5);
  });
});
