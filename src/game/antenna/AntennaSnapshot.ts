import type { AntennaArrayId } from './AntennaArrayId';
import type { AntennaControlState } from './AntennaControlState';
import type { AntennaMechanicalState } from './AntennaMechanicalState';
import type { AntennaMetrics } from './AntennaMetrics';

/**
 * Immutable, plain-data point-in-time view of one array's control/mechanical
 * state + latest evaluation — for debug overlays, UI polling and tests.
 * Mirrors SignalSnapshot.ts's role in the signal domain.
 */
export interface AntennaArraySnapshot {
  readonly id: AntennaArrayId;
  readonly controlState: AntennaControlState;
  readonly mechanical: Readonly<AntennaMechanicalState>;
  readonly metrics: AntennaMetrics | null;
}

/** Whole-controller snapshot: current selection, power state, every array. */
export interface AntennaControllerSnapshot {
  readonly selectedArrayId: AntennaArrayId | null;
  readonly powered: boolean;
  readonly arrays: readonly AntennaArraySnapshot[];
}
