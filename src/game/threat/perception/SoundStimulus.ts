/**
 * Typed sound stimuli (Milestone 0.9).
 *
 * No actual audio is involved — stimuli are plain data records emitted by
 * narrow adapters over existing systems (player movement, doors, generator,
 * receiver/antenna activity) and consumed by the threat's perception model.
 */
import type { Point3 } from '../../facility/FacilityZone';

export type SoundCategory =
  | 'footstep-walk'
  | 'footstep-sprint'
  | 'jump-landing'
  | 'door-operation'
  | 'generator-startup'
  | 'signal-activity';

export type SoundSource = 'player' | 'door' | 'generator' | 'receiver' | 'antenna' | 'dev';

export interface SoundStimulus {
  readonly id: string;
  readonly position: Point3;
  /** 0-1 loudness at the source. */
  readonly intensity: number;
  /** Radius in metres at which the stimulus attenuates to zero. */
  readonly radius: number;
  readonly category: SoundCategory;
  /** Monotonic sequence number assigned by the registry. */
  readonly seq: number;
  /** Registry-relative timestamp (seconds) the stimulus was emitted at. */
  readonly emittedAt: number;
  /** Seconds the stimulus stays perceivable. */
  readonly durationSeconds: number;
  readonly source: SoundSource;
  /** False for ambience the AI must never react to. */
  readonly aiReactable: boolean;
  /** Zone the stimulus originated in (informational, for debug/authoring). */
  readonly zoneId: string | null;
}

export interface SoundStimulusSpec {
  readonly position: Point3;
  readonly intensity: number;
  readonly radius: number;
  readonly category: SoundCategory;
  readonly durationSeconds: number;
  readonly source: SoundSource;
  readonly aiReactable?: boolean;
  readonly zoneId?: string | null;
}

/** Perceived intensity of a stimulus at a listener position (0 outside radius). */
export function perceivedIntensity(stimulus: SoundStimulus, listener: Point3): number {
  const dx = stimulus.position.x - listener.x;
  const dy = stimulus.position.y - listener.y;
  const dz = stimulus.position.z - listener.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance >= stimulus.radius) return 0;
  return stimulus.intensity * (1 - distance / stimulus.radius);
}
