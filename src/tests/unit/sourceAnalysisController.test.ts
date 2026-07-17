import { describe, expect, it } from 'vitest';
import {
  SourceAnalysisController,
  type CollectSampleInput,
} from '../../game/source-analysis/SourceAnalysisController';
import { asAntennaArrayId } from '../../game/antenna/AntennaArrayId';

const NORTH = asAntennaArrayId('north');
const EAST = asAntennaArrayId('east');
const DIAG = asAntennaArrayId('diag');
const REQUIRED = [NORTH, EAST, DIAG] as const;

function sampleInput(overrides: Partial<CollectSampleInput> = {}): CollectSampleInput {
  return {
    arrayId: NORTH,
    role: 'ExternalCandidate',
    azimuthDeg: 15,
    elevationDeg: 25,
    polarizationDeg: 10,
    alignmentQuality: 0.9,
    receiverQuality: 0.9,
    waveguideState: 'Connected',
    powered: true,
    ...overrides,
  };
}

function newActivated(): SourceAnalysisController {
  const c = new SourceAnalysisController([...REQUIRED]);
  c.activate();
  return c;
}

describe('SourceAnalysisController — activation', () => {
  it('starts Unavailable and rejects samples before activate()', () => {
    const c = new SourceAnalysisController([...REQUIRED]);
    expect(c.analysisState).toBe('Unavailable');
    expect(c.collectSample(sampleInput())).toBeNull();
  });

  it('activate() transitions to Collecting', () => {
    const c = newActivated();
    expect(c.analysisState).toBe('Collecting');
  });
});

describe('SourceAnalysisController — sample collection', () => {
  it('accepts a meaningful sample for a required array', () => {
    const c = newActivated();
    const sample = c.collectSample(sampleInput({ arrayId: NORTH }));
    expect(sample).not.toBeNull();
    expect(c.hasSampled(NORTH)).toBe(true);
  });

  it('rejects a sample for a non-required array', () => {
    const c = newActivated();
    const other = asAntennaArrayId('not-required');
    expect(c.collectSample(sampleInput({ arrayId: other }))).toBeNull();
  });

  it('rejects a sample with alignment quality too poor to be meaningful', () => {
    const c = newActivated();
    expect(c.collectSample(sampleInput({ arrayId: NORTH, alignmentQuality: 0.1 }))).toBeNull();
    expect(c.hasSampled(NORTH)).toBe(false);
  });

  it('rejects a sample while unpowered', () => {
    const c = newActivated();
    expect(c.collectSample(sampleInput({ arrayId: NORTH, powered: false }))).toBeNull();
  });

  it('duplicate collection for the same array is idempotent — returns the ORIGINAL sample, no new event', () => {
    const c = newActivated();
    let collectedCount = 0;
    c.subscribe((e) => {
      if (e.kind === 'SampleCollected') collectedCount++;
    });
    const first = c.collectSample(sampleInput({ arrayId: NORTH, azimuthDeg: 15 }));
    const second = c.collectSample(sampleInput({ arrayId: NORTH, azimuthDeg: 99 })); // different reading
    expect(second).toBe(first); // same object, not a new sample
    expect(second?.azimuthDeg).toBe(15); // original value preserved
    expect(collectedCount).toBe(1);
  });

  it('collecting all 3 required arrays populates collectedSamples in sequence order', () => {
    const c = newActivated();
    c.collectSample(sampleInput({ arrayId: NORTH, role: 'ExternalCandidate' }));
    c.collectSample(
      sampleInput({ arrayId: EAST, role: 'RelayCandidate', azimuthDeg: 42, elevationDeg: 18 }),
    );
    c.collectSample(
      sampleInput({ arrayId: DIAG, role: 'DiagnosticLoop', azimuthDeg: 0, elevationDeg: 15 }),
    );
    expect(c.collectedSamples.map((s) => s.arrayId)).toEqual([NORTH, EAST, DIAG]);
    expect(c.collectedSamples.map((s) => s.sequenceIndex)).toEqual([0, 1, 2]);
  });
});

describe('SourceAnalysisController — insufficient data', () => {
  it('runComparison with fewer than 3 samples returns null and reports InsufficientData', () => {
    const c = newActivated();
    c.collectSample(sampleInput({ arrayId: NORTH }));
    const result = c.runComparison();
    expect(result).toBeNull();
    expect(c.analysisState).toBe('InsufficientData');
  });

  it('a subsequent sample collection resolves InsufficientData back to Collecting', () => {
    const c = newActivated();
    c.collectSample(sampleInput({ arrayId: NORTH }));
    c.runComparison(); // -> InsufficientData
    c.collectSample(sampleInput({ arrayId: EAST, role: 'RelayCandidate' }));
    expect(c.analysisState).toBe('Collecting');
  });
});

describe('SourceAnalysisController — full comparison and final classification', () => {
  function collectAllThree(c: SourceAnalysisController): void {
    c.collectSample(
      sampleInput({ arrayId: NORTH, role: 'ExternalCandidate', azimuthDeg: 15, elevationDeg: 25 }),
    );
    c.collectSample(
      sampleInput({ arrayId: EAST, role: 'RelayCandidate', azimuthDeg: 42, elevationDeg: 18 }),
    );
    c.collectSample(
      sampleInput({ arrayId: DIAG, role: 'DiagnosticLoop', azimuthDeg: 0, elevationDeg: 15 }),
    );
  }

  it('resolves to a contradiction (no valid external bearing) and confirms the local loop', () => {
    const c = newActivated();
    collectAllThree(c);
    const result = c.runComparison();
    expect(result).not.toBeNull();
    expect(result?.contradictionDetected).toBe(true);
    expect(result?.localLoopConfirmed).toBe(true);
    expect(result?.finalCategory).toBe('Local');
    expect(c.analysisState).toBe('Resolved');
  });

  it('fires ContradictionDetected, LocalLoopCandidateDetected, and AnalysisResolved exactly once each', () => {
    const c = newActivated();
    collectAllThree(c);
    let contradiction = 0;
    let localLoop = 0;
    let resolved = 0;
    c.subscribe((e) => {
      if (e.kind === 'ContradictionDetected') contradiction++;
      if (e.kind === 'LocalLoopCandidateDetected') localLoop++;
      if (e.kind === 'AnalysisResolved') resolved++;
    });
    c.runComparison();
    c.runComparison(); // repeat — must be a fully silent no-op
    c.runComparison();
    expect(contradiction).toBe(1);
    expect(localLoop).toBe(1);
    expect(resolved).toBe(1);
  });

  it('runComparison after resolution returns the cached result without recomputation', () => {
    const c = newActivated();
    collectAllThree(c);
    const first = c.runComparison();
    const second = c.runComparison();
    expect(second).toBe(first);
  });
});

describe('SourceAnalysisController — reset', () => {
  it('reset clears samples and returns to Unavailable', () => {
    const c = newActivated();
    c.collectSample(sampleInput({ arrayId: NORTH }));
    c.reset();
    expect(c.analysisState).toBe('Unavailable');
    expect(c.collectedSamples).toHaveLength(0);
    expect(c.hasSampled(NORTH)).toBe(false);
    expect(c.getResult()).toBeNull();
  });

  it('after reset, activate + collect + resolve works again cleanly (no stale bookkeeping)', () => {
    const c = newActivated();
    c.collectSample(sampleInput({ arrayId: NORTH, role: 'ExternalCandidate' }));
    c.collectSample(sampleInput({ arrayId: EAST, role: 'RelayCandidate' }));
    c.collectSample(sampleInput({ arrayId: DIAG, role: 'DiagnosticLoop' }));
    c.runComparison();
    expect(c.analysisState).toBe('Resolved');

    c.reset();
    c.activate();
    expect(c.analysisState).toBe('Collecting');
    c.collectSample(sampleInput({ arrayId: NORTH, role: 'ExternalCandidate' }));
    expect(c.hasSampled(NORTH)).toBe(true);
  });
});
