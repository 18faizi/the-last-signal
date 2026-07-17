import type { AntennaArrayId } from '../antenna/AntennaArrayId';
import type { SourceAnalysisResult } from './SourceAnalysisResult';

/**
 * Typed events emitted by SourceAnalysisController. Mirrors AntennaEvent.ts/
 * WaveguideEvent.ts's "fields optional per-kind, narrow on kind" pattern.
 */
export type SourceAnalysisEventKind =
  | 'SampleCollected'
  | 'SampleRejected'
  | 'ComparisonStarted'
  | 'ContradictionDetected'
  | 'LocalLoopCandidateDetected'
  | 'AnalysisResolved';

export interface SourceAnalysisEvent {
  readonly kind: SourceAnalysisEventKind;
  readonly arrayId?: AntennaArrayId;
  readonly result?: SourceAnalysisResult;
}

export type SourceAnalysisListener = (event: SourceAnalysisEvent) => void;

export class SourceAnalysisEventBus {
  private readonly listeners = new Set<SourceAnalysisListener>();

  subscribe(listener: SourceAnalysisListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: SourceAnalysisEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow — never let a UI/test listener break domain state.
      }
    }
  }

  dispose(): void {
    this.listeners.clear();
  }
}
