import type { PowerCircuitId } from '../power/PowerCircuitId';
import type { PowerSourceId } from '../power/PowerSourceId';

/** Static description of one distribution-panel breaker. */
export interface BreakerDefinition {
  readonly id: string;
  readonly circuitId: PowerCircuitId;
  /** Source this breaker requests power from when closed. */
  readonly sourceId: PowerSourceId;
  readonly displayName: string;
}
