import { createStore, type StoreApi } from 'zustand/vanilla';
import type { GraphicsQualityPreset } from '../config/performanceConfig';
import type { AudioDefaults } from '../config/gameConfig';

/**
 * Player-facing settings. Not persisted yet — persistence is a later
 * milestone; the store shape is stable so persistence can wrap it without
 * changing consumers.
 */
export interface SettingsState {
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  mouseSensitivity: number;
  invertYAxis: boolean;
  graphicsQuality: GraphicsQualityPreset;
  reducedMotion: boolean;

  setVolume(bus: 'masterVolume' | 'musicVolume' | 'effectsVolume', value: number): void;
  setMouseSensitivity(value: number): void;
  setInvertYAxis(inverted: boolean): void;
  setGraphicsQuality(preset: GraphicsQualityPreset): void;
  setReducedMotion(reduced: boolean): void;
}

export type SettingsStore = StoreApi<SettingsState>;

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

export function createSettingsStore(options: {
  audioDefaults: AudioDefaults;
  initialGraphicsPreset: GraphicsQualityPreset;
}): SettingsStore {
  return createStore<SettingsState>()((set) => ({
    masterVolume: options.audioDefaults.masterVolume,
    musicVolume: options.audioDefaults.musicVolume,
    effectsVolume: options.audioDefaults.effectsVolume,
    mouseSensitivity: 1,
    invertYAxis: false,
    graphicsQuality: options.initialGraphicsPreset,
    reducedMotion: false,

    setVolume: (bus, value) => set({ [bus]: clampVolume(value) }),
    setMouseSensitivity: (value) =>
      set({ mouseSensitivity: Number.isFinite(value) && value > 0 ? value : 1 }),
    setInvertYAxis: (invertYAxis) => set({ invertYAxis }),
    setGraphicsQuality: (graphicsQuality) => set({ graphicsQuality }),
    setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  }));
}
