/**
 * Pure, deterministic bearing estimator.
 *
 * `evaluateBearing()` turns (array role, current alignment quality, current
 * mechanical azimuth/elevation) into a SignalBearing. No Math.random, no
 * Date.now, no Babylon/DOM — identical inputs always produce an identical
 * SignalBearing. The relationship between each array's ROLE and its bearing
 * characteristics is a hardcoded, AUTHORED table (BEARING_PROFILES below),
 * not randomized — this is what makes the milestone's "no valid external
 * bearing" reveal reproducible and testable rather than a dice roll.
 *
 * Authored profiles (spec §11-§12):
 *   ExternalCandidate (North Dish)   – wide capture, easy to align, but its
 *     bearing reading is inherently WEAK: even at perfect alignment its
 *     confidence never clears the external-source-valid threshold. Models a
 *     dish that's "in the right ballpark" but never conclusive.
 *   RelayCandidate (East Relay Dish) – narrow tolerance, hard to align, and
 *     when aligned produces a STRONG but UNSTABLE reading — high confidence,
 *     low stability, classified 'Reflected' rather than 'External' (reads
 *     like multipath/relay bounce, not a clean line-of-sight source).
 *   DiagnosticLoop (Tower Diagnostic Loop) – short-range, near-zero modeled
 *     path delay — there's essentially no propagation time, which is only
 *     physically consistent with a LOCAL source. High confidence AND high
 *     stability, but classified 'Local' with a high localCouplingLikelihood.
 *
 * None of the three profiles ever satisfies `externalSourceValid` at any
 * alignment quality — this is intentional and is exactly the deterministic
 * basis for the "the anomalous transmission has no valid external bearing"
 * reveal: it is not a probability that happens to come up empty, it is an
 * authored fact about the three arrays' characteristics.
 */
import type { AntennaArrayId } from '../antenna/AntennaArrayId';
import type { AntennaArrayRole } from '../antenna/AntennaArrayDefinition';
import type { SignalBearing, SourceCandidateCategory } from './SignalBearing';

interface BearingProfile {
  readonly baseConfidence: number;
  readonly baseStability: number;
  readonly localCouplingLikelihood: number;
  readonly pathDelayMs: number;
  readonly category: SourceCandidateCategory;
  /** Minimum confidence AND stability required for externalSourceValid, even if category is 'External'. */
  readonly externalValidConfidenceFloor: number;
  readonly externalValidStabilityFloor: number;
}

const BEARING_PROFILES: Readonly<Record<AntennaArrayRole, BearingProfile>> = {
  ExternalCandidate: {
    baseConfidence: 0.45,
    baseStability: 0.6,
    localCouplingLikelihood: 0.15,
    pathDelayMs: 38,
    category: 'External',
    externalValidConfidenceFloor: 0.6,
    externalValidStabilityFloor: 0.6,
  },
  RelayCandidate: {
    baseConfidence: 0.8,
    baseStability: 0.25,
    localCouplingLikelihood: 0.35,
    pathDelayMs: 22,
    category: 'Reflected',
    externalValidConfidenceFloor: 0.6,
    externalValidStabilityFloor: 0.6,
  },
  DiagnosticLoop: {
    baseConfidence: 0.9,
    baseStability: 0.9,
    localCouplingLikelihood: 0.95,
    pathDelayMs: 0.4,
    category: 'Local',
    externalValidConfidenceFloor: 0.6,
    externalValidStabilityFloor: 0.6,
  },
};

export function evaluateBearing(
  _arrayId: AntennaArrayId,
  role: AntennaArrayRole,
  alignmentQuality: number,
  mechanicalAzimuthDeg: number,
  mechanicalElevationDeg: number,
): SignalBearing {
  const profile = BEARING_PROFILES[role];
  const quality = Math.min(1, Math.max(0, alignmentQuality));

  const confidence = profile.baseConfidence * quality;
  // Stability is a property of the array's own path characteristics, only
  // lightly scaled by alignment (a badly-aligned reading is a little less
  // stable too, but stability is mostly about the PATH, not the pointing).
  const stability = profile.baseStability * (0.5 + 0.5 * quality);

  const externalSourceValid =
    profile.category === 'External' &&
    confidence >= profile.externalValidConfidenceFloor &&
    stability >= profile.externalValidStabilityFloor;

  return {
    estimatedAzimuthDeg: mechanicalAzimuthDeg,
    estimatedElevationDeg: mechanicalElevationDeg,
    confidence,
    stability,
    externalSourceValid,
    localCouplingLikelihood: profile.localCouplingLikelihood * (0.5 + 0.5 * quality),
    pathDelayMs: profile.pathDelayMs,
    category: profile.category,
  };
}
