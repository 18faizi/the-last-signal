/**
 * Pure formatters for receiver/signal debug output. Reused by both the F3
 * overlay extension (compact, no solution values) and the F11 signal-only
 * debug overlay (verbose, dev-only, includes target values so a developer
 * can verify tuning against the solution — never rendered in production).
 * No Babylon/DOM here, just strings — mirrors GeneratorDebugView.ts.
 */
import type { ReceiverControllerSnapshot } from './ReceiverController';
import type { SignalDefinition } from '../signal/SignalDefinition';

/** Compact fields for the F3 overlay — no target/solution values. */
export function formatReceiverCompactFields(
  snapshot: ReceiverControllerSnapshot,
): ReadonlyArray<readonly [string, string]> {
  return [
    ['Receiver mode', snapshot.mode],
    ['Channel', String(snapshot.controls.channel)],
    ['Frequency', `${snapshot.controls.frequencyMHz.toFixed(2)} MHz`],
    [
      'Gain/Filter',
      `${snapshot.controls.gain.toFixed(2)} / ${snapshot.controls.filter.toFixed(2)}`,
    ],
    ['Phase', `${snapshot.controls.phaseDeg.toFixed(1)}°`],
    [
      'Signal strength',
      snapshot.metrics ? snapshot.metrics.effectiveSignalStrength.toFixed(2) : '—',
    ],
    ['Noise', snapshot.metrics ? snapshot.metrics.amplifiedNoise.toFixed(2) : '—'],
    ['Overall quality', snapshot.metrics ? snapshot.metrics.overallQuality.toFixed(2) : '—'],
    ['Lock', `${snapshot.lockState} ${Math.round(snapshot.acquisitionProgress * 100)}%`],
    ['Decode', `${snapshot.decodeState} ${Math.round(snapshot.decodeProgress * 100)}%`],
    ['Decoded count', String(snapshot.decodedSignalIds.length)],
  ];
}

/** Verbose fields for the F11 dev-only signal debug overlay — includes target values. */
export function formatReceiverDebugFields(
  snapshot: ReceiverControllerSnapshot,
  activeSignal: SignalDefinition | undefined,
): ReadonlyArray<readonly [string, string]> {
  const base: Array<[string, string]> = [
    ['Mode', snapshot.mode],
    ['Boot progress', `${Math.round(snapshot.bootProgress * 100)}%`],
    ['Panel open', snapshot.isPanelOpen ? 'yes' : 'no'],
    ['Scanning', snapshot.scanning ? 'yes' : 'no'],
    ['Active signal', snapshot.activeSignalId ?? 'none'],
    ['Channel', String(snapshot.controls.channel)],
    ['Frequency', `${snapshot.controls.frequencyMHz.toFixed(2)} MHz`],
    ['Gain', snapshot.controls.gain.toFixed(3)],
    ['Filter', snapshot.controls.filter.toFixed(3)],
    ['Phase', `${snapshot.controls.phaseDeg.toFixed(1)}°`],
  ];

  if (activeSignal !== undefined) {
    base.push(
      [
        'Target frequency',
        `${activeSignal.targetFrequencyMHz.toFixed(2)} MHz ±${activeSignal.frequencyToleranceMHz}`,
      ],
      [
        'Target gain',
        `${activeSignal.targetGainMin.toFixed(2)}–${activeSignal.targetGainMax.toFixed(2)}`,
      ],
      ['Target filter', `${activeSignal.targetFilter.toFixed(2)} ±${activeSignal.filterTolerance}`],
      [
        'Target phase',
        `${activeSignal.targetPhaseDeg.toFixed(1)}° ±${activeSignal.phaseToleranceDeg}`,
      ],
      ['Lock threshold', activeSignal.minLockQuality.toFixed(2)],
    );
  }

  if (snapshot.metrics !== null) {
    base.push(
      ['Channel match', snapshot.metrics.channelMatch ? 'yes' : 'no'],
      ['Freq error', `${snapshot.metrics.frequencyErrorMHz.toFixed(2)} MHz`],
      ['Freq quality', snapshot.metrics.frequencyQuality.toFixed(3)],
      ['Gain quality', snapshot.metrics.gainQuality.toFixed(3)],
      ['Filter quality', snapshot.metrics.filterQuality.toFixed(3)],
      ['Phase error', `${snapshot.metrics.phaseErrorDeg.toFixed(1)}°`],
      ['Phase quality', snapshot.metrics.phaseQuality.toFixed(3)],
      ['Overall quality', snapshot.metrics.overallQuality.toFixed(3)],
      ['Limiting factor', snapshot.metrics.limitingFactor],
    );
  }

  base.push(
    ['Lock state', `${snapshot.lockState} (${Math.round(snapshot.acquisitionProgress * 100)}%)`],
    ['Hold quality', snapshot.holdQuality.toFixed(3)],
    ['Decode state', `${snapshot.decodeState} (${Math.round(snapshot.decodeProgress * 100)}%)`],
    ['Decoded ids', snapshot.decodedSignalIds.join(', ') || 'none'],
  );

  return base;
}
