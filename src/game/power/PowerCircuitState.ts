import type { PowerCircuitId } from './PowerCircuitId';
import type { PowerSourceId } from './PowerSourceId';

/** What the player/panel last asked for. */
export type CircuitRequestedState = 'off' | 'on';

/** What the circuit is actually doing right now (may lag 'requested' on rejection). */
export type CircuitEffectiveState = 'de-energized' | 'energized';

/** Mutable runtime state for one registered circuit. Owned by PowerNetwork. */
export interface PowerCircuitState {
  readonly circuitId: PowerCircuitId;
  requested: CircuitRequestedState;
  effective: CircuitEffectiveState;
  /** Source currently supplying this circuit, or null when de-energized. */
  sourceId: PowerSourceId | null;
}

export function createPowerCircuitState(circuitId: PowerCircuitId): PowerCircuitState {
  return { circuitId, requested: 'off', effective: 'de-energized', sourceId: null };
}
