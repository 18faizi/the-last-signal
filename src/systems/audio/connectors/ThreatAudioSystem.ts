/**
 * Threat Audio System for The Last Signal.
 *
 * Hooks into Threat Perception & State:
 * - Sub-bass tension heartbeat drone (scaled dynamically by suspicion level).
 * - High-impact pursuit musical stinger upon threat pursuit initiation.
 * - 3D spatial metallic creaks and acoustic distortions during director manifestations.
 */
import type { AudioManager } from '../AudioManager';
import type { IAudioConnector } from '../types';

export interface ThreatAudioState {
  suspicion: number; // 0 to 1
  behaviorState: string;
  threatPosition: { x: number; y: number; z: number } | null;
}

export class ThreatAudioSystem implements IAudioConnector {
  private heartbeatSoundId: number | null = null;
  private isHeartbeatPlaying = false;
  private previousBehaviorState = 'dormant';

  constructor(
    private readonly audio: AudioManager,
    private readonly getThreatState: () => ThreatAudioState,
  ) {}

  update(_deltaSeconds: number): void {
    const state = this.getThreatState();
    const currentLower = state.behaviorState.toLowerCase();
    const isPursuit = currentLower.includes('pursu');
    const prevWasPursuit = this.previousBehaviorState.includes('pursu');

    // 1. Pursuit Stinger on transition into 'pursuit'
    if (isPursuit && !prevWasPursuit) {
      this.audio.play('threat_pursuit', 'threat', {
        volume: 1.0,
      });
    }
    this.previousBehaviorState = currentLower;

    // 2. Dynamic Heartbeat Tension Drone
    const isDormant = currentLower.includes('dormant') || currentLower.includes('inactive');
    const shouldHeartbeat = !isDormant && state.suspicion > 0.05;

    if (shouldHeartbeat) {
      if (!this.isHeartbeatPlaying) {
        this.heartbeatSoundId = this.audio.play('threat_heartbeat', 'threat', {
          loop: true,
          volume: 0,
        });
        this.isHeartbeatPlaying = true;
      }

      // Scale heartbeat volume and tempo with suspicion
      const targetVol = Math.min(1.0, 0.2 + state.suspicion * 0.8);
      const rate = 1.0 + state.suspicion * 0.35;
      const busVol = this.audio.getEffectiveVolume('threat');

      const howl = this.audio.getOrCreateHowl('threat_heartbeat', 'threat');
      if (this.heartbeatSoundId !== null) {
        howl.volume(targetVol * busVol, this.heartbeatSoundId);
        howl.rate(rate, this.heartbeatSoundId);
      }
    } else {
      if (this.isHeartbeatPlaying) {
        this.audio.stop('threat_heartbeat');
        this.isHeartbeatPlaying = false;
        this.heartbeatSoundId = null;
      }
    }
  }

  /**
   * Spatial manifestation distortion (creaks, reality warping)
   * triggered by the Event Director or manifestation nodes.
   */
  triggerManifestationDistortion(position: { x: number; y: number; z: number }): void {
    this.audio.playSpatial('threat_distortion', 'threat', position, {
      refDistance: 2,
      maxDistance: 25,
      panningModel: 'HRTF',
      volume: 0.9,
    });
  }

  dispose(): void {
    this.audio.stop('threat_heartbeat');
    this.audio.stop('threat_pursuit');
    this.audio.stop('threat_distortion');
    this.isHeartbeatPlaying = false;
    this.heartbeatSoundId = null;
    this.previousBehaviorState = 'dormant';
  }
}
