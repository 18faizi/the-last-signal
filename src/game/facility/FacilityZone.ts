/**
 * Typed zone definitions for the facility greybox scene.
 *
 * Zones are axis-aligned bounding boxes (AABB) in world space.  They drive
 * zone-discovery tracking and progression triggers.  No Babylon objects live
 * here — the integration layer converts player Vector3 positions to the plain
 * numeric form used by containsPoint.
 */

export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ZoneAabb {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
}

/** Returns true when the point lies strictly inside (or on the boundary of) the AABB. */
export function aabbContains(aabb: ZoneAabb, p: Point3): boolean {
  return (
    p.x >= aabb.minX &&
    p.x <= aabb.maxX &&
    p.y >= aabb.minY &&
    p.y <= aabb.maxY &&
    p.z >= aabb.minZ &&
    p.z <= aabb.maxZ
  );
}

export interface FacilityZoneDefinition {
  /** Unique zone id, e.g. 'fg-zone-courtyard'. */
  readonly id: string;
  /** Human-readable name for debug overlays. */
  readonly label: string;
  /** World-space AABB. */
  readonly aabb: ZoneAabb;
  /**
   * When true the zone is considered an "important" zone that contributes to
   * the progression metric displayed in the F3 overlay.
   */
  readonly isKeyZone?: boolean;
}
