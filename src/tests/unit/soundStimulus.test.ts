import { describe, expect, it } from 'vitest';
import { perceivedIntensity } from '../../game/threat/perception/SoundStimulus';
import { SoundStimulusRegistry } from '../../game/threat/perception/SoundStimulusRegistry';
import {
  PlayerStimulusAdapter,
  SPRINT_STEP_INTERVAL_SECONDS,
  WALK_STEP_INTERVAL_SECONDS,
} from '../../game/threat/perception/PlayerStimulusAdapter';
import {
  evaluateExposure,
  EXPOSURE_DARK,
  EXPOSURE_EMERGENCY,
  EXPOSURE_LIT,
} from '../../game/threat/perception/ExposureEvaluator';

const ORIGIN = { x: 0, y: 0, z: 0 };

describe('SoundStimulusRegistry — registration and expiry', () => {
  it('registers typed stimuli with sequential ids and clock timestamps', () => {
    const registry = new SoundStimulusRegistry();
    registry.update(1.5);
    const s = registry.emit({
      position: ORIGIN,
      intensity: 0.8,
      radius: 10,
      category: 'door-operation',
      durationSeconds: 2,
      source: 'door',
    });
    expect(s.seq).toBe(1);
    expect(s.emittedAt).toBe(1.5);
    expect(s.category).toBe('door-operation');
    expect(registry.activeCount).toBe(1);
  });

  it('expires stimuli after their duration', () => {
    const registry = new SoundStimulusRegistry();
    registry.emit({
      position: ORIGIN,
      intensity: 1,
      radius: 10,
      category: 'jump-landing',
      durationSeconds: 1,
      source: 'player',
    });
    registry.update(0.5);
    expect(registry.activeCount).toBe(1);
    registry.update(0.6);
    expect(registry.activeCount).toBe(0);
  });

  it('attenuates perceived intensity linearly with distance, zero at radius', () => {
    const registry = new SoundStimulusRegistry();
    const s = registry.emit({
      position: ORIGIN,
      intensity: 1,
      radius: 10,
      category: 'footstep-sprint',
      durationSeconds: 5,
      source: 'player',
    });
    expect(perceivedIntensity(s, { x: 0, y: 0, z: 0 })).toBe(1);
    expect(perceivedIntensity(s, { x: 5, y: 0, z: 0 })).toBeCloseTo(0.5, 5);
    expect(perceivedIntensity(s, { x: 10, y: 0, z: 0 })).toBe(0);
    expect(perceivedIntensity(s, { x: 15, y: 0, z: 0 })).toBe(0);
  });

  it('selects the strongest stimulus for a listener; ties resolve to the newest', () => {
    const registry = new SoundStimulusRegistry();
    registry.emit({
      position: { x: 8, y: 0, z: 0 },
      intensity: 1,
      radius: 10,
      category: 'footstep-walk',
      durationSeconds: 5,
      source: 'player',
    });
    const loud = registry.emit({
      position: { x: 1, y: 0, z: 0 },
      intensity: 1,
      radius: 10,
      category: 'generator-startup',
      durationSeconds: 5,
      source: 'generator',
    });
    const best = registry.strongestFor(ORIGIN);
    expect(best?.stimulus.id).toBe(loud.id);

    // Tie: identical stimuli — the newest (highest seq) wins.
    const tieRegistry = new SoundStimulusRegistry();
    tieRegistry.emit({
      position: ORIGIN,
      intensity: 0.5,
      radius: 5,
      category: 'footstep-walk',
      durationSeconds: 5,
      source: 'player',
    });
    const newest = tieRegistry.emit({
      position: ORIGIN,
      intensity: 0.5,
      radius: 5,
      category: 'footstep-walk',
      durationSeconds: 5,
      source: 'player',
    });
    expect(tieRegistry.strongestFor(ORIGIN)?.stimulus.id).toBe(newest.id);
  });

  it('ignores non-AI-reactable stimuli in strongest selection', () => {
    const registry = new SoundStimulusRegistry();
    registry.emit({
      position: ORIGIN,
      intensity: 1,
      radius: 10,
      category: 'signal-activity',
      durationSeconds: 5,
      source: 'receiver',
      aiReactable: false,
    });
    expect(registry.strongestFor(ORIGIN)).toBeNull();
  });

  it('notifies subscribers synchronously on emit', () => {
    const registry = new SoundStimulusRegistry();
    const seen: string[] = [];
    const unsubscribe = registry.subscribe((s) => seen.push(s.category));
    registry.emit({
      position: ORIGIN,
      intensity: 0.4,
      radius: 6,
      category: 'door-operation',
      durationSeconds: 1,
      source: 'door',
    });
    unsubscribe();
    registry.emit({
      position: ORIGIN,
      intensity: 0.4,
      radius: 6,
      category: 'door-operation',
      durationSeconds: 1,
      source: 'door',
    });
    expect(seen).toEqual(['door-operation']);
  });

  it('clearStimuli drops live stimuli but keeps the clock; reset restores everything', () => {
    const registry = new SoundStimulusRegistry();
    registry.update(3);
    registry.emit({
      position: ORIGIN,
      intensity: 1,
      radius: 10,
      category: 'footstep-walk',
      durationSeconds: 60,
      source: 'player',
    });
    registry.clearStimuli();
    expect(registry.activeCount).toBe(0);
    expect(registry.now).toBe(3);
    registry.reset();
    expect(registry.now).toBe(0);
    expect(
      registry.emit({
        position: ORIGIN,
        intensity: 1,
        radius: 1,
        category: 'footstep-walk',
        durationSeconds: 1,
        source: 'player',
      }).seq,
    ).toBe(1);
  });

  it('dispose empties the registry', () => {
    const registry = new SoundStimulusRegistry();
    registry.emit({
      position: ORIGIN,
      intensity: 1,
      radius: 10,
      category: 'footstep-walk',
      durationSeconds: 60,
      source: 'player',
    });
    registry.dispose();
    expect(registry.activeCount).toBe(0);
  });
});

describe('PlayerStimulusAdapter — movement stimuli', () => {
  function sample(overrides: Partial<Parameters<PlayerStimulusAdapter['update']>[1]>) {
    return {
      position: ORIGIN,
      horizontalSpeed: 3.2,
      grounded: true,
      sprinting: false,
      crouched: false,
      zoneId: null,
      ...overrides,
    };
  }

  it('emits walk footsteps at the walk cadence', () => {
    const registry = new SoundStimulusRegistry();
    const adapter = new PlayerStimulusAdapter(registry);
    const categories: string[] = [];
    registry.subscribe((s) => categories.push(s.category));
    for (let i = 0; i < 24; i++) {
      adapter.update(0.05, sample({}));
    }
    // 1.2 s of walking at 0.55 s cadence -> 2 footsteps.
    expect(categories.filter((c) => c === 'footstep-walk')).toHaveLength(
      Math.floor(1.2 / WALK_STEP_INTERVAL_SECONDS),
    );
  });

  it('sprint footsteps are more frequent, louder and longer-ranged than walk', () => {
    const registry = new SoundStimulusRegistry();
    const adapter = new PlayerStimulusAdapter(registry);
    const emitted: Array<{ category: string; intensity: number; radius: number }> = [];
    registry.subscribe((s) =>
      emitted.push({ category: s.category, intensity: s.intensity, radius: s.radius }),
    );
    for (let i = 0; i < 24; i++) {
      adapter.update(0.05, sample({ sprinting: true, horizontalSpeed: 5.4 }));
    }
    const sprints = emitted.filter((e) => e.category === 'footstep-sprint');
    expect(sprints.length).toBe(Math.floor(1.2 / SPRINT_STEP_INTERVAL_SECONDS));
    expect(sprints[0]?.intensity).toBeGreaterThan(0.35);
    expect(sprints[0]?.radius).toBeGreaterThan(8);
  });

  it('crouched movement emits nothing', () => {
    const registry = new SoundStimulusRegistry();
    const adapter = new PlayerStimulusAdapter(registry);
    for (let i = 0; i < 40; i++) {
      adapter.update(0.05, sample({ crouched: true, horizontalSpeed: 1.5 }));
    }
    expect(registry.activeCount).toBe(0);
  });

  it('emits a landing stimulus on the airborne -> grounded edge', () => {
    const registry = new SoundStimulusRegistry();
    const adapter = new PlayerStimulusAdapter(registry);
    const categories: string[] = [];
    registry.subscribe((s) => categories.push(s.category));
    adapter.update(0.05, sample({ grounded: false, horizontalSpeed: 0 }));
    adapter.update(0.05, sample({ grounded: false, horizontalSpeed: 0 }));
    adapter.update(0.05, sample({ grounded: true, horizontalSpeed: 0 }));
    adapter.update(0.05, sample({ grounded: true, horizontalSpeed: 0 }));
    expect(categories.filter((c) => c === 'jump-landing')).toHaveLength(1);
  });
});

describe('ExposureEvaluator — restrained lighting approximation', () => {
  it('powered zones read brighter than emergency, which beats darkness', () => {
    const lit = evaluateExposure({
      zonePowered: true,
      emergencyLightingOnly: false,
      crouched: false,
      hidingConcealment: 0,
      inDarkCover: false,
    });
    const emergency = evaluateExposure({
      zonePowered: false,
      emergencyLightingOnly: true,
      crouched: false,
      hidingConcealment: 0,
      inDarkCover: false,
    });
    const dark = evaluateExposure({
      zonePowered: false,
      emergencyLightingOnly: false,
      crouched: false,
      hidingConcealment: 0,
      inDarkCover: false,
    });
    expect(lit).toBe(EXPOSURE_LIT);
    expect(emergency).toBe(EXPOSURE_EMERGENCY);
    expect(dark).toBe(EXPOSURE_DARK);
    expect(lit).toBeGreaterThan(emergency);
    expect(emergency).toBeGreaterThan(dark);
  });

  it('crouching, cover and concealment all reduce exposure; full concealment zeroes it', () => {
    const base = evaluateExposure({
      zonePowered: true,
      emergencyLightingOnly: false,
      crouched: false,
      hidingConcealment: 0,
      inDarkCover: false,
    });
    const crouched = evaluateExposure({
      zonePowered: true,
      emergencyLightingOnly: false,
      crouched: true,
      hidingConcealment: 0,
      inDarkCover: false,
    });
    const covered = evaluateExposure({
      zonePowered: true,
      emergencyLightingOnly: false,
      crouched: false,
      hidingConcealment: 0,
      inDarkCover: true,
    });
    const concealed = evaluateExposure({
      zonePowered: true,
      emergencyLightingOnly: false,
      crouched: false,
      hidingConcealment: 1,
      inDarkCover: false,
    });
    expect(crouched).toBeLessThan(base);
    expect(covered).toBeLessThan(base);
    expect(concealed).toBe(0);
  });
});
