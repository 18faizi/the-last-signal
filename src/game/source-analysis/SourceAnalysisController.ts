/**
 * Collects per-array samples, requires all 3 required arrays sampled before
 * allowing comparison, and runs the deterministic cross-array comparison →
 * contradiction detection → local-loop classification pipeline exactly
 * once. Babylon/DOM-free — the antenna panel UI reads this via getSnapshot-
 * style getters and reacts to its typed events, it never drives the
 * comparison logic itself.
 */
import type { AntennaArrayId } from '../antenna/AntennaArrayId';
import type { AntennaArrayRole } from '../antenna/AntennaArrayDefinition';
import type { WaveguideState } from '../waveguide/WaveguideState';
import { evaluateBearing } from './BearingEvaluator';
import type { SourceCandidate } from './SourceCandidate';
import { tryTransitionSourceAnalysisState, type SourceAnalysisState } from './SourceAnalysisState';
import { evaluateSourceAnalysisResult, type SourceAnalysisResult } from './SourceAnalysisResult';
import { SourceAnalysisEventBus, type SourceAnalysisEvent } from './SourceAnalysisEvent';

/** A sample below this alignment quality isn't "meaningful" and is rejected. */
const MIN_MEANINGFUL_ALIGNMENT_QUALITY = 0.4;

export interface CollectSampleInput {
  readonly arrayId: AntennaArrayId;
  readonly role: AntennaArrayRole;
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly polarizationDeg: number;
  readonly alignmentQuality: number;
  readonly receiverQuality: number;
  readonly waveguideState: WaveguideState;
  readonly powered: boolean;
}

export interface SourceAnalysisSnapshot {
  readonly state: SourceAnalysisState;
  readonly samples: readonly SourceCandidate[];
  readonly requiredArrayIds: readonly AntennaArrayId[];
  readonly result: SourceAnalysisResult | null;
}

export class SourceAnalysisController {
  private readonly samples = new Map<AntennaArrayId, SourceCandidate>();
  private state: SourceAnalysisState = 'Unavailable';
  private sequenceCounter = 0;
  private result: SourceAnalysisResult | null = null;
  private readonly bus = new SourceAnalysisEventBus();

  constructor(private readonly requiredArrayIds: readonly AntennaArrayId[]) {}

  // ----- read --------------------------------------------------------------

  get analysisState(): SourceAnalysisState {
    return this.state;
  }

  get collectedSamples(): readonly SourceCandidate[] {
    return [...this.samples.values()].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  }

  hasSampled(arrayId: AntennaArrayId): boolean {
    return this.samples.has(arrayId);
  }

  getResult(): SourceAnalysisResult | null {
    return this.result;
  }

  getSnapshot(): SourceAnalysisSnapshot {
    return {
      state: this.state,
      samples: this.collectedSamples,
      requiredArrayIds: this.requiredArrayIds,
      result: this.result,
    };
  }

  // ----- write ---------------------------------------------------------------

  /** Unlocks sample collection once external prerequisites (decode + waveguide correction) are met. */
  activate(): boolean {
    const changed = this.setState('Collecting');
    return changed;
  }

  /**
   * Records one array's current alignment as a sample. Idempotent per array
   * per analysis cycle — a second call for an already-sampled array returns
   * the EXISTING sample without creating a duplicate or re-firing
   * 'SampleCollected' (spec: "prevents duplicates per array... not per
   * keystroke"). Returns null when the array isn't required, the analysis
   * isn't active yet, or the current alignment is too poor to be a
   * meaningful reading.
   */
  collectSample(input: CollectSampleInput): SourceCandidate | null {
    if (this.state === 'Unavailable') return null;
    if (!this.requiredArrayIds.includes(input.arrayId)) return null;

    const existing = this.samples.get(input.arrayId);
    if (existing !== undefined) return existing;

    if (!input.powered || input.alignmentQuality < MIN_MEANINGFUL_ALIGNMENT_QUALITY) {
      this.bus.emit({ kind: 'SampleRejected', arrayId: input.arrayId });
      return null;
    }

    const bearing = evaluateBearing(
      input.arrayId,
      input.role,
      input.alignmentQuality,
      input.azimuthDeg,
      input.elevationDeg,
    );
    const candidate: SourceCandidate = {
      arrayId: input.arrayId,
      azimuthDeg: input.azimuthDeg,
      elevationDeg: input.elevationDeg,
      polarizationDeg: input.polarizationDeg,
      alignmentQuality: input.alignmentQuality,
      receiverQuality: input.receiverQuality,
      waveguideState: input.waveguideState,
      powered: input.powered,
      bearing,
      confidence: bearing.confidence,
      sequenceIndex: this.sequenceCounter++,
    };
    this.samples.set(input.arrayId, candidate);
    if (this.state === 'InsufficientData') {
      this.setState('Collecting');
    }
    this.bus.emit({ kind: 'SampleCollected', arrayId: input.arrayId });
    return candidate;
  }

  /**
   * Requires every required array to have a sample; runs the deterministic
   * comparison → contradiction → local-loop pipeline and resolves exactly
   * once. Calling again after resolution is a no-op that returns the
   * cached result (no duplicate events) — the explicit guard tested by
   * sourceAnalysisController.test.ts's "resolves exactly once" case.
   */
  runComparison(): SourceAnalysisResult | null {
    if (this.state === 'Resolved') return this.result;

    const allPresent = this.requiredArrayIds.every((id) => this.samples.has(id));
    if (!allPresent) {
      this.setState('InsufficientData');
      return null;
    }

    this.setState('Comparing');
    const result = evaluateSourceAnalysisResult(this.collectedSamples);
    this.result = result;
    this.bus.emit({ kind: 'ComparisonStarted' });

    this.setState('ContradictionDetected');
    if (result.contradictionDetected) {
      this.bus.emit({ kind: 'ContradictionDetected' });
    }
    this.setState('LocalLoopCandidate');
    if (result.localLoopConfirmed) {
      this.bus.emit({ kind: 'LocalLoopCandidateDetected' });
    }
    this.setState('Resolved');
    this.bus.emit({ kind: 'AnalysisResolved', result });
    return result;
  }

  /** Full reset (dev "full reset" action only). */
  reset(): void {
    this.samples.clear();
    this.state = 'Unavailable';
    this.result = null;
    this.sequenceCounter = 0;
  }

  subscribe(listener: (event: SourceAnalysisEvent) => void): () => void {
    return this.bus.subscribe(listener);
  }

  dispose(): void {
    this.bus.dispose();
  }

  // ----- private ---------------------------------------------------------------

  private setState(target: SourceAnalysisState): boolean {
    const next = tryTransitionSourceAnalysisState(this.state, target);
    if (next === null) return false;
    this.state = next;
    return true;
  }
}
