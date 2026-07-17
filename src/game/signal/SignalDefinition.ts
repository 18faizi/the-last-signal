import type { SignalId } from './SignalId';

/**
 * Static, immutable description of one tunable transmission.
 *
 * Mirrors PowerCircuitDefinition/GeneratorDefinition's shape: plain data,
 * no Babylon/DOM, validated once at scene-creation time by SignalValidation.
 */
export interface SignalDefinition {
  readonly id: SignalId;
  readonly displayName: string;

  /** 1-6. Exact match required — see SignalEvaluator's channel gating. */
  readonly channel: number;
  /** 80-150 MHz. */
  readonly targetFrequencyMHz: number;
  readonly frequencyToleranceMHz: number;

  /** Acceptable gain plateau (0-1); values outside get penalized. */
  readonly targetGainMin: number;
  readonly targetGainMax: number;

  /** 0-1. */
  readonly targetFilter: number;
  readonly filterTolerance: number;

  /** -180..180 degrees. */
  readonly targetPhaseDeg: number;
  readonly phaseToleranceDeg: number;

  /** 0-1 base carrier strength/noise floor before controls are applied. */
  readonly baseSignalStrength: number;
  readonly baseNoiseLevel: number;

  /** 0-1 overall-quality threshold required to begin/hold lock. */
  readonly minLockQuality: number;
  /** Seconds of continuous above-threshold quality to acquire lock. */
  readonly lockAcquisitionSeconds: number;
  /** Seconds of continuous lock to fully decode. */
  readonly decodeSeconds: number;

  readonly transcriptDocumentId: string;
  /** Whether ChannelActivityDetected/scan behavior should surface this signal. */
  readonly discoverable: boolean;
  /** Whether decoding this signal is required to complete the milestone. */
  readonly requiredForProgression: boolean;

  /**
   * Reserved for a future rooftop-antenna-alignment dependency (Milestone
   * 0.8+). Unused by M0.7 — the evaluator never reads it — but modeled now
   * so the definition shape doesn't need to change later.
   */
  readonly antennaAlignmentId?: string;

  readonly metadata?: Readonly<Record<string, string>>;
}
