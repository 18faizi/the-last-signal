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
   * Reserved placeholder from M0.7 for a possible rooftop-antenna-alignment
   * dependency. Milestone 0.8 shipped WITHOUT wiring this field: antenna
   * prerequisites are tracked entirely by the separate
   * `AntennaProgressionPhase` chain (`first_anomalous_transmission` decoded
   * + rooftop circuit energized, checked directly in
   * `facilityAntennaBindings.ts`), not by a per-signal reference here.
   * `SignalEvaluator` still never reads it. Left in place, still unused, in
   * case a future milestone wants a more granular per-signal linkage.
   */
  readonly antennaAlignmentId?: string;

  readonly metadata?: Readonly<Record<string, string>>;
}
