/**
 * Static, immutable description of a physical world pickup.
 *
 * The PickupController uses this to build the mesh and register the
 * InteractionTarget. No Babylon objects live here.
 */
import type { InventoryItemId } from '../inventory/InventoryItemId';

export type PickupInteractionMode = 'direct' | 'inspect-before-collect' | 'hold';

export interface PickupDefinition {
  /** Unique scene identifier. */
  readonly id: string;
  /** The item added to inventory when collected. */
  readonly itemId: InventoryItemId;
  /** How the player acquires it. Default: 'direct'. */
  readonly mode?: PickupInteractionMode;
  /** Label shown in interaction prompt, e.g. "MAINTENANCE KEY". */
  readonly label: string;
  /** Shown in the inspection overlay when mode = 'inspect-before-collect'. */
  readonly inspectionTitle?: string;
  readonly inspectionDescription?: string;
  /**
   * For 'hold' mode: duration in seconds. Default: 1.5.
   */
  readonly holdDurationSeconds?: number;
  /** Number of units added to inventory on collect. Default: 1. */
  readonly quantity?: number;
}
