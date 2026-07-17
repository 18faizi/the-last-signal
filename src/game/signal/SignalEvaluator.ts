/**
 * Pure, deterministic signal-quality evaluator.
 *
 * `evaluate()` is the ONLY function that turns (SignalDefinition,
 * ReceiverControls) into a ReceiverMetrics — SignalLockController and
 * DecodeController only ever consume its `overallQuality` output, never
 * recompute quality themselves. No Math.random, no Date.now, no Babylon/DOM
 * — identical inputs always produce an identical ReceiverMetrics object
 * (verified by signalEvaluator.test.ts's determinism test).
 *
 * ----------------------------------------------------------------------
 * Overall quality combination (documented per the milestone spec — this is
 * NOT a simple average):
 *
 *   overallQuality = channelGate × frequencyQuality × refinementQuality
 *
 *   channelGate       = 1 if the tuned channel matches the signal's
 *                        channel, else 0. A channel mismatch means there is
 *                        no carrier there at all, so nothing downstream can
 *                        compensate — this is a hard multiplicative gate,
 *                        not an averaged-in penalty.
 *   frequencyQuality   = smoothstep falloff of tuning error (see
 *                        frequencyQuality() below). Far enough off-target
 *                        and this is 0, which — being multiplicative — also
 *                        zeroes overallQuality regardless of how perfect
 *                        gain/filter/phase are.
 *   refinementQuality  = weighted blend of gain/filter/phase quality
 *                        (0.34/0.33/0.33). These three are genuinely
 *                        "refinements" once a carrier is present and
 *                        roughly tuned — no single one of them alone
 *                        should be able to fully sink or fully save the
 *                        signal, so they combine as a weighted average
 *                        rather than gating multiplicatively.
 *
 * This composition guarantees: (a) wrong channel ⇒ 0 regardless of other
 * controls being perfect; (b) grossly wrong frequency ⇒ 0 for the same
 * reason; (c) channel+frequency correct but gain/filter/phase all at their
 * worst ⇒ still capped well under any reasonable lock threshold, because
 * refinementQuality itself bottoms out near 0.
 * ----------------------------------------------------------------------
 */
import type { SignalDefinition } from './SignalDefinition';
import type { ReceiverControls } from './ReceiverControls';
import type { LimitingFactor, ReceiverMetrics } from './ReceiverMetrics';
import { clamp01, shortestAngleDelta, smoothstep01 } from './SignalChannel';

/**
 * Gaussian-like (smoothstep) falloff: 1 at zero error, easing down to 0 at
 * `captureRange`. `plateauFraction` widens the flat "1.0" region near the
 * target before falloff begins, so tiny jitter near-perfect tuning doesn't
 * cost quality.
 */
function falloffQuality(error: number, captureRange: number, plateauFraction: number): number {
  const absError = Math.abs(error);
  if (captureRange <= 0) return absError === 0 ? 1 : 0;
  if (absError >= captureRange) return 0;
  const plateauEdge = captureRange * plateauFraction;
  if (absError <= plateauEdge) return 1;
  const t = 1 - (absError - plateauEdge) / (captureRange - plateauEdge);
  return smoothstep01(t);
}

/** Frequency quality: smoothstep falloff to 0 at 3x tolerance, 1 within 20% of tolerance of exact. */
export function frequencyQuality(
  targetMHz: number,
  toleranceMHz: number,
  actualMHz: number,
): number {
  const error = actualMHz - targetMHz;
  return falloffQuality(error, Math.max(toleranceMHz, 1e-6) * 3, 0.2);
}

/**
 * Gain quality: a broad flat plateau across [min, max] (1.0 — no penalty
 * for being anywhere in the acceptable range), falling off over a fixed
 * 0.3-wide margin outside it in either direction — too low reads as a weak
 * signal, too high as amplified noise, both penalized identically.
 */
export function gainQuality(min: number, max: number, actual: number): number {
  if (actual >= min && actual <= max) return 1;
  const margin = 0.3;
  const dist = actual < min ? min - actual : actual - max;
  return smoothstep01(1 - dist / margin);
}

/** Filter quality: smoothstep falloff to 0 at 2.5x tolerance around the target. */
export function filterQuality(target: number, tolerance: number, actual: number): number {
  const error = actual - target;
  return falloffQuality(error, Math.max(tolerance, 1e-6) * 2.5, 0.2);
}

/**
 * Phase quality: circular distance via shortestAngleDelta so -180/+180 are
 * treated as identical, broad falloff to 0 at 2x tolerance.
 */
export function phaseQuality(
  targetDeg: number,
  toleranceDeg: number,
  actualDeg: number,
): { error: number; quality: number } {
  const error = shortestAngleDelta(actualDeg, targetDeg);
  const quality = falloffQuality(error, Math.max(toleranceDeg, 1e-6) * 2, 0.15);
  return { error, quality };
}

function identifyLimitingFactor(
  channelMatch: boolean,
  freqQ: number,
  gainQ: number,
  filterQ: number,
  phaseQ: number,
): LimitingFactor {
  if (!channelMatch) return 'channel';
  if (freqQ < 0.5) return 'frequency';
  const candidates: Array<[LimitingFactor, number]> = [
    ['gain', gainQ],
    ['filter', filterQ],
    ['phase', phaseQ],
  ];
  candidates.sort((a, b) => a[1] - b[1]);
  const worst = candidates[0] ?? ['none', 1];
  const [worstFactor, worstQuality] = worst;
  // A gap under 0.8 is worth surfacing to the player as "the" issue; above
  // that everything is close enough that no single control dominates.
  return worstQuality < 0.8 ? worstFactor : 'none';
}

export function evaluate(signal: SignalDefinition, controls: ReceiverControls): ReceiverMetrics {
  const channelMatch = controls.channel === signal.channel;

  const freqError = controls.frequencyMHz - signal.targetFrequencyMHz;
  const freqQ = frequencyQuality(
    signal.targetFrequencyMHz,
    signal.frequencyToleranceMHz,
    controls.frequencyMHz,
  );

  const gainQ = gainQuality(signal.targetGainMin, signal.targetGainMax, controls.gain);

  const filterQ = filterQuality(signal.targetFilter, signal.filterTolerance, controls.filter);

  const { error: phaseError, quality: phaseQ } = phaseQuality(
    signal.targetPhaseDeg,
    signal.phaseToleranceDeg,
    controls.phaseDeg,
  );

  const channelGate = channelMatch ? 1 : 0;
  const refinementQuality = clamp01(gainQ * 0.34 + filterQ * 0.33 + phaseQ * 0.33);
  const overallQuality = clamp01(channelGate * freqQ * refinementQuality);

  const effectiveSignalStrength = clamp01(signal.baseSignalStrength * channelGate * freqQ);
  const noiseGainFactor = 0.5 + controls.gain; // 0.5..1.5
  const noiseFilterFactor = 1.5 - filterQ; // 0.5..1.5 (poor filter → noisier)
  const amplifiedNoise = Math.max(0, signal.baseNoiseLevel * noiseGainFactor * noiseFilterFactor);
  const signalToNoiseQuality = clamp01(
    effectiveSignalStrength / (effectiveSignalStrength + amplifiedNoise + 1e-6),
  );

  const limitingFactor = identifyLimitingFactor(channelMatch, freqQ, gainQ, filterQ, phaseQ);

  return {
    channelMatch,
    frequencyErrorMHz: freqError,
    frequencyQuality: freqQ,
    gainQuality: gainQ,
    filterQuality: filterQ,
    phaseErrorDeg: phaseError,
    phaseQuality: phaseQ,
    effectiveSignalStrength,
    amplifiedNoise,
    signalToNoiseQuality,
    overallQuality,
    limitingFactor,
  };
}
