import type { PowerCircuitId } from './PowerCircuitId';
import type { PowerLoadId } from './PowerLoadId';
import type { PowerSourceId } from './PowerSourceId';
import type { CircuitEffectiveState, CircuitRequestedState } from './PowerCircuitState';
import type { PowerSourceAvailability } from './PowerSourceState';
import type { PowerSourceKind } from './PowerSource';

/** Immutable point-in-time view of one source, for debugging/tests/UI. */
export interface PowerSourceSnapshot {
  readonly id: PowerSourceId;
  readonly kind: PowerSourceKind;
  readonly displayName: string;
  readonly availability: PowerSourceAvailability;
  readonly maxCapacity: number;
  readonly allocatedCapacity: number;
}

export interface PowerCircuitSnapshot {
  readonly id: PowerCircuitId;
  readonly displayName: string;
  readonly description: string;
  readonly capacityCost: number;
  readonly requested: CircuitRequestedState;
  readonly effective: CircuitEffectiveState;
  readonly sourceId: PowerSourceId | null;
  readonly emergencyEligible: boolean;
  readonly eligibleSourceIds: readonly PowerSourceId[];
}

export interface PowerLoadSnapshot {
  readonly id: PowerLoadId;
  readonly circuitId: PowerCircuitId;
  readonly powered: boolean;
}

/** Full, immutable snapshot of the network — safe to hand to tests/UI/debug views. */
export interface PowerSnapshot {
  readonly sources: readonly PowerSourceSnapshot[];
  readonly circuits: readonly PowerCircuitSnapshot[];
  readonly loads: readonly PowerLoadSnapshot[];
}
