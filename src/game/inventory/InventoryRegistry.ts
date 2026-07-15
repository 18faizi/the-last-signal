/**
 * Read-only catalogue of InventoryItemDefinitions.
 *
 * Registered at scene setup; never mutated at runtime. Looked up by the
 * access evaluator and the inventory viewer. Babylon-free.
 */
import { isValidItemId } from './InventoryItemId';
import type { InventoryItemDefinition } from './InventoryItemDefinition';
import type { InventoryItemId } from './InventoryItemId';

export class InventoryRegistry {
  private readonly defs = new Map<InventoryItemId, InventoryItemDefinition>();

  /**
   * Register an item definition.
   * @throws {Error} if the id is invalid or already registered.
   */
  register(definition: InventoryItemDefinition): void {
    if (!isValidItemId(definition.id)) {
      throw new Error(`InventoryRegistry: invalid item id "${String(definition.id)}"`);
    }
    if (this.defs.has(definition.id)) {
      throw new Error(`InventoryRegistry: duplicate item id "${definition.id}"`);
    }
    this.defs.set(definition.id, definition);
  }

  get(id: InventoryItemId): InventoryItemDefinition | undefined {
    return this.defs.get(id);
  }

  getAll(): readonly InventoryItemDefinition[] {
    return [...this.defs.values()];
  }

  has(id: InventoryItemId): boolean {
    return this.defs.has(id);
  }

  clear(): void {
    this.defs.clear();
  }
}
