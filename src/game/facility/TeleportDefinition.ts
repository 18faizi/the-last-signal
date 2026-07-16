/**
 * Development teleport positions for the facility greybox scene.
 *
 * Teleports are authored world positions accessible from the F8 teleport menu.
 * They exist only in development builds.  Babylon-free.
 */
import type { Point3 } from './FacilityZone';

export interface TeleportDefinition {
  /** Unique identifier, e.g. 'fg-tp-courtyard'. */
  readonly id: string;
  /** Human-readable label shown in the teleport menu. */
  readonly label: string;
  /** World position to teleport the player to. */
  readonly position: Point3;
  /** Spawn yaw in radians (player facing direction). */
  readonly yaw: number;
}

/** Returns human-readable problems; empty array means valid. */
export function validateTeleportDefinition(def: TeleportDefinition): string[] {
  const problems: string[] = [];
  if (def.id.trim() === '') {
    problems.push('Teleport id must not be empty');
  }
  if (def.label.trim() === '') {
    problems.push(`Teleport '${def.id}' has an empty label`);
  }
  for (const axis of ['x', 'y', 'z'] as const) {
    if (!Number.isFinite(def.position[axis])) {
      problems.push(`Teleport '${def.id}' position.${axis} is not finite`);
    }
  }
  if (!Number.isFinite(def.yaw)) {
    problems.push(`Teleport '${def.id}' yaw is not finite`);
  }
  return problems;
}
