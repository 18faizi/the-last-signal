/**
 * Howler-backed Audio Manager for The Last Signal (Milestone 1.1).
 *
 * Provides:
 * - 6 channel buses: master, ambience, sfx, footsteps, radio, threat.
 * - 3D HRTF spatial audio attenuation linked to camera position and orientation.
 * - Volume ramping, bus fading, and smooth crossfading utilities.
 * - Safe browser autoplay AudioContext unlock gate.
 * - Deterministic memory management and clean teardown.
 */
import { Howler, Howl } from 'howler';
import type { Disposable } from '../../app/lifecycle/Disposable';
import type {
  AudioBusId,
  AudioClipId,
  AudioBusState,
  PlaySoundOptions,
  SpatialAudioOptions,
} from './types';
import { AUDIO_BUS_IDS } from './types';
import { AudioSynth } from './synth/AudioSynth';

export class AudioManager implements Disposable {
  private readonly buses = new Map<AudioBusId, AudioBusState>();
  private readonly howls = new Map<AudioClipId, Howl>();
  private readonly clipBusMap = new Map<AudioClipId, AudioBusId>();
  private isUnlocked = false;
  private disposed = false;
  private removeUnlockListeners: (() => void) | null = null;

  constructor() {
    for (const id of AUDIO_BUS_IDS) {
      this.buses.set(id, { volume: 1.0, muted: false });
    }
    this.setupAutoplayUnlock();
    this.applyMasterVolume();
  }

  /**
   * Browser Autoplay Unlock Gate.
   * Modern browsers require a user gesture (pointerdown/keydown/click) before
   * Web Audio can output sound.
   */
  private setupAutoplayUnlock(): void {
    if (typeof window === 'undefined') {
      this.isUnlocked = true;
      return;
    }

    const checkUnlocked = (): void => {
      // In Howler, ctx.state === 'running' indicates unlocked state
      const ctx = Howler.ctx as AudioContext | undefined;
      if (!ctx || ctx.state === 'running') {
        this.isUnlocked = true;
      }
    };
    checkUnlocked();

    if (this.isUnlocked) return;

    const onUserInteraction = (): void => {
      this.unlockAudioContext();
      cleanup();
    };

    const cleanup = (): void => {
      window.removeEventListener('pointerdown', onUserInteraction);
      window.removeEventListener('keydown', onUserInteraction);
      window.removeEventListener('click', onUserInteraction);
      this.removeUnlockListeners = null;
    };

    window.addEventListener('pointerdown', onUserInteraction, { once: true, passive: true });
    window.addEventListener('keydown', onUserInteraction, { once: true, passive: true });
    window.addEventListener('click', onUserInteraction, { once: true, passive: true });
    this.removeUnlockListeners = cleanup;
  }

  /** Unlocks the Web Audio context explicitly upon user interaction. */
  unlockAudioContext(): void {
    if (this.disposed) return;
    try {
      const ctx = Howler.ctx as AudioContext | undefined;
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume();
      }
      this.isUnlocked = true;
    } catch {
      // Graceful fallback in environments where AudioContext cannot be resumed
      this.isUnlocked = true;
    }
  }

  get audioUnlocked(): boolean {
    return this.isUnlocked;
  }

  // ----- Bus Volume & Muting ------------------------------------------------

  setBusVolume(busId: AudioBusId, volume: number): void {
    const bus = this.requireBus(busId);
    bus.volume = clamp01(volume);
    if (busId === 'master') {
      this.applyMasterVolume();
    } else {
      this.updateBusClips(busId);
    }
  }

  getBusVolume(busId: AudioBusId): number {
    return this.requireBus(busId).volume;
  }

  setBusMuted(busId: AudioBusId, muted: boolean): void {
    const bus = this.requireBus(busId);
    bus.muted = muted;
    if (busId === 'master') {
      this.applyMasterVolume();
    } else {
      this.updateBusClips(busId);
    }
  }

  isBusMuted(busId: AudioBusId): boolean {
    return this.requireBus(busId).muted;
  }

  getEffectiveVolume(busId: AudioBusId): number {
    const master = this.requireBus('master');
    const bus = this.requireBus(busId);
    if (master.muted || bus.muted) {
      return 0;
    }
    return master.volume * bus.volume;
  }

  private applyMasterVolume(): void {
    const master = this.requireBus('master');
    Howler.volume(master.muted ? 0 : master.volume);
  }

  private updateBusClips(busId: AudioBusId): void {
    const effectiveVol = this.getEffectiveVolume(busId);
    for (const [clipId, registeredBus] of this.clipBusMap.entries()) {
      if (registeredBus === busId) {
        const howl = this.howls.get(clipId);
        if (howl) {
          howl.volume(effectiveVol);
        }
      }
    }
  }

  // ----- 3D Spatial Audio (Listener & Emitters) -----------------------------

  /**
   * Updates the 3D spatial audio listener position and forward/up orientation
   * vectors to match the Babylon.js camera.
   */
  updateListener(
    pos: { x: number; y: number; z: number },
    forward: { x: number; y: number; z: number },
    up: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 },
  ): void {
    if (this.disposed) return;
    try {
      Howler.pos(pos.x, pos.y, pos.z);
      Howler.orientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    } catch {
      // Graceful no-op in headless/mocked environments
    }
  }

  /**
   * Plays a 3D spatial sound with HRTF attenuation.
   */
  playSpatial(
    clipId: AudioClipId,
    busId: AudioBusId,
    position: { x: number; y: number; z: number },
    options: SpatialAudioOptions = {},
  ): number {
    const howl = this.getOrCreateHowl(clipId, busId);
    const soundId = howl.play();

    howl.loop(options.loop ?? false, soundId);
    if (options.rate !== undefined) {
      howl.rate(options.rate, soundId);
    }

    try {
      howl.pos(position.x, position.y, position.z, soundId);
      howl.pannerAttr(
        {
          panningModel: options.panningModel ?? 'HRTF',
          refDistance: options.refDistance ?? 1,
          maxDistance: options.maxDistance ?? 30,
          rolloffFactor: options.rolloffFactor ?? 1,
          distanceModel: options.distanceModel ?? 'inverse',
        },
        soundId,
      );
    } catch {
      // Graceful no-op if Web Audio spatial nodes are not available
    }

    return soundId;
  }

  // ----- Sound Playback & Crossfading ---------------------------------------

  /**
   * Plays a sound on the specified bus with optional spatial position or loop.
   */
  play(clipId: AudioClipId, busId: AudioBusId, options: PlaySoundOptions = {}): number {
    const howl = this.getOrCreateHowl(clipId, busId);
    const soundId = howl.play();

    if (options.loop !== undefined) {
      howl.loop(options.loop, soundId);
    }
    if (options.rate !== undefined) {
      howl.rate(options.rate, soundId);
    }
    if (options.volume !== undefined) {
      const busVol = this.getEffectiveVolume(busId);
      howl.volume(options.volume * busVol, soundId);
    }

    if (options.spatialPosition) {
      try {
        howl.pos(
          options.spatialPosition.x,
          options.spatialPosition.y,
          options.spatialPosition.z,
          soundId,
        );
        if (options.spatialOptions) {
          howl.pannerAttr(
            {
              panningModel: options.spatialOptions.panningModel ?? 'HRTF',
              refDistance: options.spatialOptions.refDistance ?? 1,
              maxDistance: options.spatialOptions.maxDistance ?? 30,
              rolloffFactor: options.spatialOptions.rolloffFactor ?? 1,
              distanceModel: options.spatialOptions.distanceModel ?? 'inverse',
            },
            soundId,
          );
        }
      } catch {
        // Fallback for non-spatial audio contexts
      }
    }

    return soundId;
  }

  /** Stops playback of a specific clip. */
  stop(clipId: AudioClipId): void {
    const howl = this.howls.get(clipId);
    if (howl) {
      howl.stop();
    }
  }

  /** Stops all sounds on a specific bus, or all buses if omitted. */
  stopAll(busId?: AudioBusId): void {
    if (busId === undefined) {
      for (const howl of this.howls.values()) {
        howl.stop();
      }
    } else {
      for (const [clipId, registeredBus] of this.clipBusMap.entries()) {
        if (registeredBus === busId) {
          this.howls.get(clipId)?.stop();
        }
      }
    }
  }

  /**
   * Smoothly fades a sound's volume over durationSeconds.
   */
  fade(clipId: AudioClipId, fromVolume: number, toVolume: number, durationSeconds: number): void {
    const howl = this.howls.get(clipId);
    if (howl) {
      const bus = this.clipBusMap.get(clipId) ?? 'master';
      const effectiveMult = this.getEffectiveVolume(bus);
      howl.fade(fromVolume * effectiveMult, toVolume * effectiveMult, durationSeconds * 1000);
    }
  }

  /**
   * Crossfades between two ambient or background clips smoothly (e.g. over 1.5s).
   */
  crossfade(
    outClipId: AudioClipId | null,
    inClipId: AudioClipId,
    busId: AudioBusId,
    durationSeconds = 1.5,
  ): void {
    if (outClipId) {
      const outHowl = this.howls.get(outClipId);
      if (outHowl && outHowl.playing()) {
        const curVol = outHowl.volume();
        outHowl.fade(curVol, 0, durationSeconds * 1000);
        setTimeout(() => {
          if (!this.disposed) {
            outHowl.stop();
          }
        }, durationSeconds * 1000);
      }
    }

    const inHowl = this.getOrCreateHowl(inClipId, busId);
    const targetVol = this.getEffectiveVolume(busId);
    inHowl.loop(true);
    if (!inHowl.playing()) {
      inHowl.volume(0);
      inHowl.play();
    }
    inHowl.fade(0, targetVol, durationSeconds * 1000);
  }

  /** Retrieves or lazily creates the Howl instance for an audio clip. */
  getOrCreateHowl(clipId: AudioClipId, busId: AudioBusId): Howl {
    const existing = this.howls.get(clipId);
    if (existing) {
      return existing;
    }

    const uri = AudioSynth.getClipUri(clipId);
    const effectiveVol = this.getEffectiveVolume(busId);

    const howl = new Howl({
      src: [uri],
      format: ['wav'],
      volume: effectiveVol,
      autoplay: false,
    });

    this.howls.set(clipId, howl);
    this.clipBusMap.set(clipId, busId);
    return howl;
  }

  // ----- Lifecycle & Teardown -----------------------------------------------

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.removeUnlockListeners?.();
    this.removeUnlockListeners = null;

    for (const howl of this.howls.values()) {
      howl.stop();
      howl.unload();
    }
    this.howls.clear();
    this.clipBusMap.clear();

    try {
      Howler.unload();
    } catch {
      // Safe fallback
    }
  }

  private requireBus(busId: AudioBusId): AudioBusState {
    const bus = this.buses.get(busId);
    if (bus === undefined) {
      throw new Error(`Unknown audio bus: ${busId}`);
    }
    return bus;
  }
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
