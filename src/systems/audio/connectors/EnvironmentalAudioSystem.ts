/**
 * Environmental Audio System for The Last Signal.
 *
 * Binds background audio loops to facility state:
 * - Outdoor wind loop (dynamically attenuated indoor vs outdoor).
 * - 60Hz/120Hz electrical room hum (energized when facility circuits are powered).
 * - 3D spatial diesel generator rumble at generator coordinates (-16, 1.2, 4).
 */
import type { AudioManager } from '../AudioManager';
import type { IAudioConnector } from '../types';

export interface EnvironmentalState {
  zoneId: string | null;
  isOutdoor: boolean;
  isGeneratorRunning: boolean;
  isFacilityPowered: boolean;
}

export class EnvironmentalAudioSystem implements IAudioConnector {
  private windSoundId: number | null = null;
  private humSoundId: number | null = null;
  private generatorSoundId: number | null = null;
  private lastWasOutdoor = false;
  private lastGeneratorRunning = false;
  private lastFacilityPowered = false;

  private readonly GENERATOR_POSITION = { x: -16, y: 1.2, z: 4 };

  constructor(
    private readonly audio: AudioManager,
    private readonly getEnvState: () => EnvironmentalState,
  ) {
    const initial = this.getEnvState();
    this.lastWasOutdoor = initial.isOutdoor;
    this.lastGeneratorRunning = initial.isGeneratorRunning;
    this.lastFacilityPowered = initial.isFacilityPowered;
    this.startAmbientLoops(initial);
  }

  private startAmbientLoops(initial: EnvironmentalState): void {
    // Start wind loop
    this.windSoundId = this.audio.play('ambience_wind', 'ambience', {
      loop: true,
      volume: initial.isOutdoor ? 0.85 : 0.18,
    });

    // Start facility hum loop
    this.humSoundId = this.audio.play('ambience_facility_hum', 'ambience', {
      loop: true,
      volume: initial.isFacilityPowered && !initial.isOutdoor ? 0.5 : 0,
    });
  }

  update(_deltaSeconds: number): void {
    const state = this.getEnvState();

    // 1. Wind attenuation (outdoor vs indoor)
    if (state.isOutdoor !== this.lastWasOutdoor) {
      this.lastWasOutdoor = state.isOutdoor;
      const targetWindVol = state.isOutdoor ? 0.85 : 0.18;
      this.audio.fade('ambience_wind', state.isOutdoor ? 0.18 : 0.85, targetWindVol, 1.5);
    }

    // 2. Facility electrical hum (powered indoors vs unpowered)
    if (
      state.isFacilityPowered !== this.lastFacilityPowered ||
      state.isOutdoor !== this.lastWasOutdoor
    ) {
      this.lastFacilityPowered = state.isFacilityPowered;
      const targetHumVol = state.isFacilityPowered && !state.isOutdoor ? 0.5 : 0;
      this.audio.fade('ambience_facility_hum', targetHumVol > 0 ? 0 : 0.5, targetHumVol, 1.5);
    }

    // 3. Spatial Diesel Generator rumble
    if (state.isGeneratorRunning !== this.lastGeneratorRunning) {
      this.lastGeneratorRunning = state.isGeneratorRunning;
      if (state.isGeneratorRunning) {
        if (this.generatorSoundId === null) {
          this.generatorSoundId = this.audio.playSpatial(
            'generator_rumble',
            'sfx',
            this.GENERATOR_POSITION,
            {
              loop: true,
              volume: 1.0,
              refDistance: 3,
              maxDistance: 35,
              panningModel: 'HRTF',
            },
          );
        }
      } else {
        if (this.generatorSoundId !== null) {
          this.audio.stop('generator_rumble');
          this.generatorSoundId = null;
        }
      }
    }
  }

  triggerElectricalArc(position?: { x: number; y: number; z: number }): void {
    if (position) {
      this.audio.playSpatial('electrical_spark', 'sfx', position, {
        refDistance: 2,
        maxDistance: 20,
      });
    } else {
      this.audio.play('electrical_spark', 'sfx', { volume: 0.7 });
    }
  }

  dispose(): void {
    this.audio.stop('ambience_wind');
    this.audio.stop('ambience_facility_hum');
    this.audio.stop('generator_rumble');
    this.windSoundId = null;
    this.humSoundId = null;
    this.generatorSoundId = null;
  }
}
