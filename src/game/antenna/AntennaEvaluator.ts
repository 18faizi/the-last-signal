/**
 * Pure, deterministic antenna-alignment quality evaluator.
 *
 * `evaluate()` is the ONLY function that turns (AntennaArrayDefinition,
 * AntennaEvaluationInput) into AntennaMetrics — AntennaController only ever
 * consumes its output, never recomputes quality itself. No Math.random, no
 * Date.now, no Babylon/DOM — identical inputs always produce an identical
 * AntennaMetrics object (verified by antennaEvaluator.test.ts's determinism
 * test). Deliberately self-contained: does not import from src/game/signal/
 * (see AntennaMath.ts's doc comment) so this evaluator can never gain
 * knowledge of Babylon objects or the antenna controllers that consume it —
 * mirroring SignalEvaluator's own purity contract, independently maintained.
 *
 * ----------------------------------------------------------------------
 * Axis quality models (spec-mandated, each documented independently):
 *
 *   Azimuth     – CIRCULAR wraparound math via shortestAngleDelta (±180°
 *                 domain). 179° and -179° are 2° apart, not 358° apart.
 *                 Quality is 1.0 within `captureWidthDeg / 2` of the target
 *                 (a wider captureWidthDeg = a more forgiving array, per
 *                 spec §10's "North Dish: wide capture, easier detection"),
 *                 falling off via smoothstep to 0 at
 *                 captureWidthDeg/2 + azimuthToleranceDeg*2.
 *
 *   Elevation   – LINEAR, clamped, no wraparound (elevation has a hard
 *                 physical limit — a dish cannot point through the ground or
 *                 flip past vertical). Quality is a smoothstep falloff
 *                 around the target over elevationToleranceDeg*2.5, and is
 *                 forced to 0 outside [minElevationDeg, maxElevationDeg]
 *                 ("below-range invalid").
 *
 *   Polarization – ONE documented model: linear-polarization angle
 *                 normalized to (-90°, 90°], with error computed on a
 *                 180°-PERIODIC domain (shortestPolarizationDelta) because a
 *                 linear polarization angle and its 180°-rotated equivalent
 *                 describe the identical physical orientation (0° ≡ 180° ≡
 *                 -180°, 45° ≡ -135°, 90° ≡ -90°). Quality falls off via
 *                 smoothstep around the shortest such error over
 *                 polarizationToleranceDeg*2.5.
 *
 * Overall quality combination (mirrors SignalEvaluator's documented
 * multiplicative-gate philosophy, independently authored — NOT a simple
 * average):
 *
 *   alignmentQuality = arrayGate × mechanicalReadiness
 *                       × azimuthQuality × elevationQuality × polarizationQuality,
 *                       capped at definition.maxQuality.
 *
 *     arrayGate          = 1 only when this evaluation's activeArrayId
 *                           matches the definition being evaluated — an
 *                           array that isn't the one currently selected/fed
 *                           into the chain contributes nothing, regardless
 *                           of how well its dish happens to be pointed.
 *     mechanicalReadiness = 0 mid-transit, 1 once settled — a dish sweeping
 *                           past the correct heading on its way elsewhere
 *                           must not register as aligned.
 *     azimuth/elevation/polarizationQuality combine multiplicatively (not
 *                           weighted-average like SignalEvaluator's
 *                           gain/filter/phase) because alignment is a
 *                           genuinely 3-axis physical constraint: being
 *                           perfect on two axes and wildly wrong on the
 *                           third means the dish is NOT pointed at the
 *                           source, full stop — there is no "refinement"
 *                           story here the way there is for a receiver's
 *                           gain knob.
 *
 *   overallQuality = clamp01(alignmentQuality × powerGate × waveguideQuality),
 *                     where powerGate = input.powered ? 1 : 0.
 *
 *     `alignmentQuality` is exposed separately (not just folded into
 *     `overallQuality`) specifically so the Phase-4 receiver-composition
 *     evaluator (src/game/source-analysis/AnalysisQualityEvaluator.ts) can
 *     apply its OWN live power/waveguide gates without double-counting this
 *     evaluation's — `overallQuality` (fully gated) is what
 *     AntennaController uses internally to derive AntennaControlState's
 *     Aligned/AlignedCandidate transitions, since a dish literally cannot be
 *     "Aligned" in any useful sense while unpowered or waveguide-disconnected.
 * ----------------------------------------------------------------------
 */
import type { AntennaArrayDefinition } from './AntennaArrayDefinition';
import type { AntennaArrayId } from './AntennaArrayId';
import type { AntennaMechanicalState } from './AntennaMechanicalState';
import type { AntennaLimitingFactor, AntennaMetrics } from './AntennaMetrics';
import { clamp01, falloffQuality, shortestAngleDelta } from './AntennaMath';

export interface AntennaEvaluationInput {
  /** The array currently selected/feeding the receiver+source-analysis chain. */
  readonly activeArrayId: AntennaArrayId;
  readonly mechanical: AntennaMechanicalState;
  /** 0-1 waveguide route continuity for this array's path (from WaveguideController). */
  readonly waveguideQuality: number;
  readonly powered: boolean;
}

/** Normalizes a polarization-style angle to (-90°, 90°] (180°-periodic domain). */
export function normalizePolarization90(deg: number): number {
  let p = deg % 180;
  if (p > 90) p -= 180;
  if (p <= -90) p += 180;
  return p;
}

/**
 * Signed shortest distance from `b` to `a` on a 180°-PERIODIC domain — used
 * only for polarization, never azimuth (which is 360°-periodic). Result is
 * in (-90, 90]. E.g. shortestPolarizationDelta(90, -90) === 0 (equivalent
 * orientations), shortestPolarizationDelta(89, -89) === 2 (not 178).
 */
export function shortestPolarizationDelta(a: number, b: number): number {
  let diff = (a - b) % 180;
  if (diff > 90) diff -= 180;
  if (diff <= -90) diff += 180;
  return diff;
}

export function azimuthQuality(
  targetDeg: number,
  toleranceDeg: number,
  captureWidthDeg: number,
  actualDeg: number,
): { error: number; quality: number } {
  const error = shortestAngleDelta(actualDeg, targetDeg);
  const halfPlateau = Math.max(captureWidthDeg, 0) / 2;
  const captureRange = halfPlateau + Math.max(toleranceDeg, 1e-6) * 2;
  const plateauFraction = captureRange > 0 ? halfPlateau / captureRange : 0;
  const quality = falloffQuality(error, captureRange, plateauFraction);
  return { error, quality };
}

export function elevationQuality(
  targetDeg: number,
  toleranceDeg: number,
  minDeg: number,
  maxDeg: number,
  actualDeg: number,
): { error: number; quality: number } {
  const error = actualDeg - targetDeg;
  if (actualDeg < minDeg || actualDeg > maxDeg) {
    return { error, quality: 0 };
  }
  const quality = falloffQuality(error, Math.max(toleranceDeg, 1e-6) * 2.5, 0.2);
  return { error, quality };
}

export function polarizationQuality(
  targetDeg: number,
  toleranceDeg: number,
  actualDeg: number,
): { error: number; quality: number } {
  const normalizedActual = normalizePolarization90(actualDeg);
  const normalizedTarget = normalizePolarization90(targetDeg);
  const error = shortestPolarizationDelta(normalizedActual, normalizedTarget);
  const quality = falloffQuality(error, Math.max(toleranceDeg, 1e-6) * 2.5, 0.2);
  return { error, quality };
}

function identifyLimitingFactor(
  arrayMatch: boolean,
  powered: boolean,
  azQ: number,
  elQ: number,
  polQ: number,
): AntennaLimitingFactor {
  if (!arrayMatch) return 'array';
  if (!powered) return 'power';
  const candidates: Array<[AntennaLimitingFactor, number]> = [
    ['azimuth', azQ],
    ['elevation', elQ],
    ['polarization', polQ],
  ];
  candidates.sort((a, b) => a[1] - b[1]);
  const worst = candidates[0] ?? ['none', 1];
  const [worstFactor, worstQuality] = worst;
  return worstQuality < 0.8 ? worstFactor : 'none';
}

export function evaluate(
  definition: AntennaArrayDefinition,
  input: AntennaEvaluationInput,
): AntennaMetrics {
  const arrayMatch = input.activeArrayId === definition.id;
  const arrayGate = arrayMatch ? 1 : 0;

  const { error: azError, quality: azQ } = azimuthQuality(
    definition.targetAzimuthDeg,
    definition.azimuthToleranceDeg,
    definition.captureWidthDeg,
    input.mechanical.currentAzimuthDeg,
  );
  const { error: elError, quality: elQ } = elevationQuality(
    definition.targetElevationDeg,
    definition.elevationToleranceDeg,
    definition.minElevationDeg,
    definition.maxElevationDeg,
    input.mechanical.currentElevationDeg,
  );
  const { error: polError, quality: polQ } = polarizationQuality(
    definition.targetPolarizationDeg,
    definition.polarizationToleranceDeg,
    input.mechanical.currentPolarizationDeg,
  );

  const isMidTransit =
    input.mechanical.targetAzimuthDeg !== null ||
    input.mechanical.targetElevationDeg !== null ||
    input.mechanical.targetPolarizationDeg !== null;
  const mechanicalReadiness = isMidTransit ? 0 : 1;

  const rawAlignment = arrayGate * mechanicalReadiness * azQ * elQ * polQ;
  const alignmentQuality = Math.min(clamp01(rawAlignment), definition.maxQuality);

  const powerGate = input.powered ? 1 : 0;
  const waveguideQuality = clamp01(input.waveguideQuality);
  const overallQuality = clamp01(alignmentQuality * powerGate * waveguideQuality);

  const limitingFactor = identifyLimitingFactor(arrayMatch, input.powered, azQ, elQ, polQ);

  return {
    arrayMatch,
    azimuthErrorDeg: azError,
    azimuthQuality: azQ,
    elevationErrorDeg: elError,
    elevationQuality: elQ,
    polarizationErrorDeg: polError,
    polarizationQuality: polQ,
    mechanicalReadiness,
    waveguideContinuity: waveguideQuality,
    powerAvailability: powerGate,
    alignmentQuality,
    overallQuality,
    limitingFactor,
  };
}
