import type { PowerSourceId } from './PowerSourceId';

/**
 * Runtime availability of a power source.
 *
 * 'offline'   – cannot energize any circuit right now (generator not running,
 *               battery not yet initialized).
 * 'available' – can be allocated to eligible circuits, subject to capacity.
 */
export type PowerSourceAvailability = 'offline' | 'available';

/** Mutable runtime state for one registered power source. Owned by PowerNetwork. */
export interface PowerSourceState {
  readonly sourceId: PowerSourceId;
  availability: PowerSourceAvailability;
  /** Sum of capacityCost across circuits currently energized from this source. */
  allocatedCapacity: number;
}

export function createPowerSourceState(sourceId: PowerSourceId): PowerSourceState {
  return { sourceId, availability: 'offline', allocatedCapacity: 0 };
}
