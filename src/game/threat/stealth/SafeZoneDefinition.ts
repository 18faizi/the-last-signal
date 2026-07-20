/**
 * Typed safe zone definitions (Milestone 0.9).
 *
 * Safe zones are authored AABB volumes the threat refuses to enter. A
 * pursued player reaching one resolves (or de-escalates) the encounter;
 * detection decays while inside when flagged. Plain data, validated at
 * scene creation.
 */
import type { ZoneAabb } from '../../facility/FacilityZone';
import type { EncounterId, SafeZoneId } from '../ThreatId';

export interface SafeZoneDefinition {
  readonly id: SafeZoneId;
  readonly displayName: string;
  readonly aabb: ZoneAabb;
  /** Encounters that resolve when the pursued player reaches this zone. */
  readonly resolvesEncounterIds: readonly EncounterId[];
  /** Always false in M0.9 — the threat never enters safe zones. */
  readonly threatEnterable: boolean;
  /** True: suspicion/detection decay while the player is inside. */
  readonly detectionDecays: boolean;
  /** Checkpoint linked to this zone (activated on first entry), if any. */
  readonly checkpointId?: string;
}

export function validateSafeZoneDefinition(def: SafeZoneDefinition): string[] {
  const problems: string[] = [];
  const prefix = `safe zone "${def.id}"`;
  const a = def.aabb;
  if (!(a.minX < a.maxX && a.minY < a.maxY && a.minZ < a.maxZ)) {
    problems.push(`${prefix}: AABB min must be strictly below max on every axis`);
  }
  if (def.threatEnterable) {
    problems.push(`${prefix}: threatEnterable must be false in Milestone 0.9`);
  }
  return problems;
}
