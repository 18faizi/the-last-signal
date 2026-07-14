import { describe, expect, it } from 'vitest';
import { effectiveBusVolume } from '../../core/audio/AudioBus';
import { AudioManager } from '../../core/audio/AudioManager';
import { gameConfig } from '../../config/gameConfig';

describe('effectiveBusVolume', () => {
  it('multiplies master and bus volume', () => {
    expect(
      effectiveBusVolume({ volume: 0.5, muted: false }, { volume: 0.8, muted: false }),
    ).toBeCloseTo(0.4);
  });

  it('is zero when either side is muted', () => {
    expect(effectiveBusVolume({ volume: 1, muted: true }, { volume: 1, muted: false })).toBe(0);
    expect(effectiveBusVolume({ volume: 1, muted: false }, { volume: 1, muted: true })).toBe(0);
  });
});

describe('AudioManager', () => {
  function makeManager(): AudioManager {
    return new AudioManager(gameConfig.audio);
  }

  it('initializes buses from configured defaults', () => {
    const manager = makeManager();
    expect(manager.getBusVolume('master')).toBe(gameConfig.audio.masterVolume);
    expect(manager.getBusVolume('music')).toBe(gameConfig.audio.musicVolume);
    expect(manager.getBusVolume('ambient')).toBe(gameConfig.audio.ambientVolume);
    manager.dispose();
  });

  it('clamps bus volume updates', () => {
    const manager = makeManager();
    manager.setBusVolume('effects', 7);
    expect(manager.getBusVolume('effects')).toBe(1);
    manager.setBusVolume('effects', -1);
    expect(manager.getBusVolume('effects')).toBe(0);
    manager.dispose();
  });

  it('computes effective volume through master', () => {
    const manager = makeManager();
    manager.setBusVolume('master', 0.5);
    manager.setBusVolume('music', 0.5);
    expect(manager.getEffectiveVolume('music')).toBeCloseTo(0.25);
    manager.setBusMuted('master', true);
    expect(manager.getEffectiveVolume('music')).toBe(0);
    manager.dispose();
  });

  it('mutes and unmutes individual buses', () => {
    const manager = makeManager();
    manager.setBusMuted('dialogue', true);
    expect(manager.isBusMuted('dialogue')).toBe(true);
    expect(manager.getEffectiveVolume('dialogue')).toBe(0);
    manager.setBusMuted('dialogue', false);
    expect(manager.getEffectiveVolume('dialogue')).toBeGreaterThan(0);
    manager.dispose();
  });
});
