import type { PowerCircuitId } from './PowerCircuitId';
import type { PowerLoadId } from './PowerLoadId';

/**
 * Static description of a power load: a single lamp, terminal, door
 * actuator, etc. that belongs to exactly one circuit. Loads carry no
 * Babylon/DOM references — PoweredStateBinding is how world objects observe
 * their powered state.
 */
export interface PowerLoadDefinition {
  readonly id: PowerLoadId;
  readonly circuitId: PowerCircuitId;
  readonly displayName: string;
}
