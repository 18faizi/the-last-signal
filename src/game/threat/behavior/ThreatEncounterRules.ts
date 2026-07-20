/**
 * Encounter capture / failure rules (Milestone 0.9).
 *
 * There is no combat, health, damage or death: the only failure condition
 * is the capture boundary — the threat closing within an authored radius of
 * a player who is neither hidden nor inside a safe zone. Failure resolves
 * as: brief fade, teleport to the encounter checkpoint, and a reset of ONLY
 * the encounter/threat-local state described by EncounterResetPlan.
 * Inventory, power, signal, antenna and major door progression are
 * explicitly preserved (the plan enumerates what IS reset; everything else
 * is untouched by construction).
 */
import type { Point3 } from '../../facility/FacilityZone';
import type { EncounterId, ThreatNodeId } from '../ThreatId';

export interface CaptureInput {
  readonly threatPosition: Point3;
  readonly playerPosition: Point3;
  readonly captureRadius: number;
  readonly playerFullyHidden: boolean;
  readonly playerInSafeZone: boolean;
}

/** Pure capture test — a hidden or safe player can never be captured. */
export function isPlayerCaptured(input: CaptureInput): boolean {
  if (input.playerFullyHidden || input.playerInSafeZone) return false;
  const dx = input.threatPosition.x - input.playerPosition.x;
  const dy = input.threatPosition.y - input.playerPosition.y;
  const dz = input.threatPosition.z - input.playerPosition.z;
  return Math.hypot(dx, dy, dz) <= input.captureRadius;
}

/**
 * What an encounter failure resets. The scene-side executor walks exactly
 * this list — nothing else — so the "preserves all major progression"
 * guarantee is structural, not incidental.
 */
export interface EncounterResetPlan {
  readonly encounterId: EncounterId;
  /** Checkpoint the player respawns at. */
  readonly checkpointId: string;
  /** Node the threat actor is re-placed at (while hidden by the fade). */
  readonly threatResetNodeId: ThreatNodeId;
  /** Doors restored to their authored encounter state. */
  readonly doorResets: ReadonlyArray<{ doorId: string; open: boolean }>;
  /** Dev-facing message shown after the fade. */
  readonly devMessage: string;
}
