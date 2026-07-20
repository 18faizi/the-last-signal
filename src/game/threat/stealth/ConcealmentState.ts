/**
 * Explicit concealment data (Milestone 0.9).
 *
 * The perception model consumes THIS record — never mesh opacity, render
 * flags or camera state. Produced by HidingController from the occupied
 * spot's authored definition.
 */
import type { HidingSpotId } from '../ThreatId';

export interface ConcealmentState {
  /** True while the player occupies any hiding spot. */
  readonly hidden: boolean;
  readonly spotId: HidingSpotId | null;
  /** 0-1 concealment strength (0 when not hiding). */
  readonly concealment: number;
  /** True only inside a fully-hiding spot: visual detection is impossible. */
  readonly fullyHidden: boolean;
}

export const NOT_CONCEALED: ConcealmentState = {
  hidden: false,
  spotId: null,
  concealment: 0,
  fullyHidden: false,
};
