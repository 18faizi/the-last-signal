/**
 * Unit Tests for Milestone 1.1 Audio Engine & Systems.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { AudioManager } from '../AudioManager';
import { AUDIO_BUS_IDS, type AudioBusId } from '../types';
import { AudioSynth } from '../synth/AudioSynth';
import { FootstepAudioSystem, type FootstepPlayerState } from '../connectors/FootstepAudioSystem';
import {
  EnvironmentalAudioSystem,
  type EnvironmentalState,
} from '../connectors/EnvironmentalAudioSystem';
import { SignalAudioSystem, type SignalAudioState } from '../connectors/SignalAudioSystem';
import { ThreatAudioSystem, type ThreatAudioState } from '../connectors/ThreatAudioSystem';

describe('AudioManager — Buses, Volumes & Mutes', () => {
  let audio: AudioManager;

  beforeEach(() => {
    audio = new AudioManager();
  });

  afterEach(() => {
    audio.dispose();
  });

  it('initializes all 6 specified channel buses with volume 1.0 and unmuted', () => {
    for (const busId of AUDIO_BUS_IDS) {
      expect(audio.getBusVolume(busId)).toBe(1.0);
      expect(audio.isBusMuted(busId)).toBe(false);
      expect(audio.getEffectiveVolume(busId)).toBe(1.0);
    }
  });

  it('clamps bus volumes within [0, 1]', () => {
    audio.setBusVolume('footsteps', 2.5);
    expect(audio.getBusVolume('footsteps')).toBe(1.0);

    audio.setBusVolume('footsteps', -0.5);
    expect(audio.getBusVolume('footsteps')).toBe(0.0);

    audio.setBusVolume('footsteps', 0.65);
    expect(audio.getBusVolume('footsteps')).toBe(0.65);
  });

  it('calculates effective volume via master * bus multiplication', () => {
    audio.setBusVolume('master', 0.8);
    audio.setBusVolume('threat', 0.5);
    expect(audio.getEffectiveVolume('threat')).toBeCloseTo(0.4);

    audio.setBusVolume('master', 0.2);
    expect(audio.getEffectiveVolume('threat')).toBeCloseTo(0.1);
  });

  it('yields zero effective volume when either master or bus is muted', () => {
    audio.setBusVolume('master', 1.0);
    audio.setBusVolume('radio', 0.75);
    expect(audio.getEffectiveVolume('radio')).toBeCloseTo(0.75);

    // Muting specific bus
    audio.setBusMuted('radio', true);
    expect(audio.isBusMuted('radio')).toBe(true);
    expect(audio.getEffectiveVolume('radio')).toBe(0);

    audio.setBusMuted('radio', false);
    expect(audio.getEffectiveVolume('radio')).toBeCloseTo(0.75);

    // Muting master
    audio.setBusMuted('master', true);
    expect(audio.getEffectiveVolume('radio')).toBe(0);
    expect(audio.getEffectiveVolume('footsteps')).toBe(0);
  });

  it('throws for unknown audio buses', () => {
    expect(() => audio.getBusVolume('nonexistent' as AudioBusId)).toThrow('Unknown audio bus');
    expect(() => audio.setBusVolume('nonexistent' as AudioBusId, 0.5)).toThrow('Unknown audio bus');
  });
});

describe('AudioManager — Spatial Audio & Autoplay Unlock', () => {
  let audio: AudioManager;

  beforeEach(() => {
    audio = new AudioManager();
  });

  afterEach(() => {
    audio.dispose();
  });

  it('handles AudioContext unlock gate cleanly', () => {
    // Should safely unlock without throwing
    audio.unlockAudioContext();
    expect(audio.audioUnlocked).toBe(true);
  });

  it('updates listener coordinates without throwing in jsdom', () => {
    expect(() => {
      audio.updateListener({ x: 10, y: 1.7, z: 25 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 });
    }).not.toThrow();
  });

  it('plays spatial audio with position coordinates and options', () => {
    expect(() => {
      const soundId = audio.playSpatial(
        'generator_rumble',
        'sfx',
        { x: -16, y: 1.2, z: 4 },
        {
          refDistance: 3,
          maxDistance: 35,
          panningModel: 'HRTF',
          rolloffFactor: 1.5,
          loop: true,
        },
      );
      expect(typeof soundId).toBe('number');
    }).not.toThrow();
  });

  it('supports volume fading and crossfading between clips', () => {
    expect(() => {
      audio.fade('ambience_wind', 0.2, 0.8, 0.1);
      audio.crossfade('ambience_wind', 'ambience_facility_hum', 'ambience', 0.1);
    }).not.toThrow();
  });

  it('disposes cleanly and stops Howler instances', () => {
    audio.play('footstep_concrete', 'footsteps');
    expect(() => audio.dispose()).not.toThrow();
  });
});

describe('AudioSynth — Procedural Waveform Generation', () => {
  it('generates valid base64 data URIs for all registered audio clips', () => {
    const clips = [
      'footstep_concrete',
      'footstep_metal',
      'footstep_snow',
      'footstep_wood',
      'landing_thud',
      'ambience_wind',
      'ambience_facility_hum',
      'generator_rumble',
      'electrical_spark',
      'radio_static',
      'radio_carrier',
      'threat_heartbeat',
      'threat_pursuit',
      'threat_distortion',
    ] as const;

    for (const clipId of clips) {
      const uri = AudioSynth.getClipUri(clipId);
      expect(uri).toBeDefined();
      expect(uri.startsWith('data:audio/wav;base64,')).toBe(true);
      expect(uri.length).toBeGreaterThan(100);
    }
  });

  it('caches generated data URIs for instantaneous repeat access', () => {
    const uri1 = AudioSynth.getClipUri('landing_thud');
    const uri2 = AudioSynth.getClipUri('landing_thud');
    expect(uri1).toBe(uri2);
  });
});

describe('FootstepAudioSystem', () => {
  let audio: AudioManager;

  beforeEach(() => {
    audio = new AudioManager();
  });

  afterEach(() => {
    audio.dispose();
  });

  it('triggers footstep at walk cadence when player is moving', () => {
    let playCount = 0;
    vi.spyOn(audio, 'play').mockImplementation(() => {
      playCount++;
      return 1;
    });

    const state: FootstepPlayerState = {
      grounded: true,
      horizontalSpeed: 3.5,
      sprinting: false,
      crouched: false,
      zoneId: 'fg-zone-courtyard',
    };

    const system = new FootstepAudioSystem(audio, () => state);

    // Initial tick below interval: no step yet
    system.update(0.3);
    expect(playCount).toBe(0);

    // Accumulated to >= 0.55s: step plays
    system.update(0.3);
    expect(playCount).toBe(1);

    system.dispose();
  });

  it('plays landing thud upon landing from airborne', () => {
    let playedClip: string | null = null;
    vi.spyOn(audio, 'play').mockImplementation((clip) => {
      playedClip = clip;
      return 1;
    });

    let grounded = false;
    const state: FootstepPlayerState = {
      grounded,
      horizontalSpeed: 0,
      sprinting: false,
      crouched: false,
      zoneId: 'fg-zone-courtyard',
    };

    const system = new FootstepAudioSystem(audio, () => ({ ...state, grounded }));

    // Airborne frame
    system.update(0.1);
    expect(playedClip).toBeNull();

    // Landed frame
    grounded = true;
    system.update(0.1);
    expect(playedClip).toBe('landing_thud');

    system.dispose();
  });

  it('suppresses footsteps when stationary or speed is below floor', () => {
    const playSpy = vi.spyOn(audio, 'play');

    const state: FootstepPlayerState = {
      grounded: true,
      horizontalSpeed: 0.1, // Below MOVEMENT_SPEED_FLOOR
      sprinting: false,
      crouched: false,
      zoneId: 'fg-zone-bunkhouse',
    };

    const system = new FootstepAudioSystem(audio, () => state);
    system.update(2.0);
    expect(playSpy).not.toHaveBeenCalled();

    system.dispose();
  });
});

describe('EnvironmentalAudioSystem', () => {
  let audio: AudioManager;

  beforeEach(() => {
    audio = new AudioManager();
  });

  afterEach(() => {
    audio.dispose();
  });

  it('modulates wind volume when crossing outdoor vs indoor zones', () => {
    const fadeSpy = vi.spyOn(audio, 'fade');

    let isOutdoor = true;
    const state: EnvironmentalState = {
      zoneId: 'fg-zone-courtyard',
      isOutdoor,
      isGeneratorRunning: false,
      isFacilityPowered: false,
    };

    const system = new EnvironmentalAudioSystem(audio, () => ({ ...state, isOutdoor }));

    // Move indoors
    isOutdoor = false;
    system.update(0.1);
    expect(fadeSpy).toHaveBeenCalledWith('ambience_wind', expect.any(Number), 0.18, 1.5);

    // Move outdoors
    isOutdoor = true;
    system.update(0.1);
    expect(fadeSpy).toHaveBeenCalledWith('ambience_wind', expect.any(Number), 0.85, 1.5);

    system.dispose();
  });

  it('starts spatial generator rumble when generator state turns to running', () => {
    const playSpatialSpy = vi.spyOn(audio, 'playSpatial');
    const stopSpy = vi.spyOn(audio, 'stop');

    let isGeneratorRunning = false;
    const state: EnvironmentalState = {
      zoneId: 'fg-zone-generator-hall',
      isOutdoor: false,
      isGeneratorRunning,
      isFacilityPowered: false,
    };

    const system = new EnvironmentalAudioSystem(audio, () => ({ ...state, isGeneratorRunning }));

    system.update(0.1);
    expect(playSpatialSpy).not.toHaveBeenCalled();

    // Start generator
    isGeneratorRunning = true;
    system.update(0.1);
    expect(playSpatialSpy).toHaveBeenCalledWith(
      'generator_rumble',
      'sfx',
      { x: -16, y: 1.2, z: 4 },
      expect.objectContaining({ loop: true, panningModel: 'HRTF' }),
    );

    // Stop generator
    isGeneratorRunning = false;
    system.update(0.1);
    expect(stopSpy).toHaveBeenCalledWith('generator_rumble');

    system.dispose();
  });
});

describe('SignalAudioSystem', () => {
  let audio: AudioManager;

  beforeEach(() => {
    audio = new AudioManager();
  });

  afterEach(() => {
    audio.dispose();
  });

  it('stops radio audio when receiver is powered off', () => {
    const stopSpy = vi.spyOn(audio, 'stop');

    const state: SignalAudioState = {
      isReceiverActive: false,
      frequencyDeltaKhz: 10,
      isSignalLocked: false,
      signalQuality: 0,
    };

    const system = new SignalAudioSystem(audio, () => state);
    system.update(0.1);
    expect(stopSpy).not.toHaveBeenCalled(); // was not playing initially

    system.dispose();
  });

  it('triggers carrier pulse when signal is locked', () => {
    const playSpy = vi.spyOn(audio, 'play');

    const state: SignalAudioState = {
      isReceiverActive: true,
      frequencyDeltaKhz: 0.2,
      isSignalLocked: true,
      signalQuality: 0.9,
    };

    const system = new SignalAudioSystem(audio, () => state);

    // First frame starts radio static
    system.update(0.1);
    expect(playSpy).toHaveBeenCalledWith('radio_static', 'radio', expect.any(Object));

    // Accumulate past pulse timer (1.2s)
    system.update(1.2);
    expect(playSpy).toHaveBeenCalledWith('radio_carrier', 'radio', expect.any(Object));

    system.dispose();
  });
});

describe('ThreatAudioSystem', () => {
  let audio: AudioManager;

  beforeEach(() => {
    audio = new AudioManager();
  });

  afterEach(() => {
    audio.dispose();
  });

  it('triggers pursuit stinger on transition into pursuit state', () => {
    const playSpy = vi.spyOn(audio, 'play');

    let behaviorState: ThreatAudioState['behaviorState'] = 'hunting';
    const state: ThreatAudioState = {
      suspicion: 0.8,
      behaviorState,
      threatPosition: { x: 0, y: 1, z: 10 },
    };

    const system = new ThreatAudioSystem(audio, () => ({ ...state, behaviorState }));

    system.update(0.1);
    expect(playSpy).toHaveBeenCalledWith('threat_heartbeat', 'threat', expect.any(Object));

    // Transition to pursuit
    behaviorState = 'pursuit';
    system.update(0.1);
    expect(playSpy).toHaveBeenCalledWith('threat_pursuit', 'threat', { volume: 1.0 });

    system.dispose();
  });

  it('spatializes manifestation distortion at trigger position', () => {
    const playSpatialSpy = vi.spyOn(audio, 'playSpatial');
    const system = new ThreatAudioSystem(audio, () => ({
      suspicion: 0,
      behaviorState: 'dormant',
      threatPosition: null,
    }));

    system.triggerManifestationDistortion({ x: 5, y: 2, z: -10 });
    expect(playSpatialSpy).toHaveBeenCalledWith(
      'threat_distortion',
      'threat',
      { x: 5, y: 2, z: -10 },
      expect.objectContaining({ panningModel: 'HRTF' }),
    );

    system.dispose();
  });
});
