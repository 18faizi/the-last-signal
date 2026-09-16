/**
 * Signal Audio System for The Last Signal.
 *
 * Binds receiver frequency tuning and signal lock state to:
 * - Dynamic radio static hiss (modulated by tuning distance to target frequency).
 * - Decoded carrier wave beep/pulse audio on frequency lock.
 */
import type { AudioManager } from '../AudioManager';
import type { IAudioConnector } from '../types';

export interface SignalAudioState {
  isReceiverActive: boolean;
  frequencyDeltaKhz: number;
  isSignalLocked: boolean;
  signalQuality: number; // 0 to 1
}

export class SignalAudioSystem implements IAudioConnector {
  private staticSoundId: number | null = null;
  private pulseTimer = 0;
  private isStaticPlaying = false;

  constructor(
    private readonly audio: AudioManager,
    private readonly getSignalState: () => SignalAudioState,
  ) {}

  update(deltaSeconds: number): void {
    const state = this.getSignalState();

    if (!state.isReceiverActive) {
      if (this.isStaticPlaying) {
        this.audio.stop('radio_static');
        this.isStaticPlaying = false;
        this.staticSoundId = null;
      }
      this.pulseTimer = 0;
      return;
    }

    // 1. Radio Static Hiss Loop
    if (!this.isStaticPlaying) {
      this.staticSoundId = this.audio.play('radio_static', 'radio', {
        loop: true,
        volume: 0.6,
      });
      this.isStaticPlaying = true;
    }

    // Modulate static volume: closer to carrier = clearer reception
    const dist = Math.abs(state.frequencyDeltaKhz);
    // At dist > 50kHz: loud static (0.75). At dist < 5kHz: clear static (0.2).
    const normalizedDist = Math.min(1, Math.max(0, dist / 50));
    const staticVol = 0.2 + 0.55 * normalizedDist;
    const busVol = this.audio.getEffectiveVolume('radio');

    if (this.isStaticPlaying) {
      const howl = this.audio.getOrCreateHowl('radio_static', 'radio');
      if (this.staticSoundId !== null) {
        howl.volume(staticVol * busVol, this.staticSoundId);
      }
    }

    // 2. Decoded Carrier Pulse Tone on Signal Lock
    if (state.isSignalLocked) {
      this.pulseTimer += deltaSeconds;
      // Pulse interval: 1.2s
      if (this.pulseTimer >= 1.2) {
        this.pulseTimer = 0;
        const pulseVol = Math.max(0.2, Math.min(1.0, state.signalQuality));
        this.audio.play('radio_carrier', 'radio', {
          volume: pulseVol * 0.8,
          rate: 1.0 + (Math.random() - 0.5) * 0.02,
        });
      }
    } else {
      this.pulseTimer = 0;
    }
  }

  dispose(): void {
    this.audio.stop('radio_static');
    this.audio.stop('radio_carrier');
    this.isStaticPlaying = false;
    this.staticSoundId = null;
    this.pulseTimer = 0;
  }
}
