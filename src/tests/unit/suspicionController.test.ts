import { describe, expect, it } from 'vitest';
import type { ThreatSuspicionConfig } from '../../game/threat/ThreatDefinition';
import {
  MAX_SUSPICION_DT_SECONDS,
  SuspicionController,
} from '../../game/threat/perception/SuspicionController';

const CONFIG: ThreatSuspicionConfig = {
  suspicionGainPerSecond: 0.5,
  suspicionDecayPerSecond: 0.2,
  suspiciousThreshold: 0.3,
  investigateThreshold: 0.7,
  relaxThreshold: 0.1,
  detectionGainPerSecond: 0.5,
  detectionDecayPerSecond: 0.3,
  detectionDecayAfterLosBreakPerSecond: 0.05,
  detectionVisionFloor: 0.4,
};

function step(
  c: SuspicionController,
  seconds: number,
  input: { visionScore: number; soundPressure: number; hasLineOfSight: boolean },
  dt = 0.05,
): void {
  for (let t = 0; t < seconds; t += dt) {
    c.update(dt, input);
  }
}

describe('SuspicionController — stage one (suspicion)', () => {
  it('gains suspicion under vision pressure and decays without stimulus', () => {
    const c = new SuspicionController(CONFIG);
    step(c, 1, { visionScore: 1, soundPressure: 0, hasLineOfSight: true });
    expect(c.currentSuspicion).toBeCloseTo(0.5, 1);
    step(c, 1, { visionScore: 0, soundPressure: 0, hasLineOfSight: false });
    expect(c.currentSuspicion).toBeCloseTo(0.3, 1);
  });

  it('sound alone raises suspicion', () => {
    const c = new SuspicionController(CONFIG);
    step(c, 1, { visionScore: 0, soundPressure: 0.8, hasLineOfSight: false });
    expect(c.currentSuspicion).toBeGreaterThan(0.3);
  });

  it('suspicion saturates at 1 and floors at 0', () => {
    const c = new SuspicionController(CONFIG);
    step(c, 10, { visionScore: 1, soundPressure: 1, hasLineOfSight: true });
    expect(c.currentSuspicion).toBe(1);
    step(c, 60, { visionScore: 0, soundPressure: 0, hasLineOfSight: false });
    expect(c.currentSuspicion).toBe(0);
  });
});

describe('SuspicionController — stage two (detection)', () => {
  it('detection only accumulates above the vision floor (sound never confirms)', () => {
    const c = new SuspicionController(CONFIG);
    step(c, 3, { visionScore: 0.2, soundPressure: 1, hasLineOfSight: true });
    expect(c.currentDetection).toBe(0);
    step(c, 1, { visionScore: 0.8, soundPressure: 0, hasLineOfSight: true });
    expect(c.currentDetection).toBeGreaterThan(0);
  });

  it('detection decays slower after line of sight breaks', () => {
    const a = new SuspicionController(CONFIG);
    const b = new SuspicionController(CONFIG);
    step(a, 1.5, { visionScore: 1, soundPressure: 0, hasLineOfSight: true });
    step(b, 1.5, { visionScore: 1, soundPressure: 0, hasLineOfSight: true });
    const start = a.currentDetection;
    // a: LOS holds but vision drops (player ducked behind partial cover).
    step(a, 2, { visionScore: 0, soundPressure: 0, hasLineOfSight: true });
    // b: LOS fully broken.
    step(b, 2, { visionScore: 0, soundPressure: 0, hasLineOfSight: false });
    expect(a.currentDetection).toBeLessThan(b.currentDetection);
    expect(b.currentDetection).toBeGreaterThan(start - 2 * CONFIG.detectionDecayPerSecond);
  });

  it('fires full detection exactly ONCE per encounter', () => {
    const c = new SuspicionController(CONFIG);
    let fired = 0;
    c.subscribe(() => fired++);
    step(c, 5, { visionScore: 1, soundPressure: 0, hasLineOfSight: true });
    expect(c.currentDetection).toBe(1);
    expect(fired).toBe(1);
    // Decay below 1, then re-saturate: the one-shot must NOT re-fire.
    step(c, 1, { visionScore: 0, soundPressure: 0, hasLineOfSight: true });
    step(c, 5, { visionScore: 1, soundPressure: 0, hasLineOfSight: true });
    expect(fired).toBe(1);
    // resetEncounter re-arms it.
    c.resetEncounter();
    expect(c.currentDetection).toBe(0);
    step(c, 5, { visionScore: 1, soundPressure: 0, hasLineOfSight: true });
    expect(fired).toBe(2);
  });
});

describe('SuspicionController — frame-rate independence', () => {
  it('many small steps and few large steps accumulate the same suspicion', () => {
    const fine = new SuspicionController(CONFIG);
    const coarse = new SuspicionController(CONFIG);
    const input = { visionScore: 0.6, soundPressure: 0, hasLineOfSight: true };
    for (let i = 0; i < 100; i++) fine.update(0.01, input); // 1 s at 100 fps
    for (let i = 0; i < 10; i++) coarse.update(0.1, input); // 1 s at 10 fps
    expect(fine.currentSuspicion).toBeCloseTo(coarse.currentSuspicion, 5);
    expect(fine.currentDetection).toBeCloseTo(coarse.currentDetection, 5);
  });

  it('clamps pathological deltas to the 0.1 s precedent', () => {
    const c = new SuspicionController(CONFIG);
    c.update(5, { visionScore: 1, soundPressure: 0, hasLineOfSight: true });
    expect(c.currentSuspicion).toBeCloseTo(
      CONFIG.suspicionGainPerSecond * MAX_SUSPICION_DT_SECONDS,
      5,
    );
    c.update(-1, { visionScore: 1, soundPressure: 0, hasLineOfSight: true });
    expect(c.currentSuspicion).toBeCloseTo(
      CONFIG.suspicionGainPerSecond * MAX_SUSPICION_DT_SECONDS,
      5,
    );
  });
});
