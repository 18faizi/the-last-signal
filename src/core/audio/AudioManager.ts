import { Howler } from 'howler';
import type { Disposable } from '../../app/lifecycle/Disposable';
import type { AudioDefaults } from '../../config/gameConfig';
import { AUDIO_BUS_IDS, effectiveBusVolume, type AudioBusId, type AudioBusState } from './AudioBus';

/**
 * Howler-backed audio infrastructure.
 *
 * Milestone 0.1 plays no audio: this manager only establishes the bus model
 * and global volume plumbing that later milestones build on.
 *
 * ## How future clips will be registered
 * A later milestone adds `registerClip(id, howlOptions, bus)` which creates a
 * `Howl` lazily, stores it against its bus, and applies
 * `effectiveBusVolume(master, bus) * clipVolume` whenever bus or master
 * volume changes. Playback before the browser unlocks audio is already safe:
 * Howler queues play calls until the first user gesture (`autoUnlock`), so no
 * special-case code is needed here.
 */
export class AudioManager implements Disposable {
  private readonly buses = new Map<AudioBusId, AudioBusState>();
  private disposed = false;

  constructor(defaults: AudioDefaults) {
    const initialVolumes: Record<AudioBusId, number> = {
      master: defaults.masterVolume,
      music: defaults.musicVolume,
      effects: defaults.effectsVolume,
      dialogue: defaults.dialogueVolume,
      ambient: defaults.ambientVolume,
    };
    for (const id of AUDIO_BUS_IDS) {
      this.buses.set(id, { volume: clamp01(initialVolumes[id]), muted: false });
    }
    this.applyMasterVolume();
  }

  setBusVolume(busId: AudioBusId, volume: number): void {
    this.requireBus(busId).volume = clamp01(volume);
    if (busId === 'master') {
      this.applyMasterVolume();
    }
  }

  getBusVolume(busId: AudioBusId): number {
    return this.requireBus(busId).volume;
  }

  setBusMuted(busId: AudioBusId, muted: boolean): void {
    this.requireBus(busId).muted = muted;
    if (busId === 'master') {
      this.applyMasterVolume();
    }
  }

  isBusMuted(busId: AudioBusId): boolean {
    return this.requireBus(busId).muted;
  }

  /** Effective output volume for a bus, accounting for master and mutes. */
  getEffectiveVolume(busId: AudioBusId): number {
    const master = this.requireBus('master');
    const bus = this.requireBus(busId);
    return busId === 'master'
      ? master.muted
        ? 0
        : master.volume
      : effectiveBusVolume(master, bus);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    // Releases every Howl and the underlying AudioContext.
    Howler.unload();
  }

  private applyMasterVolume(): void {
    const master = this.requireBus('master');
    Howler.volume(master.muted ? 0 : master.volume);
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
