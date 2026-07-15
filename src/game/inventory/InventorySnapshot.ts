/**
 * Point-in-time read of the player's inventory, produced by InventoryService.
 *
 * Immutable and Babylon-free. Used by UI, tests and the access evaluator.
 */
import type { InventoryEntry } from './InventoryEntry';
import type { InventoryItemId } from './InventoryItemId';

export interface InventorySnapshot {
  /** All entries with quantity ≥ 1, in stable insertion order. */
  readonly entries: readonly InventoryEntry[];
  /** Total distinct item types held. */
  readonly itemTypeCount: number;
  /** Quick existence check. */
  has(itemId: InventoryItemId): boolean;
  /** Returns the quantity for an item, or 0 if not held. */
  getQuantity(itemId: InventoryItemId): number;
}
