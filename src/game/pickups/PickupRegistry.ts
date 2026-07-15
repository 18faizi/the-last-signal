/**
 * Scene-scoped registry of pickup targets.
 *
 * Allows the test bridge and debug systems to enumerate pickups without
 * holding scene-specific references.
 */
import type { AnyPickupTarget } from './PickupController';

export class PickupRegistry {
  private readonly pickups = new Map<string, AnyPickupTarget>();

  register(target: AnyPickupTarget): void {
    if (this.pickups.has(target.id)) {
      throw new Error(`PickupRegistry: duplicate pickup id "${target.id}"`);
    }
    this.pickups.set(target.id, target);
  }

  get(id: string): AnyPickupTarget | undefined {
    return this.pickups.get(id);
  }

  getAll(): readonly AnyPickupTarget[] {
    return [...this.pickups.values()];
  }

  clear(): void {
    this.pickups.clear();
  }
}
