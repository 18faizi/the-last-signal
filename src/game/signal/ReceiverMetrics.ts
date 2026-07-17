/**
 * Derived, per-tick evaluation of how well the current ReceiverControls
 * match a SignalDefinition. Produced only by SignalEvaluator.evaluate() —
 * never constructed by hand outside tests — and immutable once returned.
 */
export type LimitingFactor = 'channel' | 'frequency' | 'gain' | 'filter' | 'phase' | 'none';

export interface ReceiverMetrics {
  readonly channelMatch: boolean;

  readonly frequencyErrorMHz: number;
  /** 0-1, 1 = exact target frequency. */
  readonly frequencyQuality: number;

  /** 0-1. */
  readonly gainQuality: number;

  /** 0-1. */
  readonly filterQuality: number;

  readonly phaseErrorDeg: number;
  /** 0-1. */
  readonly phaseQuality: number;

  /** 0-1 — carrier amplitude reaching the receiver after channel/frequency gating. */
  readonly effectiveSignalStrength: number;
  /** 0-1+ — noise floor after gain/filter amplification (cosmetic/UI + SNR input only). */
  readonly amplifiedNoise: number;
  /** 0-1 — effectiveSignalStrength vs amplifiedNoise, for UI feedback only. */
  readonly signalToNoiseQuality: number;

  /**
   * 0-1 final quality driving lock/decode. NOT a simple average — see
   * SignalEvaluator.ts's evaluate() doc comment for the exact combination
   * formula (channel+frequency multiplicatively gate; gain/filter/phase
   * refine within that ceiling).
   */
  readonly overallQuality: number;

  /** Which single control is most responsible for a low overallQuality. */
  readonly limitingFactor: LimitingFactor;
}
