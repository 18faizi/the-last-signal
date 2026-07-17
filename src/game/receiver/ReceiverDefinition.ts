import {
  MAX_CHANNEL,
  MAX_FREQUENCY_MHZ,
  MIN_CHANNEL,
  MIN_FREQUENCY_MHZ,
} from '../signal/SignalChannel';

/** Static, tunable receiver hardware config (mirrors GeneratorDefinition.ts). */
export interface ReceiverDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly bootSeconds: number;
  readonly minChannel: number;
  readonly maxChannel: number;
  readonly minFrequencyMHz: number;
  readonly maxFrequencyMHz: number;
  /** Coarse per-keypress frequency step (MHz). */
  readonly frequencyStepCoarse: number;
  /** Fine (Shift-modified) per-keypress frequency step (MHz). */
  readonly frequencyStepFine: number;
  readonly gainStepCoarse: number;
  readonly gainStepFine: number;
  readonly filterStepCoarse: number;
  readonly filterStepFine: number;
  readonly phaseStepCoarseDeg: number;
  readonly phaseStepFineDeg: number;
  /** Seconds for the scripted scan sweep to cross the full frequency range once. */
  readonly scanSweepSeconds: number;
  /** Channel the scan sweep pauses on to signal activity (matches the real signal's channel). */
  readonly scanActivityChannel: number;
  /** Seconds the scan pauses once it reaches the activity channel. */
  readonly scanPauseSeconds: number;
}

export const DEFAULT_RECEIVER_DEFINITION: ReceiverDefinition = {
  id: 'fg-receiver-main',
  displayName: 'Field Signal Receiver',
  bootSeconds: 1.5,
  minChannel: MIN_CHANNEL,
  maxChannel: MAX_CHANNEL,
  minFrequencyMHz: MIN_FREQUENCY_MHZ,
  maxFrequencyMHz: MAX_FREQUENCY_MHZ,
  frequencyStepCoarse: 1,
  frequencyStepFine: 0.1,
  gainStepCoarse: 0.05,
  gainStepFine: 0.01,
  filterStepCoarse: 0.05,
  filterStepFine: 0.01,
  phaseStepCoarseDeg: 5,
  phaseStepFineDeg: 1,
  scanSweepSeconds: 14,
  scanActivityChannel: 3,
  scanPauseSeconds: 1.5,
};

/** Returns human-readable problems; an empty array means the config is valid. */
export function validateReceiverDefinition(def: ReceiverDefinition): string[] {
  const problems: string[] = [];
  if (def.bootSeconds <= 0) problems.push('bootSeconds must be positive');
  if (def.minChannel >= def.maxChannel) problems.push('minChannel must be less than maxChannel');
  if (def.minFrequencyMHz >= def.maxFrequencyMHz) {
    problems.push('minFrequencyMHz must be less than maxFrequencyMHz');
  }
  const positiveFields: Array<[string, number]> = [
    ['frequencyStepCoarse', def.frequencyStepCoarse],
    ['frequencyStepFine', def.frequencyStepFine],
    ['gainStepCoarse', def.gainStepCoarse],
    ['gainStepFine', def.gainStepFine],
    ['filterStepCoarse', def.filterStepCoarse],
    ['filterStepFine', def.filterStepFine],
    ['phaseStepCoarseDeg', def.phaseStepCoarseDeg],
    ['phaseStepFineDeg', def.phaseStepFineDeg],
    ['scanSweepSeconds', def.scanSweepSeconds],
    ['scanPauseSeconds', def.scanPauseSeconds],
  ];
  for (const [name, value] of positiveFields) {
    if (!Number.isFinite(value) || value <= 0) {
      problems.push(`${name} must be a positive number, got ${value}`);
    }
  }
  if (def.scanActivityChannel < def.minChannel || def.scanActivityChannel > def.maxChannel) {
    problems.push('scanActivityChannel must be within [minChannel, maxChannel]');
  }
  return problems;
}
