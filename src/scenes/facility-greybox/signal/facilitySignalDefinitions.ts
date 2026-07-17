/**
 * Signal definitions for the facility greybox scene's control-room
 * receiver — the milestone's one required transmission.
 *
 * Tolerances are tuned so the puzzle is solvable via reasonable manual
 * tuning (not pixel-perfect) but not trivially solved by the receiver's
 * default controls — see signalValidation.test.ts's solver-style tests,
 * which evaluate these exact values.
 */
import { asSignalId } from '../../../game/signal/SignalId';
import type { SignalDefinition } from '../../../game/signal/SignalDefinition';

export const FIRST_ANOMALOUS_TRANSMISSION_ID = asSignalId('first_anomalous_transmission');

export const FIRST_ANOMALOUS_TRANSMISSION: SignalDefinition = {
  id: FIRST_ANOMALOUS_TRANSMISSION_ID,
  displayName: 'Unidentified Transmission — Channel 3',
  channel: 3,
  targetFrequencyMHz: 117.4,
  frequencyToleranceMHz: 0.6,
  targetGainMin: 0.55,
  targetGainMax: 0.65,
  targetFilter: 0.65,
  filterTolerance: 0.12,
  targetPhaseDeg: -18,
  phaseToleranceDeg: 22,
  baseSignalStrength: 0.8,
  baseNoiseLevel: 0.35,
  minLockQuality: 0.85,
  lockAcquisitionSeconds: 2,
  decodeSeconds: 5,
  transcriptDocumentId: 'doc-transmission-first-anomalous',
  discoverable: true,
  requiredForProgression: true,
};

export const FACILITY_SIGNALS: readonly SignalDefinition[] = [FIRST_ANOMALOUS_TRANSMISSION];
