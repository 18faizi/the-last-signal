import type { AntennaArrayId } from '../antenna/AntennaArrayId';
import type { WaveguideState } from '../waveguide/WaveguideState';
import type { SignalBearing } from './SignalBearing';

/**
 * One collected sample — a snapshot of an array's alignment + bearing
 * estimate at the moment the player recorded it. Plain data, no Babylon
 * refs, produced only by SourceAnalysisController.collectSample().
 */
export interface SourceCandidate {
  readonly arrayId: AntennaArrayId;
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly polarizationDeg: number;
  readonly alignmentQuality: number;
  readonly receiverQuality: number;
  readonly waveguideState: WaveguideState;
  readonly powered: boolean;
  readonly bearing: SignalBearing;
  readonly confidence: number;
  /** Order this sample was collected in, 0-based — for UI display/debug only. */
  readonly sequenceIndex: number;
}
