/**
 * Logical audio buses. Every future clip is registered against exactly one
 * bus; a clip's effective volume is `master x bus x clip`.
 */
export type AudioBusId = 'master' | 'music' | 'effects' | 'dialogue' | 'ambient';

export const AUDIO_BUS_IDS: readonly AudioBusId[] = [
  'master',
  'music',
  'effects',
  'dialogue',
  'ambient',
];

export interface AudioBusState {
  volume: number;
  muted: boolean;
}

export function effectiveBusVolume(master: AudioBusState, bus: AudioBusState): number {
  if (master.muted || bus.muted) {
    return 0;
  }
  return master.volume * bus.volume;
}
