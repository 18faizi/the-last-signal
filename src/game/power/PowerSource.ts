import type { PowerSourceId } from './PowerSourceId';

/**
 * Static, immutable description of a power source.
 *
 * Two kinds exist in Milestone 0.6: the facility generator (large capacity,
 * offline until started) and the emergency battery (small capacity, available
 * from boot). PowerNetwork treats both uniformly through this shape — no
 * per-kind special-casing in the allocation engine itself.
 */
export type PowerSourceKind = 'generator' | 'emergency-battery';

export interface PowerSourceDefinition {
  readonly id: PowerSourceId;
  readonly kind: PowerSourceKind;
  readonly displayName: string;
  /** Total capacity units this source can supply simultaneously. */
  readonly maxCapacity: number;
  /**
   * Higher priority sources are preferred by transfer logic (e.g. the
   * generator outranks the emergency battery once it comes online).
   * Purely informational for the allocation engine — callers choose the
   * source explicitly when requesting a circuit.
   */
  readonly priority: number;
}
