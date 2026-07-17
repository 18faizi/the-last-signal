import { describe, expect, it } from 'vitest';
import {
  evaluateAnalysisQualityCeiling,
  type SourceAnalysisQualityInput,
} from '../../game/source-analysis/AnalysisQualityEvaluator';
import type { ReceiverMetrics } from '../../game/signal/ReceiverMetrics';
import type { AntennaMetrics } from '../../game/antenna/AntennaMetrics';

const GOOD_RECEIVER_METRICS: ReceiverMetrics = {
  channelMatch: true,
  frequencyErrorMHz: 0,
  frequencyQuality: 1,
  gainQuality: 1,
  filterQuality: 1,
  phaseErrorDeg: 0,
  phaseQuality: 1,
  effectiveSignalStrength: 1,
  amplifiedNoise: 0,
  signalToNoiseQuality: 1,
  overallQuality: 0.9,
  limitingFactor: 'none',
};

const GOOD_ANTENNA_METRICS: AntennaMetrics = {
  arrayMatch: true,
  azimuthErrorDeg: 0,
  azimuthQuality: 1,
  elevationErrorDeg: 0,
  elevationQuality: 1,
  polarizationErrorDeg: 0,
  polarizationQuality: 1,
  mechanicalReadiness: 1,
  waveguideContinuity: 1,
  powerAvailability: 1,
  alignmentQuality: 0.9,
  overallQuality: 0.9,
  limitingFactor: 'none',
};

function baseInput(
  overrides: Partial<SourceAnalysisQualityInput> = {},
): SourceAnalysisQualityInput {
  return {
    receiverMetrics: GOOD_RECEIVER_METRICS,
    antennaMetrics: GOOD_ANTENNA_METRICS,
    waveguideQuality: 1,
    rooftopPowered: true,
    transmissionDecoded: true,
    ...overrides,
  };
}

describe('evaluateAnalysisQualityCeiling — transmission-decoded gate', () => {
  it('is hard-zeroed when the transmission has not been decoded, regardless of everything else being perfect', () => {
    const ceiling = evaluateAnalysisQualityCeiling(baseInput({ transmissionDecoded: false }));
    expect(ceiling).toBe(0);
  });

  it('is nonzero once decoded, with every other factor also good', () => {
    const ceiling = evaluateAnalysisQualityCeiling(baseInput());
    expect(ceiling).toBeGreaterThan(0);
  });
});

describe('evaluateAnalysisQualityCeiling — multiplicative composition', () => {
  it('multiplies receiver quality × antenna alignment × waveguide × power', () => {
    const ceiling = evaluateAnalysisQualityCeiling(baseInput());
    // 0.9 (receiver) * 0.9 (alignment) * 1 (waveguide) * 1 (power) = 0.81
    expect(ceiling).toBeCloseTo(0.81, 5);
  });

  it('drops to zero if the waveguide is disconnected', () => {
    const ceiling = evaluateAnalysisQualityCeiling(baseInput({ waveguideQuality: 0 }));
    expect(ceiling).toBe(0);
  });

  it('drops to zero if the rooftop circuit is unpowered', () => {
    const ceiling = evaluateAnalysisQualityCeiling(baseInput({ rooftopPowered: false }));
    expect(ceiling).toBe(0);
  });

  it('scales down proportionally with poor receiver tuning, without needing a re-decode', () => {
    const poorTuning: ReceiverMetrics = { ...GOOD_RECEIVER_METRICS, overallQuality: 0.2 };
    const ceiling = evaluateAnalysisQualityCeiling(
      baseInput({ receiverMetrics: poorTuning, transmissionDecoded: true }),
    );
    // Still decoded (permanent fact) — readiness merely falls, it isn't hard-zeroed.
    expect(ceiling).toBeGreaterThan(0);
    expect(ceiling).toBeCloseTo(0.2 * 0.9, 5);
  });
});

describe('evaluateAnalysisQualityCeiling — does not conflate the two quality concepts', () => {
  it('uses antennaMetrics.alignmentQuality (pure), not overallQuality (already power/waveguide-gated), avoiding double-gating', () => {
    // Construct an antennaMetrics where overallQuality has ALREADY been
    // zeroed by ITS OWN internal power gate (simulating a stale/cached
    // snapshot from just before a power loss), while alignmentQuality
    // (pure) is still high. The composition must use alignmentQuality, or
    // this input would be double-penalized relative to the live
    // rooftopPowered gate already applied here.
    const staleMetrics: AntennaMetrics = {
      ...GOOD_ANTENNA_METRICS,
      overallQuality: 0, // as if antennaMetrics.powerAvailability was 0 at eval time
    };
    const ceiling = evaluateAnalysisQualityCeiling(
      baseInput({ antennaMetrics: staleMetrics, rooftopPowered: true }),
    );
    expect(ceiling).toBeGreaterThan(0);
  });
});

describe('evaluateAnalysisQualityCeiling — bounded output', () => {
  it('never exceeds 1', () => {
    const perfect: ReceiverMetrics = { ...GOOD_RECEIVER_METRICS, overallQuality: 1 };
    const perfectAntenna: AntennaMetrics = { ...GOOD_ANTENNA_METRICS, alignmentQuality: 1 };
    const ceiling = evaluateAnalysisQualityCeiling(
      baseInput({ receiverMetrics: perfect, antennaMetrics: perfectAntenna }),
    );
    expect(ceiling).toBeLessThanOrEqual(1);
  });
});
