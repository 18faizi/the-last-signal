/**
 * Typed events emitted by InventoryService.
 *
 * Listeners never receive Babylon objects — these are plain-data events safe
 * to consume in UI code, test bridges and analytics.
 */
import type { InventoryItemId } from './InventoryItemId';

export type InventoryEventKind =
  'item-added' | 'item-removed' | 'quantity-changed' | 'inventory-reset';

export interface ItemAddedEvent {
  readonly kind: 'item-added';
  readonly itemId: InventoryItemId;
  readonly quantity: number;
  readonly totalQuantity: number;
}

export interface ItemRemovedEvent {
  readonly kind: 'item-removed';
  readonly itemId: InventoryItemId;
  readonly quantity: number;
  /** Quantity remaining after removal; 0 when the item was fully consumed. */
  readonly totalQuantity: number;
}

export interface QuantityChangedEvent {
  readonly kind: 'quantity-changed';
  readonly itemId: InventoryItemId;
  readonly previousQuantity: number;
  readonly newQuantity: number;
}

export interface InventoryResetEvent {
  readonly kind: 'inventory-reset';
}

export type InventoryEvent =
  ItemAddedEvent | ItemRemovedEvent | QuantityChangedEvent | InventoryResetEvent;
