/**
 * Shared channel/frequency range constants for the receiver puzzle.
 *
 * Kept as one small cohesive module (per the milestone spec's "avoid
 * excessive one-type files" guidance) rather than splitting each constant
 * into its own file — nothing here has enough independent behavior to earn
 * a dedicated module.
 */
export const MIN_CHANNEL = 1;
export const MAX_CHANNEL = 6;

export const MIN_FREQUENCY_MHZ = 80;
export const MAX_FREQUENCY_MHZ = 150;

export function clampChannel(channel: number): number {
  return Math.min(MAX_CHANNEL, Math.max(MIN_CHANNEL, Math.round(channel)));
}

export function clampFrequency(frequencyMHz: number): number {
  return Math.min(MAX_FREQUENCY_MHZ, Math.max(MIN_FREQUENCY_MHZ, frequencyMHz));
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function clampPhase(phaseDeg: number): number {
  // Normalize to (-180, 180].
  let p = phaseDeg % 360;
  if (p > 180) p -= 360;
  if (p <= -180) p += 360;
  return p;
}

/**
 * Signed shortest angular distance from `b` to `a`, handling the -180/+180
 * wraparound correctly (e.g. shortestAngleDelta(179, -179) === -2, not 358).
 * Result is in (-180, 180].
 */
export function shortestAngleDelta(a: number, b: number): number {
  let diff = (a - b) % 360;
  if (diff > 180) diff -= 360;
  if (diff <= -180) diff += 360;
  return diff;
}

/** Smoothstep(0,1,t) — used throughout SignalEvaluator for eased falloff curves. */
export function smoothstep01(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}
