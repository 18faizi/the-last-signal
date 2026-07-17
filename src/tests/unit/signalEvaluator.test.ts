import { describe, expect, it } from 'vitest';
import {
  evaluate,
  frequencyQuality,
  gainQuality,
  filterQuality,
  phaseQuality,
} from '../../game/signal/SignalEvaluator';
import type { SignalDefinition } from '../../game/signal/SignalDefinition';
import { asSignalId } from '../../game/signal/SignalId';
import {
  createDefaultReceiverControls,
  type ReceiverControls,
} from '../../game/signal/ReceiverControls';
import { shortestAngleDelta } from '../../game/signal/SignalChannel';

const SIGNAL: SignalDefinition = {
  id: asSignalId('test-signal'),
  displayName: 'Test Signal',
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
  transcriptDocumentId: 'doc-test',
  discoverable: true,
  requiredForProgression: true,
};

function targetControls(): ReceiverControls {
  return {
    channel: SIGNAL.channel,
    frequencyMHz: SIGNAL.targetFrequencyMHz,
    gain: (SIGNAL.targetGainMin + SIGNAL.targetGainMax) / 2,
    filter: SIGNAL.targetFilter,
    phaseDeg: SIGNAL.targetPhaseDeg,
  };
}

describe('SignalEvaluator — determinism', () => {
  it('produces identical output for identical input, repeatedly', () => {
    const controls = targetControls();
    const a = evaluate(SIGNAL, controls);
    const b = evaluate(SIGNAL, controls);
    const c = evaluate(SIGNAL, { ...controls });
    expect(a).toEqual(b);
    expect(a).toEqual(c);
  });
});

describe('SignalEvaluator — exact target', () => {
  it('reaches overallQuality 1 (or extremely close) at exact target controls', () => {
    const m = evaluate(SIGNAL, targetControls());
    expect(m.channelMatch).toBe(true);
    expect(m.frequencyQuality).toBeCloseTo(1, 5);
    expect(m.gainQuality).toBe(1);
    expect(m.filterQuality).toBeCloseTo(1, 5);
    expect(m.phaseQuality).toBeCloseTo(1, 5);
    expect(m.overallQuality).toBeGreaterThanOrEqual(SIGNAL.minLockQuality);
    expect(m.limitingFactor).toBe('none');
  });
});

describe('SignalEvaluator — frequency falloff', () => {
  it('is monotonically non-increasing as error grows away from target', () => {
    const errors = [0, 0.2, 0.4, 0.6, 0.9, 1.2, 1.5, 1.8, 2.4];
    const qualities = errors.map((e) =>
      frequencyQuality(
        SIGNAL.targetFrequencyMHz,
        SIGNAL.frequencyToleranceMHz,
        SIGNAL.targetFrequencyMHz + e,
      ),
    );
    for (let i = 1; i < qualities.length; i++) {
      expect(qualities[i]).toBeLessThanOrEqual((qualities[i - 1] ?? 0) + 1e-9);
    }
  });

  it('is 0 outside the capture range (3x tolerance) and 1 at exact target', () => {
    expect(
      frequencyQuality(
        SIGNAL.targetFrequencyMHz,
        SIGNAL.frequencyToleranceMHz,
        SIGNAL.targetFrequencyMHz,
      ),
    ).toBe(1);
    const farOff = SIGNAL.targetFrequencyMHz + SIGNAL.frequencyToleranceMHz * 3.5;
    expect(frequencyQuality(SIGNAL.targetFrequencyMHz, SIGNAL.frequencyToleranceMHz, farOff)).toBe(
      0,
    );
  });

  it('a signal tuned far outside capture range yields overallQuality 0 regardless of other perfect controls', () => {
    const controls = { ...targetControls(), frequencyMHz: SIGNAL.targetFrequencyMHz + 10 };
    const m = evaluate(SIGNAL, controls);
    expect(m.overallQuality).toBe(0);
  });
});

describe('SignalEvaluator — gain', () => {
  it('too low reduces quality (weak signal)', () => {
    const q = gainQuality(SIGNAL.targetGainMin, SIGNAL.targetGainMax, 0.1);
    expect(q).toBeLessThan(1);
  });

  it('optimal (within range) is quality 1 anywhere in the plateau', () => {
    expect(gainQuality(SIGNAL.targetGainMin, SIGNAL.targetGainMax, SIGNAL.targetGainMin)).toBe(1);
    expect(gainQuality(SIGNAL.targetGainMin, SIGNAL.targetGainMax, SIGNAL.targetGainMax)).toBe(1);
    expect(
      gainQuality(
        SIGNAL.targetGainMin,
        SIGNAL.targetGainMax,
        (SIGNAL.targetGainMin + SIGNAL.targetGainMax) / 2,
      ),
    ).toBe(1);
  });

  it('too high reduces quality (amplified noise)', () => {
    const q = gainQuality(SIGNAL.targetGainMin, SIGNAL.targetGainMax, 1.0);
    expect(q).toBeLessThan(1);
  });
});

describe('SignalEvaluator — filter', () => {
  it('too low (below target) reduces quality', () => {
    const q = filterQuality(SIGNAL.targetFilter, SIGNAL.filterTolerance, 0.1);
    expect(q).toBeLessThan(1);
  });

  it('optimal at exact target is quality 1', () => {
    expect(filterQuality(SIGNAL.targetFilter, SIGNAL.filterTolerance, SIGNAL.targetFilter)).toBe(1);
  });

  it('too high (above target) reduces quality', () => {
    const q = filterQuality(SIGNAL.targetFilter, SIGNAL.filterTolerance, 1.0);
    expect(q).toBeLessThan(1);
  });
});

describe('SignalEvaluator — phase + circular wraparound', () => {
  it('exact target phase yields quality 1', () => {
    const { quality } = phaseQuality(
      SIGNAL.targetPhaseDeg,
      SIGNAL.phaseToleranceDeg,
      SIGNAL.targetPhaseDeg,
    );
    expect(quality).toBe(1);
  });

  it('shortestAngleDelta handles the -180/+180 wraparound correctly', () => {
    expect(shortestAngleDelta(179, -179)).toBeCloseTo(-2, 5);
    expect(shortestAngleDelta(-179, 179)).toBeCloseTo(2, 5);
    expect(shortestAngleDelta(0, 0)).toBe(0);
    expect(shortestAngleDelta(10, 350)).toBeCloseTo(20, 5);
    expect(shortestAngleDelta(350, 10)).toBeCloseTo(-20, 5);
  });

  it('phaseQuality treats wraparound-adjacent angles as nearly identical', () => {
    const { quality: qNearWrap } = phaseQuality(179, 22, -179);
    expect(qNearWrap).toBeCloseTo(1, 5);
  });

  it('a phase 180 degrees off (worst case) yields the lowest quality', () => {
    const oppositePhase =
      SIGNAL.targetPhaseDeg + 180 > 180 ? SIGNAL.targetPhaseDeg - 180 : SIGNAL.targetPhaseDeg + 180;
    const { quality } = phaseQuality(
      SIGNAL.targetPhaseDeg,
      SIGNAL.phaseToleranceDeg,
      oppositePhase,
    );
    expect(quality).toBe(0);
  });
});

describe('SignalEvaluator — channel mismatch', () => {
  it('caps overall quality at 0 regardless of every other control being exact', () => {
    const controls = {
      ...targetControls(),
      channel: SIGNAL.channel === 6 ? 1 : SIGNAL.channel + 1,
    };
    const m = evaluate(SIGNAL, controls);
    expect(m.channelMatch).toBe(false);
    expect(m.overallQuality).toBe(0);
    expect(m.limitingFactor).toBe('channel');
  });
});

describe('SignalEvaluator — overall quality weighting + clamping', () => {
  it('is never negative and never exceeds 1 across a spread of inputs', () => {
    const samples: ReceiverControls[] = [
      createDefaultReceiverControls(),
      targetControls(),
      { channel: 1, frequencyMHz: 80, gain: 0, filter: 0, phaseDeg: -180 },
      { channel: 6, frequencyMHz: 150, gain: 1, filter: 1, phaseDeg: 180 },
      { ...targetControls(), gain: 0.9 },
    ];
    for (const controls of samples) {
      const m = evaluate(SIGNAL, controls);
      expect(m.overallQuality).toBeGreaterThanOrEqual(0);
      expect(m.overallQuality).toBeLessThanOrEqual(1);
    }
  });

  it('is not a simple average: perfect gain/filter/phase cannot rescue a wrong channel or grossly wrong frequency', () => {
    const wrongChannel = { ...targetControls(), channel: 5 };
    expect(evaluate(SIGNAL, wrongChannel).overallQuality).toBe(0);

    const wrongFrequency = { ...targetControls(), frequencyMHz: SIGNAL.targetFrequencyMHz + 5 };
    expect(evaluate(SIGNAL, wrongFrequency).overallQuality).toBe(0);
  });

  it('all-three-refinements-poor caps overallQuality well under any reasonable lock threshold', () => {
    const poorRefinement = {
      channel: SIGNAL.channel,
      frequencyMHz: SIGNAL.targetFrequencyMHz,
      gain: 0,
      filter: 0,
      phaseDeg:
        SIGNAL.targetPhaseDeg + 180 > 180
          ? SIGNAL.targetPhaseDeg - 180
          : SIGNAL.targetPhaseDeg + 180,
    };
    const m = evaluate(SIGNAL, poorRefinement);
    expect(m.overallQuality).toBeLessThan(0.3);
  });
});

describe('SignalEvaluator — limiting factor selection', () => {
  it('identifies channel when mismatched', () => {
    const m = evaluate(SIGNAL, { ...targetControls(), channel: 1 });
    expect(m.limitingFactor).toBe('channel');
  });

  it('identifies frequency when far off (below the 0.5 quality threshold)', () => {
    const m = evaluate(SIGNAL, {
      ...targetControls(),
      frequencyMHz: SIGNAL.targetFrequencyMHz + 1.5,
    });
    expect(m.limitingFactor).toBe('frequency');
  });

  it('identifies gain when it is the single worst refinement', () => {
    const m = evaluate(SIGNAL, { ...targetControls(), gain: 0.05 });
    expect(m.limitingFactor).toBe('gain');
  });

  it('identifies filter when it is the single worst refinement', () => {
    const m = evaluate(SIGNAL, { ...targetControls(), filter: 0.02 });
    expect(m.limitingFactor).toBe('filter');
  });

  it('identifies phase when it is the single worst refinement', () => {
    const m = evaluate(SIGNAL, { ...targetControls(), phaseDeg: SIGNAL.targetPhaseDeg + 90 });
    expect(m.limitingFactor).toBe('phase');
  });

  it('reports "none" when everything is close to target', () => {
    const m = evaluate(SIGNAL, targetControls());
    expect(m.limitingFactor).toBe('none');
  });
});

describe('SignalEvaluator — effective signal strength / noise / SNR (UI feedback only)', () => {
  it('effectiveSignalStrength is 0 when untuned (no channel/frequency match)', () => {
    const m = evaluate(SIGNAL, { ...targetControls(), channel: 1 });
    expect(m.effectiveSignalStrength).toBe(0);
  });

  it('amplifiedNoise increases as gain increases (all else equal)', () => {
    const low = evaluate(SIGNAL, { ...targetControls(), gain: 0.1 });
    const high = evaluate(SIGNAL, { ...targetControls(), gain: 0.9 });
    expect(high.amplifiedNoise).toBeGreaterThan(low.amplifiedNoise);
  });

  it('does not feed noise/SNR back into overallQuality (only gain/filter/phase quality do)', () => {
    // Two controls with identical gain/filter/phase-derived qualities but
    // different raw gain values (0.6 vs 0.62, still both inside the target
    // plateau) must produce identical overallQuality even though their
    // noise/SNR figures differ.
    const a = evaluate(SIGNAL, { ...targetControls(), gain: 0.58 });
    const b = evaluate(SIGNAL, { ...targetControls(), gain: 0.62 });
    expect(a.overallQuality).toBe(b.overallQuality);
  });
});
