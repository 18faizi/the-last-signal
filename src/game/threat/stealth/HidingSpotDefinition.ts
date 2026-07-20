/**
 * Authored hiding spot definitions (Milestone 0.9).
 *
 * Concealment is EXPLICIT DATA — the perception model reads these fields,
 * never mesh opacity or render state. Camera/collider positions are authored
 * per spot so the hiding transition can never clip geometry: the player's
 * collider is parked at `colliderPosition` (a safe, authored interior point)
 * while hidden, and the view is placed at `cameraPosition`.
 */
import type { Point3 } from '../../facility/FacilityZone';
import type { HidingSpotId } from '../ThreatId';

export type HidingSpotKind = 'equipment-cabinet' | 'locker' | 'under-desk' | 'dark-alcove';

export interface HidingSpotDefinition {
  readonly id: HidingSpotId;
  readonly kind: HidingSpotKind;
  readonly displayName: string;
  readonly zoneId: string;
  /** Where the player must stand to enter (interaction anchor). */
  readonly entryPosition: Point3;
  /** Authored safe collider position while hidden (no clipping). */
  readonly colliderPosition: Point3;
  /** Authored camera/view position while hidden. */
  readonly cameraPosition: Point3;
  /** Where the player is restored to on exit. */
  readonly exitPosition: Point3;
  /** View yaw while hidden (radians). */
  readonly facingYaw: number;
  /** Max look deviation from facingYaw while hidden (radians); 0 = fixed view. */
  readonly lookYawLimit: number;
  /** Concealment strength 0-1 fed into ExposureEvaluator. */
  readonly concealment: number;
  /** True: player is COMPLETELY hidden — visual detection is impossible. */
  readonly fullyHiding: boolean;
  /** True: a searching threat may inspect this spot (M1.0 hook; data only). */
  readonly inspectable: boolean;
  /** Interaction distance override for the "[E] HIDE" prompt. */
  readonly interactionDistance: number;
}

export function validateHidingSpotDefinition(def: HidingSpotDefinition): string[] {
  const problems: string[] = [];
  const prefix = `hiding spot "${def.id}"`;
  if (def.concealment < 0 || def.concealment > 1) {
    problems.push(`${prefix}: concealment must be within [0, 1]`);
  }
  if (def.fullyHiding && def.concealment < 1) {
    problems.push(`${prefix}: fullyHiding spots must declare concealment 1`);
  }
  if (def.interactionDistance <= 0) {
    problems.push(`${prefix}: interactionDistance must be positive`);
  }
  if (def.lookYawLimit < 0 || def.lookYawLimit > Math.PI) {
    problems.push(`${prefix}: lookYawLimit must be within [0, PI]`);
  }
  return problems;
}
