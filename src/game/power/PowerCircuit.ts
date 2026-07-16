import type { PowerCircuitId } from './PowerCircuitId';
import type { PowerSourceId } from './PowerSourceId';

/**
 * Static, immutable description of a power circuit.
 *
 * A circuit is a named group of loads (lights, doors, terminals) that is
 * switched and allocated as a single capacity-costed unit. It never stores
 * Babylon or DOM references — world objects observe circuit state via
 * PoweredStateBinding instead.
 */
export interface PowerCircuitDefinition {
  readonly id: PowerCircuitId;
  readonly displayName: string;
  /** Capacity units consumed from its source while energized. */
  readonly capacityCost: number;
  /**
   * Informational ordering for panel display / default allocation
   * suggestions. Higher = more important. Does not affect validation.
   */
  readonly priority: number;
  /** One-line flavour text shown on the distribution panel. */
  readonly description: string;
  /** Source ids that may legally energize this circuit. */
  readonly eligibleSourceIds: readonly PowerSourceId[];
  /**
   * Whether this circuit may be energized from the emergency battery before
   * the generator is running. Circuits too costly for the battery's 2-unit
   * capacity should still mark this honestly — the allocator will simply
   * reject the request for insufficient capacity.
   */
  readonly emergencyEligible: boolean;
  /**
   * Optional id of an upstream breaker (BreakerController, electrical layer)
   * that must be closed for this circuit to energize. Purely descriptive at
   * this layer — PowerNetwork does not evaluate it; BreakerController does,
   * by only calling requestCircuit() once its own breaker is closed.
   */
  readonly requiredBreakerId?: string;
}
