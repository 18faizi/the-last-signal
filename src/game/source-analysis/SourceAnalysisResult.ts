import type { SourceCandidate } from './SourceCandidate';
import type { SourceCandidateCategory } from './SignalBearing';

/**
 * Final classification produced once 3 samples have been compared. Pure,
 * deterministic given the 3 samples' bearings (see BearingEvaluator.ts) —
 * no Math.random. Provisional/narrative text lives in the UI layer
 * (src/ui/antenna/SourceAnalysisView.ts); this type carries only structured
 * facts + short machine-readable explanation tags.
 */
export interface SourceAnalysisResult {
  readonly contradictionDetected: boolean;
  readonly localLoopConfirmed: boolean;
  readonly finalCategory: SourceCandidateCategory;
  readonly explanationTags: readonly string[];
  readonly sampleCount: number;
}

/**
 * Pure comparison function: given the collected samples, determines whether
 * any produced a valid external bearing, whether the diagnostic loop
 * confirms local coupling, and the resulting final classification.
 * Deterministic — the same 3 samples always produce the same result.
 */
export function evaluateSourceAnalysisResult(
  samples: readonly SourceCandidate[],
): SourceAnalysisResult {
  const anyExternalValid = samples.some((s) => s.bearing.externalSourceValid);
  const localLoopSample = samples
    .filter((s) => s.bearing.category === 'Local')
    .sort((a, b) => b.bearing.localCouplingLikelihood - a.bearing.localCouplingLikelihood)[0];
  const localLoopConfirmed =
    localLoopSample !== undefined &&
    localLoopSample.bearing.localCouplingLikelihood >= 0.5 &&
    localLoopSample.bearing.pathDelayMs < 2;

  const contradictionDetected = !anyExternalValid && samples.length >= 3;

  const tags: string[] = [];
  if (contradictionDetected) tags.push('no-valid-external-bearing');
  if (localLoopConfirmed) tags.push('return-path-resolves-to-local-facility-infrastructure');
  if (contradictionDetected && localLoopConfirmed) tags.push('source-classification-local-loop');

  const finalCategory: SourceCandidateCategory =
    contradictionDetected && localLoopConfirmed ? 'Local' : 'Indeterminate';

  return {
    contradictionDetected,
    localLoopConfirmed,
    finalCategory,
    explanationTags: tags,
    sampleCount: samples.length,
  };
}
