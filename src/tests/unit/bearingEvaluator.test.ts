import { describe, expect, it } from 'vitest';
import { evaluateBearing } from '../../game/source-analysis/BearingEvaluator';
import { asAntennaArrayId } from '../../game/antenna/AntennaArrayId';

const NORTH = asAntennaArrayId('north');
const EAST = asAntennaArrayId('east');
const DIAG = asAntennaArrayId('diag');

describe('BearingEvaluator — determinism (no randomness)', () => {
  it('the same inputs always produce the same output', () => {
    const a = evaluateBearing(NORTH, 'ExternalCandidate', 0.9, 15, 25);
    const b = evaluateBearing(NORTH, 'ExternalCandidate', 0.9, 15, 25);
    expect(a).toEqual(b);
  });
});

describe('BearingEvaluator — North Dish (ExternalCandidate): weak external-ish, never conclusive', () => {
  it('is categorized External but never satisfies externalSourceValid, even at perfect alignment', () => {
    const bearing = evaluateBearing(NORTH, 'ExternalCandidate', 1, 15, 25);
    expect(bearing.category).toBe('External');
    expect(bearing.externalSourceValid).toBe(false);
    expect(bearing.confidence).toBeLessThan(0.6);
  });
});

describe('BearingEvaluator — East Relay (RelayCandidate): strong but unstable', () => {
  it('has high confidence but low stability, and reads as Reflected, not External', () => {
    const bearing = evaluateBearing(EAST, 'RelayCandidate', 1, 42, 18);
    expect(bearing.category).toBe('Reflected');
    expect(bearing.confidence).toBeGreaterThan(0.6);
    expect(bearing.stability).toBeLessThan(0.6);
    expect(bearing.externalSourceValid).toBe(false); // Reflected is never externalSourceValid
  });
});

describe('BearingEvaluator — Tower Diagnostic Loop (DiagnosticLoop): confirms local coupling', () => {
  it('has near-zero path delay and high local-coupling likelihood', () => {
    const bearing = evaluateBearing(DIAG, 'DiagnosticLoop', 1, 0, 15);
    expect(bearing.category).toBe('Local');
    expect(bearing.pathDelayMs).toBeLessThan(2);
    expect(bearing.localCouplingLikelihood).toBeGreaterThan(0.5);
    expect(bearing.externalSourceValid).toBe(false);
  });
});

describe('BearingEvaluator — poor alignment reduces confidence for every array', () => {
  it('a low alignmentQuality input scales confidence down toward zero', () => {
    const good = evaluateBearing(EAST, 'RelayCandidate', 1, 42, 18);
    const poor = evaluateBearing(EAST, 'RelayCandidate', 0.1, 42, 18);
    expect(poor.confidence).toBeLessThan(good.confidence);
  });

  it('zero alignment quality yields zero confidence', () => {
    const bearing = evaluateBearing(EAST, 'RelayCandidate', 0, 42, 18);
    expect(bearing.confidence).toBe(0);
  });
});

describe('BearingEvaluator — estimated bearing mirrors mechanical pointing', () => {
  it('reports the mechanical azimuth/elevation as the estimated bearing', () => {
    const bearing = evaluateBearing(NORTH, 'ExternalCandidate', 0.8, 33, 12);
    expect(bearing.estimatedAzimuthDeg).toBe(33);
    expect(bearing.estimatedElevationDeg).toBe(12);
  });
});
