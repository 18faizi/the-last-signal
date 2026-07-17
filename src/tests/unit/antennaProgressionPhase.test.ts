import { describe, expect, it } from 'vitest';
import {
  canAdvanceAntennaPhase,
  tryAdvanceAntennaPhase,
  compareAntennaPhase,
  isAntennaRevealComplete,
  type AntennaProgressionPhase,
} from '../../game/antenna/AntennaProgressionPhase';
import { AntennaRuntimeState } from '../../game/antenna/AntennaRuntimeState';
import { asAntennaArrayId } from '../../game/antenna/AntennaArrayId';

const FULL_CHAIN: readonly AntennaProgressionPhase[] = [
  'Unavailable',
  'DecodedSignalRequired',
  'RooftopPowerRequired',
  'AntennaPanelOnline',
  'WaveguideCorrectionRequired',
  'ReadyForSamples',
  'FirstArraySampled',
  'SecondArraySampled',
  'DiagnosticLoopSampled',
  'BearingContradictionDetected',
  'LocalLoopCandidate',
  'AntennaRevealComplete',
];

/** Advances a fresh AntennaRuntimeState through every phase after 'Unavailable'. */
function advanceFullChain(s: AntennaRuntimeState): void {
  for (const phase of FULL_CHAIN.slice(1)) {
    s.tryAdvancePhase(phase);
  }
}

describe('AntennaProgressionPhase — valid transitions', () => {
  it('advances strictly linearly through the whole chain', () => {
    FULL_CHAIN.slice(0, -1).forEach((phase, i) => {
      expect(canAdvanceAntennaPhase(phase, FULL_CHAIN[i + 1] as AntennaProgressionPhase)).toBe(
        true,
      );
    });
  });

  it('AntennaRevealComplete is terminal (no outgoing transitions)', () => {
    expect(canAdvanceAntennaPhase('AntennaRevealComplete', 'Unavailable')).toBe(false);
  });
});

describe('AntennaProgressionPhase — invalid transitions', () => {
  it('rejects skipping ahead in the chain', () => {
    expect(canAdvanceAntennaPhase('Unavailable', 'ReadyForSamples')).toBe(false);
    expect(canAdvanceAntennaPhase('Unavailable', 'AntennaRevealComplete')).toBe(false);
  });

  it('rejects moving backward', () => {
    expect(canAdvanceAntennaPhase('ReadyForSamples', 'Unavailable')).toBe(false);
  });

  it('tryAdvanceAntennaPhase returns null for a no-op (same phase) request', () => {
    expect(tryAdvanceAntennaPhase('ReadyForSamples', 'ReadyForSamples')).toBeNull();
  });
});

describe('AntennaProgressionPhase — ordering + helpers', () => {
  it('compareAntennaPhase orders phases monotonically', () => {
    expect(compareAntennaPhase('Unavailable', 'AntennaRevealComplete')).toBeLessThan(0);
    expect(compareAntennaPhase('AntennaRevealComplete', 'Unavailable')).toBeGreaterThan(0);
    expect(compareAntennaPhase('ReadyForSamples', 'ReadyForSamples')).toBe(0);
  });

  it('isAntennaRevealComplete is true only for the terminal phase', () => {
    expect(isAntennaRevealComplete('AntennaRevealComplete')).toBe(true);
    expect(isAntennaRevealComplete('LocalLoopCandidate')).toBe(false);
  });
});

describe('AntennaRuntimeState — phase advancement', () => {
  it('advances one step at a time and rejects illegal jumps', () => {
    const s = new AntennaRuntimeState();
    expect(s.tryAdvancePhase('RooftopPowerRequired')).toBe(false); // skip
    expect(s.antennaPhase).toBe('Unavailable');
    expect(s.tryAdvancePhase('DecodedSignalRequired')).toBe(true);
    expect(s.antennaPhase).toBe('DecodedSignalRequired');
  });

  it('reveal fires the completed event exactly once', () => {
    const s = new AntennaRuntimeState();
    let completedCount = 0;
    s.subscribe((e) => {
      if (e.kind === 'completed') completedCount++;
    });
    advanceFullChain(s);
    expect(s.isRevealComplete).toBe(true);
    expect(completedCount).toBe(1);
    // Attempting to advance further (or re-advance) does nothing more.
    s.tryAdvancePhase('AntennaRevealComplete');
    expect(completedCount).toBe(1);
  });
});

describe('AntennaRuntimeState — sample bookkeeping', () => {
  it('prevents duplicate sample-collected events for the same array', () => {
    const s = new AntennaRuntimeState();
    const arr = asAntennaArrayId('north');
    let events = 0;
    s.subscribe((e) => {
      if (e.kind === 'sample-collected') events++;
    });
    s.recordSampleCollected(arr);
    s.recordSampleCollected(arr);
    s.recordSampleCollected(arr);
    expect(events).toBe(1);
    expect(s.hasSampled(arr)).toBe(true);
  });
});

describe('AntennaRuntimeState — checkpoint preservation semantics', () => {
  it('getSnapshot reflects current phase/samples/reveal without mutating state', () => {
    const s = new AntennaRuntimeState();
    s.tryAdvancePhase('DecodedSignalRequired');
    s.recordSampleCollected(asAntennaArrayId('north'));
    const snap1 = s.getSnapshot();
    const snap2 = s.getSnapshot();
    expect(snap1).toEqual(snap2);
    expect(snap1.antennaPhase).toBe('DecodedSignalRequired');
    expect(snap1.sampledArrayIds).toEqual([asAntennaArrayId('north')]);
  });
});

describe('AntennaRuntimeState — dev reset', () => {
  it('reset clears phase, samples, and reveal completion; repeated resets are stable', () => {
    const s = new AntennaRuntimeState();
    advanceFullChain(s);
    s.recordSampleCollected(asAntennaArrayId('north'));
    expect(s.isRevealComplete).toBe(true);

    for (let i = 0; i < 3; i++) {
      s.reset();
      expect(s.antennaPhase).toBe('Unavailable');
      expect(s.isRevealComplete).toBe(false);
      expect(s.getSnapshot().sampledArrayIds).toHaveLength(0);
    }
  });
});
