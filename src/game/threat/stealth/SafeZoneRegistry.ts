/**
 * Safe zone registry (Milestone 0.9): definitions + containment queries.
 * Babylon-free; positions are plain points (same AABB helper as zones).
 */
import { aabbContains, type Point3 } from '../../facility/FacilityZone';
import { validateSafeZoneDefinition, type SafeZoneDefinition } from './SafeZoneDefinition';
import type { SafeZoneId } from '../ThreatId';

export class SafeZoneRegistry {
  private readonly zones = new Map<SafeZoneId, SafeZoneDefinition>();

  register(definition: SafeZoneDefinition): void {
    if (this.zones.has(definition.id)) {
      throw new Error(`SafeZoneRegistry: duplicate safe zone id "${definition.id}"`);
    }
    this.zones.set(definition.id, definition);
  }

  get(id: SafeZoneId): SafeZoneDefinition | undefined {
    return this.zones.get(id);
  }

  getAll(): readonly SafeZoneDefinition[] {
    return [...this.zones.values()];
  }

  get count(): number {
    return this.zones.size;
  }

  /** First safe zone containing the position, or null. */
  zoneContaining(position: Point3): SafeZoneDefinition | null {
    for (const zone of this.zones.values()) {
      if (aabbContains(zone.aabb, position)) return zone;
    }
    return null;
  }

  isInsideAny(position: Point3): boolean {
    return this.zoneContaining(position) !== null;
  }

  validate(checkpointIds: readonly string[]): string[] {
    const problems: string[] = [];
    for (const def of this.zones.values()) {
      problems.push(...validateSafeZoneDefinition(def));
      if (def.checkpointId !== undefined && !checkpointIds.includes(def.checkpointId)) {
        problems.push(`safe zone "${def.id}": checkpoint "${def.checkpointId}" is not registered`);
      }
    }
    return problems;
  }

  clear(): void {
    this.zones.clear();
  }
}
