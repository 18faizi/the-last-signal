/**
 * Typed inventory domain service — pure data, no Babylon objects.
 *
 * Tracks how many units of each item the player currently holds. Emits
 * typed events on every state change so the UI and access system can react
 * without polling. Item definitions are validated against an InventoryRegistry
 * so unknown IDs are rejected early.
 *
 * Thread-safety: single-threaded JavaScript; no external locking needed.
 */
import type { InventoryItemId } from './InventoryItemId';
import { isValidItemId } from './InventoryItemId';
import type { InventoryItemDefinition } from './InventoryItemDefinition';
import type { InventoryRegistry } from './InventoryRegistry';
import type { InventoryEntry } from './InventoryEntry';
import type { InventorySnapshot } from './InventorySnapshot';
import type { InventoryEvent } from './InventoryEvent';

type InventoryListener = (event: InventoryEvent) => void;

/** Concrete snapshot implementation (private to this module). */
class InventorySnapshotImpl implements InventorySnapshot {
  readonly entries: readonly InventoryEntry[];
  readonly itemTypeCount: number;

  private readonly byId: ReadonlyMap<InventoryItemId, number>;

  constructor(entries: readonly InventoryEntry[]) {
    this.entries = entries;
    this.itemTypeCount = entries.length;
    const map = new Map<InventoryItemId, number>();
    for (const entry of entries) {
      map.set(entry.itemId, entry.quantity);
    }
    this.byId = map;
  }

  has(itemId: InventoryItemId): boolean {
    return (this.byId.get(itemId) ?? 0) > 0;
  }

  getQuantity(itemId: InventoryItemId): number {
    return this.byId.get(itemId) ?? 0;
  }
}

export class InventoryService {
  private readonly registry: InventoryRegistry;
  private readonly quantities = new Map<InventoryItemId, number>();
  private readonly listeners = new Set<InventoryListener>();

  constructor(registry: InventoryRegistry) {
    this.registry = registry;
  }

  // ----- read ------------------------------------------------------------

  getSnapshot(): InventorySnapshot {
    const entries: InventoryEntry[] = [];
    for (const [itemId, quantity] of this.quantities) {
      if (quantity > 0) {
        entries.push({ itemId, quantity });
      }
    }
    return new InventorySnapshotImpl(entries);
  }

  getQuantity(itemId: InventoryItemId): number {
    return this.quantities.get(itemId) ?? 0;
  }

  has(itemId: InventoryItemId): boolean {
    return (this.quantities.get(itemId) ?? 0) > 0;
  }

  // ----- write -----------------------------------------------------------

  /**
   * Add `count` units of an item. Validates against registry.
   * Clamps to definition.maxStack when defined.
   * @throws {Error} if itemId is invalid or unknown.
   */
  add(itemId: InventoryItemId, count = 1): void {
    const def = this.resolve(itemId);
    const maxStack = def.maxStack ?? 1;
    const current = this.quantities.get(itemId) ?? 0;
    const clamped = Math.min(count, maxStack - current);
    if (clamped <= 0) {
      return; // already at cap
    }
    const newQty = current + clamped;
    this.quantities.set(itemId, newQty);
    if (current === 0) {
      this.emit({ kind: 'item-added', itemId, quantity: clamped, totalQuantity: newQty });
    } else {
      this.emit({
        kind: 'quantity-changed',
        itemId,
        previousQuantity: current,
        newQuantity: newQty,
      });
    }
  }

  /**
   * Remove `count` units. Clamps to what is held (no negatives).
   * No-op if item not in inventory.
   */
  remove(itemId: InventoryItemId, count = 1): void {
    if (!isValidItemId(itemId)) {
      throw new Error(`InventoryService.remove: invalid item id "${String(itemId)}"`);
    }
    const current = this.quantities.get(itemId) ?? 0;
    if (current === 0) {
      return;
    }
    const actual = Math.min(count, current);
    const newQty = current - actual;
    if (newQty === 0) {
      this.quantities.delete(itemId);
      this.emit({ kind: 'item-removed', itemId, quantity: actual, totalQuantity: 0 });
    } else {
      this.quantities.set(itemId, newQty);
      this.emit({
        kind: 'quantity-changed',
        itemId,
        previousQuantity: current,
        newQuantity: newQty,
      });
    }
  }

  /** Remove all units of a specific item. */
  removeAll(itemId: InventoryItemId): void {
    const current = this.quantities.get(itemId) ?? 0;
    if (current === 0) {
      return;
    }
    this.quantities.delete(itemId);
    this.emit({ kind: 'item-removed', itemId, quantity: current, totalQuantity: 0 });
  }

  /** Clears everything; emits a single inventory-reset event. */
  reset(): void {
    this.quantities.clear();
    this.emit({ kind: 'inventory-reset' });
  }

  // ----- events ----------------------------------------------------------

  /** Subscribe to inventory changes. Returns an unsubscribe function. */
  subscribe(listener: InventoryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ----- helpers ---------------------------------------------------------

  private resolve(itemId: InventoryItemId): InventoryItemDefinition {
    if (!isValidItemId(itemId)) {
      throw new Error(`InventoryService: invalid item id "${String(itemId)}"`);
    }
    const def = this.registry.get(itemId);
    if (def === undefined) {
      throw new Error(`InventoryService: unknown item id "${itemId}" — register it first`);
    }
    return def;
  }

  private emit(event: InventoryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow listener errors; they must not break inventory state.
      }
    }
  }
}
