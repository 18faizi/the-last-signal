/**
 * Runtime ownership record for one item type in the player's inventory.
 *
 * Immutable value; InventoryService always produces new entries instead of
 * mutating. Babylon-free: no meshes, materials, physics bodies, or DOM nodes.
 */
import type { InventoryItemId } from './InventoryItemId';

export interface InventoryEntry {
  readonly itemId: InventoryItemId;
  /** Number of units held. Always ≥ 1; zero means the entry is absent. */
  readonly quantity: number;
}
