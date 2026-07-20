/**
 * Normalized 0-1 player-exposure approximation (Milestone 0.9).
 *
 * Restrained by design: no lux physics, no per-light sampling. Exposure is
 * a small authored combination of the states the game already tracks —
 * whether the zone the player stands in is on a powered lighting circuit,
 * whether only emergency lighting is up, the player's stance, and explicit
 * hiding/cover concealment data. Powered zones read as HIGHER exposure;
 * unpowered darkness is concealment. Pure and deterministic.
 */
export interface ExposureInput {
  /** True when the player's current zone is lit by an energized circuit. */
  readonly zonePowered: boolean;
  /** True when only the emergency/battery lighting is active in the zone. */
  readonly emergencyLightingOnly: boolean;
  readonly crouched: boolean;
  /**
   * Concealment strength 0-1 of the hiding spot the player occupies
   * (0 = not hiding). Partial concealment scales exposure down; fully-hiding
   * spots are handled upstream by VisionInput.playerFullyHidden — this input
   * only shapes the partial case.
   */
  readonly hidingConcealment: number;
  /** True when the player stands in an authored dark-cover volume. */
  readonly inDarkCover: boolean;
}

export const EXPOSURE_LIT = 1.0;
export const EXPOSURE_EMERGENCY = 0.55;
export const EXPOSURE_DARK = 0.3;
export const EXPOSURE_DARK_COVER = 0.12;
export const CROUCH_EXPOSURE_FACTOR = 0.75;

export function evaluateExposure(input: ExposureInput): number {
  let base: number;
  if (input.zonePowered) {
    base = EXPOSURE_LIT;
  } else if (input.emergencyLightingOnly) {
    base = EXPOSURE_EMERGENCY;
  } else {
    base = EXPOSURE_DARK;
  }
  if (input.inDarkCover) {
    base = Math.min(base, EXPOSURE_DARK_COVER);
  }
  if (input.crouched) {
    base *= CROUCH_EXPOSURE_FACTOR;
  }
  const concealment = Math.min(Math.max(input.hidingConcealment, 0), 1);
  base *= 1 - concealment;
  return Math.min(Math.max(base, 0), 1);
}
