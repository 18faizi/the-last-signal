/**
 * Static, immutable description of an inventory item type.
 *
 * Definitions are registered in InventoryRegistry at scene setup. Runtime
 * ownership is tracked separately in InventoryService so the two concerns
 * never blur. No Babylon objects live here.
 */
import type { InventoryItemId } from './InventoryItemId';
import type { ItemCategory } from './ItemCategory';
import type { ConsumptionPolicy } from './ItemConsumptionPolicy';

export interface InventoryItemDefinition {
  /** Stable identifier — must match InventoryItemId contract (non-empty, trimmed). */
  readonly id: InventoryItemId;
  /** Short display name shown in the inventory viewer, e.g. "Maintenance Key". */
  readonly displayName: string;
  /** One-line hint shown below the name, e.g. "Opens maintenance corridor doors". */
  readonly description?: string;
  readonly category: ItemCategory;
  /**
   * How the item is consumed when it satisfies a lock requirement.
   * Defaults to 'retain' if omitted.
   */
  readonly consumptionPolicy?: ConsumptionPolicy;
  /**
   * Maximum stack size. Defaults to 1. Values > 1 allow the player to hold
   * multiple units (e.g. keycards collected at different times).
   */
  readonly maxStack?: number;
}
