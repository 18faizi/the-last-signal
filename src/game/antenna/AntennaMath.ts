/**
 * Shared pure math helpers for the antenna domain.
 *
 * Deliberately self-contained (not imported from src/game/signal/SignalChannel.ts)
 * even though the shapes overlap — the antenna domain must not take on a
 * dependency edge toward the signal domain (SignalEvaluator's contract is
 * that it stays authoritative for signal quality and knows nothing about
 * antenna/waveguide concepts; keeping the antenna math local means that
 * boundary can never accidentally be crossed in the other direction either).
 */

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Smoothstep(0,1,t) — eased falloff curve, identical shape to SignalChannel's. */
export function smoothstep01(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/**
 * Normalizes an azimuth-style angle to (-180, 180].
 */
export function normalizeAngle180(deg: number): number {
  let p = deg % 360;
  if (p > 180) p -= 360;
  if (p <= -180) p += 360;
  return p;
}

/**
 * Signed shortest angular distance from `b` to `a` on a circular ±180°
 * domain, handling wraparound correctly — e.g.
 * shortestAngleDelta(179, -179) === -2, NOT 358 or -358.
 * Result is in (-180, 180].
 *
 * This is the CIRCULAR distance function required for azimuth math (spec
 * constraint: azimuth must use circular wraparound, never linear
 * subtraction). Elevation deliberately does NOT use this — see
 * AntennaEvaluator.ts's elevationQuality(), which clamps/subtracts linearly
 * because elevation has no wraparound (0-75°, a hard physical limit, not a
 * circle).
 */
export function shortestAngleDelta(a: number, b: number): number {
  let diff = (a - b) % 360;
  if (diff > 180) diff -= 360;
  if (diff <= -180) diff += 360;
  return diff;
}

/**
 * Smoothstep falloff: 1 at zero error, easing to 0 at `captureRange`.
 * `plateauFraction` widens the flat "1.0" region near the target so tiny
 * jitter near-perfect alignment doesn't cost quality — mirrors
 * SignalEvaluator's falloffQuality() shape exactly (documented
 * independently per the antenna domain's own decoupling requirement).
 */
export function falloffQuality(
  error: number,
  captureRange: number,
  plateauFraction: number,
): number {
  const absError = Math.abs(error);
  if (captureRange <= 0) return absError === 0 ? 1 : 0;
  if (absError >= captureRange) return 0;
  const plateauEdge = captureRange * plateauFraction;
  if (absError <= plateauEdge) return 1;
  const t = 1 - (absError - plateauEdge) / (captureRange - plateauEdge);
  return smoothstep01(t);
}
