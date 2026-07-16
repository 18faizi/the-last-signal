/**
 * Registry + runtime state for facility zones.
 *
 * Tracks which zones the player has discovered (entered for the first time)
 * and which they are currently inside.  Zone overlap is possible when AABBs
 * share a border — the registry records all containing zones simultaneously.
 *
 * Babylon-free; unit-testable with plain {x,y,z} positions.
 */
import { aabbContains, type FacilityZoneDefinition, type Point3 } from './FacilityZone';

export type ZoneEventKind = 'entered' | 'exited' | 'discovered';

export interface ZoneEvent {
  readonly kind: ZoneEventKind;
  readonly zoneId: string;
}

type ZoneListener = (event: ZoneEvent) => void;

export class ZoneRegistry {
  private readonly zones = new Map<string, FacilityZoneDefinition>();
  private readonly discoveredZones = new Set<string>();
  private readonly currentZones = new Set<string>();
  private readonly listeners = new Set<ZoneListener>();

  /** Register a zone definition.  Throws on duplicate id. */
  register(zone: FacilityZoneDefinition): void {
    if (this.zones.has(zone.id)) {
      throw new Error(`ZoneRegistry: duplicate zone id "${zone.id}"`);
    }
    this.zones.set(zone.id, zone);
  }

  get(id: string): FacilityZoneDefinition | undefined {
    return this.zones.get(id);
  }

  getAll(): readonly FacilityZoneDefinition[] {
    return [...this.zones.values()];
  }

  get discoveredCount(): number {
    return this.discoveredZones.size;
  }

  get totalCount(): number {
    return this.zones.size;
  }

  isDiscovered(id: string): boolean {
    return this.discoveredZones.has(id);
  }

  isCurrentlyInside(id: string): boolean {
    return this.currentZones.has(id);
  }

  /** Returns all zone ids the player is currently inside. */
  get activeZoneIds(): readonly string[] {
    return [...this.currentZones];
  }

  /**
   * Call each frame (or when player has moved) with the player's current
   * world position.  Emits 'entered'/'exited'/'discovered' events when zone
   * membership changes.
   */
  update(playerPosition: Point3): void {
    for (const zone of this.zones.values()) {
      const inside = aabbContains(zone.aabb, playerPosition);
      const wasInside = this.currentZones.has(zone.id);

      if (inside && !wasInside) {
        this.currentZones.add(zone.id);
        if (!this.discoveredZones.has(zone.id)) {
          this.discoveredZones.add(zone.id);
          this.emit({ kind: 'discovered', zoneId: zone.id });
        }
        this.emit({ kind: 'entered', zoneId: zone.id });
      } else if (!inside && wasInside) {
        this.currentZones.delete(zone.id);
        this.emit({ kind: 'exited', zoneId: zone.id });
      }
    }
  }

  /** Subscribe to zone events.  Returns unsubscribe function. */
  onZoneEvent(listener: ZoneListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Reset all runtime state (discoveries, current membership). */
  reset(): void {
    const exitedIds = [...this.currentZones];
    this.currentZones.clear();
    for (const id of exitedIds) {
      this.emit({ kind: 'exited', zoneId: id });
    }
    this.discoveredZones.clear();
  }

  clear(): void {
    this.reset();
    this.zones.clear();
    this.listeners.clear();
  }

  private emit(event: ZoneEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow listener errors.
      }
    }
  }
}
