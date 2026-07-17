import type { AntennaArrayId } from './AntennaArrayId';

/**
 * What role an array plays in the source-analysis reveal (spec §10). Purely
 * descriptive metadata consumed by BearingEvaluator's authored table and by
 * UI copy — the evaluator itself still switches on `AntennaArrayId`, this
 * field never drives branching logic on its own.
 */
export type AntennaArrayRole = 'ExternalCandidate' | 'RelayCandidate' | 'DiagnosticLoop';

/**
 * Static, immutable description of one rooftop antenna array.
 *
 * Mirrors SignalDefinition.ts/ReceiverDefinition.ts's shape: plain data, no
 * Babylon/DOM, validated once at scene-creation time by AntennaValidation.
 */
export interface AntennaArrayDefinition {
  readonly id: AntennaArrayId;
  readonly displayName: string;
  readonly role: AntennaArrayRole;

  /** Legal mechanical ranges the controller will clamp motion to. */
  readonly minAzimuthDeg: number;
  readonly maxAzimuthDeg: number;
  readonly minElevationDeg: number;
  readonly maxElevationDeg: number;
  readonly minPolarizationDeg: number;
  readonly maxPolarizationDeg: number;

  /** Alignment solution + tolerances (all positive). */
  readonly targetAzimuthDeg: number;
  readonly azimuthToleranceDeg: number;
  readonly targetElevationDeg: number;
  readonly elevationToleranceDeg: number;
  readonly targetPolarizationDeg: number;
  readonly polarizationToleranceDeg: number;

  /** 0-1 base gain contribution before axis-quality is applied. */
  readonly baseGain: number;
  /**
   * Degrees of azimuth captured at 1.0 axis-quality width — a wider capture
   * width means a more forgiving (easier) array, matching spec §10's "North
   * Dish: medium gain, wide capture, easier detection" characterization.
   */
  readonly captureWidthDeg: number;
  /** 0-1 ceiling `AntennaEvaluator` clamps overallQuality to, even at perfect alignment. */
  readonly maxQuality: number;

  readonly requiredPowerCircuitId: string;
  readonly waveguidePathId: string;
  /** Whether this array can feed the receiver console at all (vs. diagnostic-only). */
  readonly receiverCompatible: boolean;
  readonly selectable: boolean;
  readonly requiredForProgression: boolean;

  /** Frame-rate-independent mechanical speeds (degrees/second). */
  readonly azimuthSpeedDegPerSecond: number;
  readonly elevationSpeedDegPerSecond: number;
  readonly polarizationSpeedDegPerSecond: number;

  /** Coarse/fine per-keypress adjustment steps, mirroring ReceiverDefinition's step fields. */
  readonly azimuthStepCoarseDeg: number;
  readonly azimuthStepFineDeg: number;
  readonly elevationStepCoarseDeg: number;
  readonly elevationStepFineDeg: number;
  readonly polarizationStepCoarseDeg: number;
  readonly polarizationStepFineDeg: number;

  readonly metadata?: Readonly<Record<string, string>>;
}
