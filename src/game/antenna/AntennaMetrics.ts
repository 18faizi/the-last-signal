/**
 * Derived, per-evaluation quality breakdown for one antenna array — produced
 * only by AntennaEvaluator.evaluate(), mirrors ReceiverMetrics.ts's role and
 * immutability contract exactly.
 */
export type AntennaLimitingFactor =
  'array' | 'power' | 'azimuth' | 'elevation' | 'polarization' | 'none';

export interface AntennaMetrics {
  /** Whether the array selected/queried is the one being evaluated against (always true post-selection; kept for symmetry with ReceiverMetrics.channelMatch). */
  readonly arrayMatch: boolean;

  readonly azimuthErrorDeg: number;
  /** 0-1, circular-wraparound-aware. */
  readonly azimuthQuality: number;

  readonly elevationErrorDeg: number;
  /** 0-1, linear/clamped (no wraparound). */
  readonly elevationQuality: number;

  readonly polarizationErrorDeg: number;
  /** 0-1. */
  readonly polarizationQuality: number;

  /** 0-1 — whether mechanical motion has settled (not mid-transit). 1 when stationary. */
  readonly mechanicalReadiness: number;

  /** 0-1 — waveguide route continuity contribution (0 = disconnected/misrouted). */
  readonly waveguideContinuity: number;

  /** 0/1 — whether the required power circuit is energized. */
  readonly powerAvailability: number;

  /**
   * 0-1 PURE mechanical alignment quality (arrayMatch × mechanicalReadiness
   * × azimuth × elevation × polarization quality), capped at the array's
   * maxQuality — deliberately NOT gated by power/waveguide here, so
   * consumers that apply their own live power/waveguide gates (see
   * src/game/source-analysis/AnalysisQualityEvaluator.ts) never double-gate
   * the same factor twice.
   */
  readonly alignmentQuality: number;

  /**
   * 0-1 final quality: alignmentQuality × powerGate × waveguideContinuity.
   * NOT a simple average — see AntennaEvaluator.ts's evaluate() doc comment
   * for the exact multiplicative-gate combination. This is what
   * AntennaController uses to derive the Aligned/AlignedCandidate control
   * states — a dish cannot be meaningfully "Aligned" while unpowered or
   * waveguide-disconnected.
   */
  readonly overallQuality: number;

  readonly limitingFactor: AntennaLimitingFactor;
}
