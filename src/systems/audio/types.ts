/**
 * Audio Engine & Soundscape Types for The Last Signal (Milestone 1.1).
 *
 * Defines channel buses, clip identifiers, spatial audio parameters,
 * surface materials, and connector system interfaces.
 */

/** The 6 logical channel buses specified for The Last Signal. */
export type AudioBusId = 'master' | 'ambience' | 'sfx' | 'footsteps' | 'radio' | 'threat';

export const AUDIO_BUS_IDS: readonly AudioBusId[] = [
  'master',
  'ambience',
  'sfx',
  'footsteps',
  'radio',
  'threat',
];

export interface AudioBusState {
  volume: number;
  muted: boolean;
}

export type SurfaceType = 'concrete' | 'metal' | 'snow' | 'wood';

export type AudioClipId =
  | 'footstep_concrete'
  | 'footstep_metal'
  | 'footstep_snow'
  | 'footstep_wood'
  | 'landing_thud'
  | 'ambience_wind'
  | 'ambience_facility_hum'
  | 'generator_rumble'
  | 'electrical_spark'
  | 'radio_static'
  | 'radio_carrier'
  | 'threat_heartbeat'
  | 'threat_pursuit'
  | 'threat_distortion';

export interface SpatialAudioOptions {
  /** Reference distance for attenuation (default: 1). */
  refDistance?: number;
  /** Maximum distance before sound is inaudible (default: 30). */
  maxDistance?: number;
  /** Rolloff rate (default: 1). */
  rolloffFactor?: number;
  /** Panning model (default: 'HRTF'). */
  panningModel?: 'HRTF' | 'equalpower';
  /** Distance attenuation model (default: 'inverse'). */
  distanceModel?: 'inverse' | 'linear';
  /** Loop playback (default: false). */
  loop?: boolean;
  /** Playback volume scalar (0 to 1, default: 1). */
  volume?: number;
  /** Playback rate / pitch scalar (default: 1). */
  rate?: number;
}

export interface PlaySoundOptions {
  volume?: number;
  rate?: number;
  loop?: boolean;
  spatialPosition?: { x: number; y: number; z: number };
  spatialOptions?: SpatialAudioOptions;
}

export interface IAudioConnector {
  /** Ticked every simulation frame. */
  update(deltaSeconds: number): void;
  /** Clean disposal on zone change or scene teardown. */
  dispose(): void;
}
