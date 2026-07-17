/**
 * Antenna array + waveguide path definitions for the facility greybox scene
 * (Milestone 0.8). Mirrors facilitySignalDefinitions.ts/
 * facilityPowerDefinitions.ts's plain-data module pattern.
 *
 * Three arrays (spec §10/§12):
 *   North Dish (ExternalCandidate)      – medium gain, WIDE capture (easier
 *     to align), lower maxQuality — its bearing is authored to read as
 *     "weak external-ish" and never conclusive (see BearingEvaluator.ts).
 *   East Relay Dish (RelayCandidate)    – higher gain, NARROW tolerance
 *     (harder), higher maxQuality, required for progression — its exact
 *     target is spec-mandated: azimuth 42° ±8°, elevation 18° ±6°,
 *     polarization -35° ±12°.
 *   Tower Diagnostic Loop (DiagnosticLoop) – short-range (low base gain),
 *     wide/forgiving tolerances, initially easy to dismiss but its
 *     near-zero modeled path delay is what confirms local coupling.
 *
 * Waveguide paths: North Dish and the diagnostic loop start already
 * correctly routed (no puzzle needed there); the East Relay Dish's feed
 * starts Misrouted to an inactive test port per spec §23's example — that
 * is THE waveguide puzzle this milestone introduces.
 */
import { asAntennaArrayId } from '../../../game/antenna/AntennaArrayId';
import type { AntennaArrayDefinition } from '../../../game/antenna/AntennaArrayDefinition';
import type { WaveguideDefinition } from '../../../game/waveguide/WaveguideDefinition';
import { CIRCUIT_ROOFTOP_ANTENNA_ID } from '../power/facilityPowerDefinitions';

// ----- Waveguide paths -------------------------------------------------------

export const WAVEGUIDE_NORTH_DISH_ID = 'fg-waveguide-north-dish';
export const WAVEGUIDE_EAST_RELAY_ID = 'fg-waveguide-east-relay';
export const WAVEGUIDE_DIAGNOSTIC_LOOP_ID = 'fg-waveguide-diagnostic-loop';

export const PORT_TEST = { id: 'test-port', displayName: 'Test Port (inactive)' };
export const PORT_RECEIVER_A = { id: 'receiver-input-a', displayName: 'Receiver Input A' };
export const PORT_RECEIVER_B = { id: 'receiver-input-b', displayName: 'Receiver Input B' };
export const PORT_DIAGNOSTIC = { id: 'diagnostic-port', displayName: 'Diagnostic Port' };

export const WAVEGUIDE_NORTH_DISH: WaveguideDefinition = {
  id: WAVEGUIDE_NORTH_DISH_ID,
  displayName: 'North Dish Waveguide',
  segments: [
    'North Dish Feed',
    'Rooftop Run A',
    'Control Building Feedthrough',
    'Receiver Input A',
  ],
  ports: [PORT_RECEIVER_A, PORT_RECEIVER_B, PORT_TEST],
  correctPortId: PORT_RECEIVER_A.id,
  defaultPortId: PORT_RECEIVER_A.id,
  defaultState: 'Connected',
};

/**
 * THE waveguide puzzle: starts routed to the inactive test port (spec §23's
 * exact example), so its continuity is 0 until the player corrects it at
 * the junction box.
 */
export const WAVEGUIDE_EAST_RELAY: WaveguideDefinition = {
  id: WAVEGUIDE_EAST_RELAY_ID,
  displayName: 'East Relay Dish Waveguide',
  segments: [
    'East Relay Feed',
    'Rooftop Run B',
    'Control Building Feedthrough',
    'Receiver Input B',
  ],
  ports: [PORT_TEST, PORT_RECEIVER_B, PORT_RECEIVER_A],
  correctPortId: PORT_RECEIVER_B.id,
  defaultPortId: PORT_TEST.id,
  defaultState: 'Misrouted',
};

export const WAVEGUIDE_DIAGNOSTIC_LOOP: WaveguideDefinition = {
  id: WAVEGUIDE_DIAGNOSTIC_LOOP_ID,
  displayName: 'Tower Diagnostic Loop Waveguide',
  segments: ['Diagnostic Loop Feed', 'Short Local Run', 'Diagnostic Port'],
  ports: [PORT_DIAGNOSTIC, PORT_TEST],
  correctPortId: PORT_DIAGNOSTIC.id,
  defaultPortId: PORT_DIAGNOSTIC.id,
  defaultState: 'Connected',
};

export const FACILITY_WAVEGUIDES: readonly WaveguideDefinition[] = [
  WAVEGUIDE_NORTH_DISH,
  WAVEGUIDE_EAST_RELAY,
  WAVEGUIDE_DIAGNOSTIC_LOOP,
];

// ----- Antenna arrays --------------------------------------------------------

export const ANTENNA_NORTH_DISH_ID = asAntennaArrayId('fg-antenna-north-dish');
export const ANTENNA_EAST_RELAY_ID = asAntennaArrayId('fg-antenna-east-relay');
export const ANTENNA_TOWER_DIAGNOSTIC_ID = asAntennaArrayId('fg-antenna-tower-diagnostic');

export const ANTENNA_NORTH_DISH: AntennaArrayDefinition = {
  id: ANTENNA_NORTH_DISH_ID,
  displayName: 'North Dish',
  role: 'ExternalCandidate',
  minAzimuthDeg: -90,
  maxAzimuthDeg: 90,
  minElevationDeg: 0,
  maxElevationDeg: 60,
  minPolarizationDeg: -90,
  maxPolarizationDeg: 90,
  targetAzimuthDeg: 15,
  azimuthToleranceDeg: 15,
  targetElevationDeg: 25,
  elevationToleranceDeg: 10,
  targetPolarizationDeg: 10,
  polarizationToleranceDeg: 20,
  baseGain: 0.5,
  captureWidthDeg: 30,
  maxQuality: 0.6,
  requiredPowerCircuitId: CIRCUIT_ROOFTOP_ANTENNA_ID,
  waveguidePathId: WAVEGUIDE_NORTH_DISH_ID,
  receiverCompatible: true,
  selectable: true,
  requiredForProgression: true,
  azimuthSpeedDegPerSecond: 14,
  elevationSpeedDegPerSecond: 10,
  polarizationSpeedDegPerSecond: 22,
  azimuthStepCoarseDeg: 2,
  azimuthStepFineDeg: 0.5,
  elevationStepCoarseDeg: 1.5,
  elevationStepFineDeg: 0.3,
  polarizationStepCoarseDeg: 3,
  polarizationStepFineDeg: 0.5,
};

/** East Relay Dish — spec §12's exact target: azimuth 42° ±8°, elevation 18° ±6°, polarization -35° ±12°. */
export const ANTENNA_EAST_RELAY: AntennaArrayDefinition = {
  id: ANTENNA_EAST_RELAY_ID,
  displayName: 'East Relay Dish',
  role: 'RelayCandidate',
  minAzimuthDeg: -60,
  maxAzimuthDeg: 90,
  minElevationDeg: 0,
  maxElevationDeg: 40,
  minPolarizationDeg: -90,
  maxPolarizationDeg: 90,
  targetAzimuthDeg: 42,
  azimuthToleranceDeg: 8,
  targetElevationDeg: 18,
  elevationToleranceDeg: 6,
  targetPolarizationDeg: -35,
  polarizationToleranceDeg: 12,
  baseGain: 0.8,
  captureWidthDeg: 6,
  maxQuality: 0.95,
  requiredPowerCircuitId: CIRCUIT_ROOFTOP_ANTENNA_ID,
  waveguidePathId: WAVEGUIDE_EAST_RELAY_ID,
  receiverCompatible: true,
  selectable: true,
  requiredForProgression: true,
  azimuthSpeedDegPerSecond: 16,
  elevationSpeedDegPerSecond: 12,
  polarizationSpeedDegPerSecond: 25,
  azimuthStepCoarseDeg: 2,
  azimuthStepFineDeg: 0.5,
  elevationStepCoarseDeg: 1.5,
  elevationStepFineDeg: 0.3,
  polarizationStepCoarseDeg: 3,
  polarizationStepFineDeg: 0.5,
};

export const ANTENNA_TOWER_DIAGNOSTIC: AntennaArrayDefinition = {
  id: ANTENNA_TOWER_DIAGNOSTIC_ID,
  displayName: 'Tower Diagnostic Loop',
  role: 'DiagnosticLoop',
  minAzimuthDeg: -90,
  maxAzimuthDeg: 90,
  minElevationDeg: 0,
  maxElevationDeg: 30,
  minPolarizationDeg: -90,
  maxPolarizationDeg: 90,
  targetAzimuthDeg: 0,
  azimuthToleranceDeg: 20,
  targetElevationDeg: 15,
  elevationToleranceDeg: 6,
  targetPolarizationDeg: 0,
  polarizationToleranceDeg: 30,
  baseGain: 0.3,
  captureWidthDeg: 40,
  maxQuality: 0.8,
  requiredPowerCircuitId: CIRCUIT_ROOFTOP_ANTENNA_ID,
  waveguidePathId: WAVEGUIDE_DIAGNOSTIC_LOOP_ID,
  receiverCompatible: false,
  selectable: true,
  requiredForProgression: true,
  azimuthSpeedDegPerSecond: 18,
  elevationSpeedDegPerSecond: 9,
  polarizationSpeedDegPerSecond: 20,
  azimuthStepCoarseDeg: 2,
  azimuthStepFineDeg: 0.5,
  elevationStepCoarseDeg: 1.5,
  elevationStepFineDeg: 0.3,
  polarizationStepCoarseDeg: 3,
  polarizationStepFineDeg: 0.5,
};

export const FACILITY_ANTENNA_ARRAYS: readonly AntennaArrayDefinition[] = [
  ANTENNA_NORTH_DISH,
  ANTENNA_EAST_RELAY,
  ANTENNA_TOWER_DIAGNOSTIC,
];
