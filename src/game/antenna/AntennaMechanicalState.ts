/**
 * Plain mutable mechanical state for one antenna array — the "physical"
 * position the dish/mount is actually at, as opposed to AntennaControlState
 * (the high-level mode) or AntennaArrayDefinition (the static solution).
 *
 * Mirrors ReceiverControls.ts's precedent for mutable, continuously-changing
 * domain state: plain data, mutated in place by AntennaController.
 */
export interface AntennaMechanicalState {
  currentAzimuthDeg: number;
  currentElevationDeg: number;
  currentPolarizationDeg: number;

  /** Commanded target the controller is actively moving toward, or null when idle/parked. */
  targetAzimuthDeg: number | null;
  targetElevationDeg: number | null;
  targetPolarizationDeg: number | null;

  emergencyStopped: boolean;
  parked: boolean;
}

export function createDefaultAntennaMechanicalState(
  parkAzimuthDeg: number,
  parkElevationDeg: number,
  parkPolarizationDeg: number,
): AntennaMechanicalState {
  return {
    currentAzimuthDeg: parkAzimuthDeg,
    currentElevationDeg: parkElevationDeg,
    currentPolarizationDeg: parkPolarizationDeg,
    targetAzimuthDeg: null,
    targetElevationDeg: null,
    targetPolarizationDeg: null,
    emergencyStopped: false,
    parked: true,
  };
}

export function cloneAntennaMechanicalState(state: AntennaMechanicalState): AntennaMechanicalState {
  return { ...state };
}
