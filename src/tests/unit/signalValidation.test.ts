import { describe, expect, it } from 'vitest';
import {
  validateSignalDefinitions,
  canonicalTargetControls,
  solverReport,
  validateReceiverPowerWiring,
} from '../../game/signal/SignalValidation';
import type { SignalDefinition } from '../../game/signal/SignalDefinition';
import { asSignalId } from '../../game/signal/SignalId';
import { evaluate } from '../../game/signal/SignalEvaluator';
import { FACILITY_SIGNALS } from '../../scenes/facility-greybox/signal/facilitySignalDefinitions';

const VALID_SIGNAL: SignalDefinition = {
  id: asSignalId('valid-signal'),
  displayName: 'Valid Signal',
  channel: 3,
  targetFrequencyMHz: 117.4,
  frequencyToleranceMHz: 0.6,
  targetGainMin: 0.55,
  targetGainMax: 0.65,
  targetFilter: 0.65,
  filterTolerance: 0.12,
  targetPhaseDeg: -18,
  phaseToleranceDeg: 22,
  baseSignalStrength: 0.8,
  baseNoiseLevel: 0.35,
  minLockQuality: 0.85,
  lockAcquisitionSeconds: 2,
  decodeSeconds: 5,
  transcriptDocumentId: 'doc-valid',
  discoverable: true,
  requiredForProgression: true,
};

const CONTEXT = { documentIds: ['doc-valid'] };

describe('validateSignalDefinitions — valid data', () => {
  it('returns no problems for a well-formed, solvable signal', () => {
    expect(validateSignalDefinitions([VALID_SIGNAL], CONTEXT)).toEqual([]);
  });
});

describe('validateSignalDefinitions — duplicate ids', () => {
  it('flags duplicate signal ids', () => {
    const problems = validateSignalDefinitions([VALID_SIGNAL, VALID_SIGNAL], CONTEXT);
    expect(problems.some((p) => p.includes('Duplicate signal id'))).toBe(true);
  });
});

describe('validateSignalDefinitions — invalid values', () => {
  it('flags out-of-range channel', () => {
    const problems = validateSignalDefinitions([{ ...VALID_SIGNAL, channel: 9 }], CONTEXT);
    expect(problems.some((p) => p.includes('channel'))).toBe(true);
  });

  it('flags out-of-range frequency', () => {
    const problems = validateSignalDefinitions(
      [{ ...VALID_SIGNAL, targetFrequencyMHz: 300 }],
      CONTEXT,
    );
    expect(problems.some((p) => p.includes('targetFrequencyMHz'))).toBe(true);
  });

  it('flags non-positive tolerances', () => {
    const problems = validateSignalDefinitions(
      [{ ...VALID_SIGNAL, frequencyToleranceMHz: 0, filterTolerance: -1, phaseToleranceDeg: 0 }],
      CONTEXT,
    );
    expect(problems.some((p) => p.includes('frequencyToleranceMHz'))).toBe(true);
    expect(problems.some((p) => p.includes('filterTolerance'))).toBe(true);
    expect(problems.some((p) => p.includes('phaseToleranceDeg'))).toBe(true);
  });

  it('flags an invalid gain range (min > max, or outside [0,1])', () => {
    const problems = validateSignalDefinitions(
      [{ ...VALID_SIGNAL, targetGainMin: 0.8, targetGainMax: 0.2 }],
      CONTEXT,
    );
    expect(problems.some((p) => p.includes('gain range'))).toBe(true);
  });

  it('flags out-of-range filter/phase targets', () => {
    const problems = validateSignalDefinitions(
      [{ ...VALID_SIGNAL, targetFilter: 1.5, targetPhaseDeg: 200 }],
      CONTEXT,
    );
    expect(problems.some((p) => p.includes('targetFilter'))).toBe(true);
    expect(problems.some((p) => p.includes('targetPhaseDeg'))).toBe(true);
  });

  it('flags an out-of-range minLockQuality', () => {
    const problems = validateSignalDefinitions([{ ...VALID_SIGNAL, minLockQuality: 1.5 }], CONTEXT);
    expect(problems.some((p) => p.includes('minLockQuality'))).toBe(true);
  });

  it('flags non-positive lockAcquisitionSeconds/decodeSeconds', () => {
    const problems = validateSignalDefinitions(
      [{ ...VALID_SIGNAL, lockAcquisitionSeconds: 0, decodeSeconds: -1 }],
      CONTEXT,
    );
    expect(problems.some((p) => p.includes('lockAcquisitionSeconds'))).toBe(true);
    expect(problems.some((p) => p.includes('decodeSeconds'))).toBe(true);
  });
});

describe('validateSignalDefinitions — missing transcript', () => {
  it('flags a transcriptDocumentId that is not in the registered document set', () => {
    const problems = validateSignalDefinitions(
      [{ ...VALID_SIGNAL, transcriptDocumentId: 'doc-does-not-exist' }],
      CONTEXT,
    );
    expect(problems.some((p) => p.includes('unknown transcript document'))).toBe(true);
  });
});

describe('validateSignalDefinitions — impossible target (not mathematically achievable)', () => {
  // By construction, canonicalTargetControls() always hits every target
  // exactly, so overallQuality reaches 1 at a signal's own target as long as
  // every field is individually within its valid range — meaning a
  // structurally-valid SignalDefinition can never be "impossible" under the
  // current evaluator. That is itself the property under test here: even
  // the strictest legal minLockQuality (1 — requiring perfect quality)
  // passes the achievability check, proving the check isn't spuriously
  // rejecting edge-of-range configurations (e.g. a zero-width gain plateau)
  // due to floating-point rounding in the weighted refinement sum.
  it('accepts the strictest legal minLockQuality (1) with a zero-width gain plateau', () => {
    const strict: SignalDefinition = {
      ...VALID_SIGNAL,
      minLockQuality: 1,
      targetGainMin: 0.6,
      targetGainMax: 0.6,
    };
    const metrics = evaluate(strict, canonicalTargetControls(strict));
    expect(metrics.overallQuality).toBeCloseTo(1, 5);
    expect(validateSignalDefinitions([strict], CONTEXT)).toEqual([]);
  });

  it('the achievability check itself fires when minLockQuality is out of range (caught by the range check)', () => {
    const outOfRange: SignalDefinition = { ...VALID_SIGNAL, minLockQuality: 0 };
    const problems = validateSignalDefinitions([outOfRange], CONTEXT);
    expect(problems.some((p) => p.includes('minLockQuality'))).toBe(true);
  });
});

describe('validateSignalDefinitions — default controls must not accidentally solve', () => {
  it('flags a signal whose channel 1 / frequency 80 / gain 0.5 / filter 0.5 / phase 0 defaults already satisfy lock', () => {
    const triviallySolved: SignalDefinition = {
      ...VALID_SIGNAL,
      channel: 1,
      targetFrequencyMHz: 80,
      targetGainMin: 0.3,
      targetGainMax: 0.7,
      targetFilter: 0.5,
      filterTolerance: 0.4,
      targetPhaseDeg: 0,
      phaseToleranceDeg: 90,
      minLockQuality: 0.1,
    };
    const problems = validateSignalDefinitions([triviallySolved], CONTEXT);
    expect(problems.some((p) => p.includes('accidentally solved by default'))).toBe(true);
  });
});

function requireFirstFacilitySignal(): SignalDefinition {
  const signal = FACILITY_SIGNALS[0];
  if (signal === undefined) {
    throw new Error('FACILITY_SIGNALS must contain at least one signal for this test');
  }
  return signal;
}

describe('solverReport — valid target configuration (the actual facility signal)', () => {
  it('the shipped first_anomalous_transmission signal is solvable at its exact target', () => {
    const signal = requireFirstFacilitySignal();
    const report = solverReport(signal);
    expect(report.solvableAtTarget).toBe(true);
    expect(report.targetQuality).toBeGreaterThanOrEqual(signal.minLockQuality);
  });

  it('is not solved by the wrong channel', () => {
    const report = solverReport(requireFirstFacilitySignal());
    expect(report.wrongChannelQuality).toBe(0);
  });

  it('is not solved by a grossly wrong frequency', () => {
    const signal = requireFirstFacilitySignal();
    const report = solverReport(signal);
    expect(report.wrongFrequencyQuality).toBeLessThan(signal.minLockQuality);
  });

  it('is not accidentally solved by the receiver default controls', () => {
    const report = solverReport(requireFirstFacilitySignal());
    expect(report.defaultAccidentallySolves).toBe(false);
  });
});

describe('canonicalTargetControls', () => {
  it('produces the exact channel/frequency/filter/phase and a mid-range gain', () => {
    const controls = canonicalTargetControls(VALID_SIGNAL);
    expect(controls.channel).toBe(VALID_SIGNAL.channel);
    expect(controls.frequencyMHz).toBe(VALID_SIGNAL.targetFrequencyMHz);
    expect(controls.filter).toBe(VALID_SIGNAL.targetFilter);
    expect(controls.phaseDeg).toBe(VALID_SIGNAL.targetPhaseDeg);
    expect(controls.gain).toBeCloseTo(
      (VALID_SIGNAL.targetGainMin + VALID_SIGNAL.targetGainMax) / 2,
      5,
    );
  });
});

describe('validateReceiverPowerWiring', () => {
  it('passes when the receiver load circuit matches the expected control-room circuit', () => {
    expect(
      validateReceiverPowerWiring('fg-circuit-control-room', 'fg-circuit-control-room'),
    ).toEqual([]);
  });

  it('flags a mismatch', () => {
    const problems = validateReceiverPowerWiring('fg-circuit-tunnel', 'fg-circuit-control-room');
    expect(problems.length).toBeGreaterThan(0);
  });
});
