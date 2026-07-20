/**
 * Authored manifestation definitions (Milestone 0.9).
 *
 * ARCHITECTURE DECISION: manifestations are SEPARATE from the active threat
 * actor. A manifestation is a staged, non-interactive presentation beat —
 * a distant silhouette, a static observer, a presence crossing a corridor,
 * or an indirect mechanical disturbance. It never perceives, never pursues,
 * and never becomes the actor; the actor is ThreatController's own pooled
 * mesh, driven by its state machine. Both share ONE pooled silhouette mesh
 * assembly per role (hide/show/reposition — never rebuilt per event).
 */
import type { Point3 } from '../../facility/FacilityZone';
import type { ManifestationId } from '../ThreatId';

export type ManifestationType =
  'distant-silhouette' | 'static-observer' | 'moving-presence' | 'mechanical-disturbance';

export interface ManifestationDefinition {
  readonly id: ManifestationId;
  readonly type: ManifestationType;
  readonly position: Point3;
  /** Facing yaw in radians. */
  readonly facingYaw: number;
  /** Seconds the manifestation stays before expiring on its own. */
  readonly durationSeconds: number;
  /** moving-presence only: end position it translates toward. */
  readonly moveTo?: Point3;
  /** moving-presence only: translation speed (m/s). */
  readonly moveSpeed?: number;
  /** True: ends early the moment the scene reports the sightline obstructed. */
  readonly endsWhenObstructed?: boolean;
  /**
   * mechanical-disturbance only: which placeholder effect the scene binding
   * performs (door nudge, light change, phone/indicator) — typed, no scripts.
   */
  readonly disturbance?: 'door' | 'light' | 'phone-indicator';
  readonly disturbanceTargetId?: string;
}
