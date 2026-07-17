/**
 * Pure composition evaluator: combines M0.7's SignalEvaluator output
 * (ReceiverMetrics, UNCHANGED — see src/game/signal/SignalEvaluator.ts,
 * never modified by this milestone) with M0.8's AntennaMetrics + waveguide
 * continuity + rooftop power availability into a single derived
 * "source-analysis quality ceiling" — the quality gate used ONLY for
 * bearing sample collection/comparison readiness, never for decoding.
 *
 * Two DISTINCT quality concepts, never conflated:
 *   1. Receiver DECODE quality (ReceiverMetrics.overallQuality, M0.7,
 *      unchanged) — decodes `first_anomalous_transmission`. Once decoded,
 *      ReceiverRuntimeState's decoded flag is a permanent, one-shot fact
 *      (see ReceiverRuntimeState.ts) that nothing in this file can reset.
 *   2. Source-analysis quality (this file, M0.8) — gates whether a sample
 *      collected right now is trustworthy enough to accept. Requires the
 *      transmission to ALREADY be decoded (`transmissionDecoded === true`)
 *      — if not, the ceiling is hard-zeroed regardless of every other
 *      factor, because source analysis only makes sense once there is a
 *      known transmission to trace.
 *
 * analysisQualityCeiling = receiverTuningQuality × antennaAlignmentQuality
 *                           × waveguideContinuity × powerAvailability
 *                           (0 outright if transmissionDecoded is false)
 *
 *   receiverTuningQuality  = ReceiverMetrics.overallQuality AS-IS — reused
 *                            directly, not recomputed. The player does NOT
 *                            need to repeat the 5-second decode process
 *                            every time they touch the rooftop array; if
 *                            receiver tuning has since drifted poor, this
 *                            term falls and readiness falls with it, but
 *                            the decoded FACT (ReceiverRuntimeState) is
 *                            untouched.
 *   antennaAlignmentQuality = AntennaMetrics.alignmentQuality — the PURE
 *                            axis-only alignment term (see
 *                            AntennaEvaluator.ts's doc comment for why this
 *                            is `alignmentQuality`, not `overallQuality`:
 *                            `overallQuality` already folds in that
 *                            evaluation's OWN power/waveguide gates, and
 *                            using it here as well would double-gate the
 *                            same two factors this function already applies
 *                            from its own live `waveguideQuality`/
 *                            `rooftopPowered` inputs).
 *   waveguideContinuity     = input.waveguideQuality, live from
 *                            WaveguideController — NOT read back out of
 *                            antennaMetrics (see above).
 *   powerAvailability       = input.rooftopPowered ? 1 : 0 — likewise live,
 *                            not re-derived from antennaMetrics.
 */
import type { ReceiverMetrics } from '../signal/ReceiverMetrics';
import type { AntennaMetrics } from '../antenna/AntennaMetrics';
import { clamp01 } from '../antenna/AntennaMath';

export interface SourceAnalysisQualityInput {
  readonly receiverMetrics: ReceiverMetrics;
  readonly antennaMetrics: AntennaMetrics;
  readonly waveguideQuality: number;
  readonly rooftopPowered: boolean;
  readonly transmissionDecoded: boolean;
}

/** 0-1 readiness ceiling for source-analysis sample collection/comparison. */
export function evaluateAnalysisQualityCeiling(input: SourceAnalysisQualityInput): number {
  if (!input.transmissionDecoded) return 0;
  const receiverTuningQuality = clamp01(input.receiverMetrics.overallQuality);
  const antennaAlignmentQuality = clamp01(input.antennaMetrics.alignmentQuality);
  const waveguideContinuity = clamp01(input.waveguideQuality);
  const powerAvailability = input.rooftopPowered ? 1 : 0;
  return clamp01(
    receiverTuningQuality * antennaAlignmentQuality * waveguideContinuity * powerAvailability,
  );
}
