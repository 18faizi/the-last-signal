/**
 * Result shape for one antenna array's bearing estimate. Plain data, no
 * Babylon/DOM — produced only by BearingEvaluator.evaluateBearing().
 */
export type SourceCandidateCategory =
  'External' | 'Reflected' | 'Local' | 'Indeterminate' | 'Impossible';

export interface SignalBearing {
  readonly estimatedAzimuthDeg: number;
  readonly estimatedElevationDeg: number;
  /** 0-1 — how strong/trustworthy this single reading is. */
  readonly confidence: number;
  /** 0-1 — how consistent the reading is expected to be across repeated samples. */
  readonly stability: number;
  /** Whether this reading, on its own, could plausibly describe a real external source. */
  readonly externalSourceValid: boolean;
  /** 0-1 — how strongly this reading points at facility-local coupling rather than a distant source. */
  readonly localCouplingLikelihood: number;
  /** Modeled propagation delay in milliseconds — near-zero implies local coupling (no real travel time). */
  readonly pathDelayMs: number;
  readonly category: SourceCandidateCategory;
}
