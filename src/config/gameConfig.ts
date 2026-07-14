/**
 * Game identity and world-level defaults.
 *
 * Values that later milestones will tune (gravity, audio defaults) live here
 * so they are not scattered through service implementations.
 */
export interface GravityConfig {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface AudioDefaults {
  readonly masterVolume: number;
  readonly musicVolume: number;
  readonly effectsVolume: number;
  readonly dialogueVolume: number;
  readonly ambientVolume: number;
}

export interface GameConfig {
  readonly title: string;
  readonly milestone: string;
  readonly readyMarkerText: string;
  readonly gravity: GravityConfig;
  readonly audio: AudioDefaults;
}

export const gameConfig: GameConfig = {
  title: 'THE LAST SIGNAL',
  milestone: '0.1',
  readyMarkerText: 'Milestone 0.1 — Foundation Ready',
  gravity: { x: 0, y: -9.81, z: 0 },
  audio: {
    masterVolume: 0.8,
    musicVolume: 0.7,
    effectsVolume: 0.8,
    dialogueVolume: 1.0,
    ambientVolume: 0.6,
  },
};
