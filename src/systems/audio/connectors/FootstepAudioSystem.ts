/**
 * Footstep Audio System for The Last Signal.
 *
 * Reads player movement state (walking, sprinting, crouching, jumping)
 * and triggers surface-dependent footstep cadence and landing audio.
 */
import type { AudioManager } from '../AudioManager';
import type { IAudioConnector, SurfaceType, AudioClipId } from '../types';

export interface FootstepPlayerState {
  grounded: boolean;
  horizontalSpeed: number;
  sprinting: boolean;
  crouched: boolean;
  zoneId: string | null;
}

export class FootstepAudioSystem implements IAudioConnector {
  private stepAccumulator = 0;
  private wasAirborne = false;

  constructor(
    private readonly audio: AudioManager,
    private readonly getPlayerState: () => FootstepPlayerState,
  ) {}

  update(deltaSeconds: number): void {
    const state = this.getPlayerState();

    // Landing thud on transition from airborne to grounded
    if (state.grounded && this.wasAirborne) {
      this.playLandingThud();
    }
    this.wasAirborne = !state.grounded;

    // Must be grounded and moving above minimum floor
    const isMoving = state.grounded && state.horizontalSpeed > 0.45;
    if (!isMoving) {
      this.stepAccumulator = 0;
      return;
    }

    const interval = state.sprinting ? 0.35 : state.crouched ? 0.75 : 0.55;
    this.stepAccumulator += deltaSeconds;

    if (this.stepAccumulator >= interval) {
      this.stepAccumulator %= interval;
      this.playFootstep(state);
    }
  }

  private playFootstep(state: FootstepPlayerState): void {
    const surface = this.resolveSurface(state.zoneId);
    const clipId = this.getClipForSurface(surface);
    const volume = state.crouched ? 0.2 : state.sprinting ? 1.0 : 0.65;
    const rate = 0.94 + Math.random() * 0.12; // Natural pitch variation

    this.audio.play(clipId, 'footsteps', {
      volume,
      rate,
    });
  }

  private playLandingThud(): void {
    this.audio.play('landing_thud', 'footsteps', {
      volume: 0.85,
      rate: 0.95 + Math.random() * 0.1,
    });
  }

  private resolveSurface(zoneId: string | null): SurfaceType {
    if (!zoneId) return 'concrete';

    if (
      zoneId.includes('courtyard') ||
      zoneId.includes('gate') ||
      zoneId.includes('perimeter') ||
      zoneId.includes('approach')
    ) {
      return 'snow';
    }
    if (
      zoneId.includes('catwalk') ||
      zoneId.includes('gantry') ||
      zoneId.includes('roof') ||
      zoneId.includes('ladder')
    ) {
      return 'metal';
    }
    if (
      zoneId.includes('bunkhouse') ||
      zoneId.includes('office') ||
      zoneId.includes('control-room')
    ) {
      return 'wood';
    }

    return 'concrete';
  }

  private getClipForSurface(surface: SurfaceType): AudioClipId {
    switch (surface) {
      case 'metal':
        return 'footstep_metal';
      case 'snow':
        return 'footstep_snow';
      case 'wood':
        return 'footstep_wood';
      case 'concrete':
      default:
        return 'footstep_concrete';
    }
  }

  dispose(): void {
    this.stepAccumulator = 0;
    this.wasAirborne = false;
  }
}
