/**
 * Pure formatters for antenna/waveguide/source-analysis debug output.
 * Reused by both the F3 overlay extension (compact) and the F2 antenna-only
 * debug overlay (verbose, dev-only, includes target values). No Babylon/DOM
 * here, just strings — mirrors ReceiverDebugView.ts.
 */
import type { AntennaControllerSnapshot } from './AntennaSnapshot';
import type { AntennaArrayDefinition } from './AntennaArrayDefinition';
import type { WaveguidePathSnapshot } from '../waveguide/WaveguideController';
import type { SourceAnalysisSnapshot } from '../source-analysis/SourceAnalysisController';

/** Compact fields for the F3 overlay — selected array, mode, alignment, samples, classification. */
export function formatAntennaCompactFields(
  snapshot: AntennaControllerSnapshot,
  sourceAnalysis: SourceAnalysisSnapshot,
): ReadonlyArray<readonly [string, string]> {
  const selected = snapshot.arrays.find((a) => a.id === snapshot.selectedArrayId);
  return [
    ['Antenna powered', snapshot.powered ? 'yes' : 'no'],
    ['Selected array', snapshot.selectedArrayId ?? 'none'],
    ['Array state', selected?.controlState ?? '—'],
    [
      'Alignment quality',
      selected?.metrics !== null && selected?.metrics !== undefined
        ? selected.metrics.overallQuality.toFixed(2)
        : '—',
    ],
    ['Samples', `${sourceAnalysis.samples.length}/${sourceAnalysis.requiredArrayIds.length}`],
    ['Source analysis', sourceAnalysis.state],
    ['Classification', sourceAnalysis.result?.finalCategory ?? '—'],
  ];
}

/** Verbose fields for the F2 dev-only antenna debug overlay — includes target values and per-array breakdown. */
export function formatAntennaDebugFields(
  snapshot: AntennaControllerSnapshot,
  getDefinition: (id: string) => AntennaArrayDefinition | undefined,
  getWaveguide: (pathId: string) => WaveguidePathSnapshot | undefined,
  sourceAnalysis: SourceAnalysisSnapshot,
): ReadonlyArray<readonly [string, string]> {
  const lines: Array<[string, string]> = [
    ['Powered', snapshot.powered ? 'yes' : 'no'],
    ['Selected array', snapshot.selectedArrayId ?? 'none'],
  ];

  for (const array of snapshot.arrays) {
    const def = getDefinition(array.id);
    lines.push([`--- ${array.id}`, array.controlState]);
    lines.push([
      '  az/el/pol',
      `${array.mechanical.currentAzimuthDeg.toFixed(1)}/${array.mechanical.currentElevationDeg.toFixed(1)}/${array.mechanical.currentPolarizationDeg.toFixed(1)}`,
    ]);
    if (def !== undefined) {
      lines.push([
        '  target az/el/pol',
        `${def.targetAzimuthDeg.toFixed(1)}±${def.azimuthToleranceDeg}/${def.targetElevationDeg.toFixed(1)}±${def.elevationToleranceDeg}/${def.targetPolarizationDeg.toFixed(1)}±${def.polarizationToleranceDeg}`,
      ]);
      const wg = getWaveguide(def.waveguidePathId);
      lines.push(['  waveguide', wg !== undefined ? `${wg.state} (${wg.currentPortId})` : '—']);
    }
    if (array.metrics !== null) {
      lines.push([
        '  quality az/el/pol',
        `${array.metrics.azimuthQuality.toFixed(2)}/${array.metrics.elevationQuality.toFixed(2)}/${array.metrics.polarizationQuality.toFixed(2)}`,
      ]);
      lines.push([
        '  alignment/overall',
        `${array.metrics.alignmentQuality.toFixed(2)}/${array.metrics.overallQuality.toFixed(2)}`,
      ]);
      lines.push(['  limiting factor', array.metrics.limitingFactor]);
    }
  }

  lines.push(['Source analysis state', sourceAnalysis.state]);
  lines.push([
    'Samples',
    `${sourceAnalysis.samples.length}/${sourceAnalysis.requiredArrayIds.length}`,
  ]);
  for (const sample of sourceAnalysis.samples) {
    lines.push([
      `  sample ${sample.arrayId}`,
      `${sample.bearing.category} conf=${sample.bearing.confidence.toFixed(2)} stab=${sample.bearing.stability.toFixed(2)} valid=${sample.bearing.externalSourceValid}`,
    ]);
  }
  if (sourceAnalysis.result !== null) {
    lines.push(['Result', sourceAnalysis.result.explanationTags.join(', ')]);
  }

  return lines;
}
