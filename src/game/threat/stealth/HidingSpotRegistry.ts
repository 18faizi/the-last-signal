/**
 * Hiding spot registry (Milestone 0.9): definitions + occupancy.
 *
 * Occupancy lives here (not in the definition — definitions are immutable
 * authored data) so perception, encounter rules and the debug overlay all
 * agree on which spot the player occupies. One player, so at most one spot
 * is occupied at a time; the registry enforces that.
 */
import { validateHidingSpotDefinition, type HidingSpotDefinition } from './HidingSpotDefinition';
import type { HidingSpotId } from '../ThreatId';

export class HidingSpotRegistry {
  private readonly spots = new Map<HidingSpotId, HidingSpotDefinition>();
  private occupied: HidingSpotId | null = null;

  register(definition: HidingSpotDefinition): void {
    if (this.spots.has(definition.id)) {
      throw new Error(`HidingSpotRegistry: duplicate hiding spot id "${definition.id}"`);
    }
    this.spots.set(definition.id, definition);
  }

  get(id: HidingSpotId): HidingSpotDefinition | undefined {
    return this.spots.get(id);
  }

  getAll(): readonly HidingSpotDefinition[] {
    return [...this.spots.values()];
  }

  get count(): number {
    return this.spots.size;
  }

  /** Spot currently occupied by the player, or null. */
  get occupiedSpotId(): HidingSpotId | null {
    return this.occupied;
  }

  isOccupied(id: HidingSpotId): boolean {
    return this.occupied === id;
  }

  /** Returns false when another spot is already occupied or id is unknown. */
  tryOccupy(id: HidingSpotId): boolean {
    if (!this.spots.has(id)) return false;
    if (this.occupied !== null && this.occupied !== id) return false;
    this.occupied = id;
    return true;
  }

  release(id: HidingSpotId): void {
    if (this.occupied === id) {
      this.occupied = null;
    }
  }

  /** Validation across all registered spots (dev builds, scene creation). */
  validate(zoneIds: readonly string[]): string[] {
    const problems: string[] = [];
    for (const def of this.spots.values()) {
      problems.push(...validateHidingSpotDefinition(def));
      if (!zoneIds.includes(def.zoneId)) {
        problems.push(`hiding spot "${def.id}": zone "${def.zoneId}" is not a registered zone`);
      }
    }
    return problems;
  }

  /** Full reset (dev "full reset" action only): empties occupancy. */
  reset(): void {
    this.occupied = null;
  }

  clear(): void {
    this.reset();
    this.spots.clear();
  }
}
