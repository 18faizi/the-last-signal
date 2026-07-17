import { clampChannel, clampFrequency, clampPhase, clamp01, MIN_CHANNEL } from './SignalChannel';
import { MIN_FREQUENCY_MHZ } from './SignalChannel';

/**
 * Mutable receiver control state — the "knobs" the player operates.
 *
 * Plain data, mutated in place by ReceiverController. Kept mutable
 * (unlike the definition/metrics types) because it is the one piece of
 * signal-domain state that changes continuously under direct player input,
 * matching the milestone spec's explicit call for mutable control state.
 */
export interface ReceiverControls {
  channel: number;
  frequencyMHz: number;
  /** 0-1. */
  gain: number;
  /** 0-1. */
  filter: number;
  /** -180..180 degrees. */
  phaseDeg: number;
}

export function createDefaultReceiverControls(): ReceiverControls {
  return {
    channel: MIN_CHANNEL,
    frequencyMHz: MIN_FREQUENCY_MHZ,
    gain: 0.5,
    filter: 0.5,
    phaseDeg: 0,
  };
}

export function cloneReceiverControls(controls: ReceiverControls): ReceiverControls {
  return { ...controls };
}

/** Clamps every field to its legal range in place. */
export function sanitizeReceiverControls(controls: ReceiverControls): void {
  controls.channel = clampChannel(controls.channel);
  controls.frequencyMHz = clampFrequency(controls.frequencyMHz);
  controls.gain = clamp01(controls.gain);
  controls.filter = clamp01(controls.filter);
  controls.phaseDeg = clampPhase(controls.phaseDeg);
}
