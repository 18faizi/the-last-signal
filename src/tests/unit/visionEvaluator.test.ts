import { describe, expect, it } from 'vitest';
import type { ThreatVisionConfig } from '../../game/threat/ThreatDefinition';
import {
  evaluateVision,
  stanceMultiplier,
  type VisionInput,
} from '../../game/threat/perception/VisionEvaluator';

const CONFIG: ThreatVisionConfig = {
  maxViewDistance: 20,
  horizontalFovDeg: 120,
  verticalToleranceMeters: 2.5,
  falloffStartDistance: 5,
  sprintMultiplier: 1,
  walkMultiplier: 0.7,
  crouchMultiplier: 0.35,
  peripheralPenalty: 0.5,
  behindMultiplier: 0,
};

function input(overrides: Partial<VisionInput>): VisionInput {
  return {
    threatPosition: { x: 0, y: 0, z: 0 },
    threatFacingYaw: 0, // looking along +Z
    playerPosition: { x: 0, y: 0, z: 3 },
    losBlocked: false,
    exposure: 1,
    playerStance: 'walk',
    playerFullyHidden: false,
    ...overrides,
  };
}

describe('VisionEvaluator — hard windows', () => {
  it('sees a player directly ahead inside the cone', () => {
    const result = evaluateVision(CONFIG, input({}));
    expect(result.inCone).toBe(true);
    expect(result.behind).toBe(false);
    expect(result.score).toBeGreaterThan(0);
  });

  it('scores zero beyond the max view distance', () => {
    const result = evaluateVision(CONFIG, input({ playerPosition: { x: 0, y: 0, z: 25 } }));
    expect(result.score).toBe(0);
    expect(result.inCone).toBe(false);
  });

  it('scores zero outside the vertical tolerance (different floor)', () => {
    const result = evaluateVision(CONFIG, input({ playerPosition: { x: 0, y: 3.2, z: 3 } }));
    expect(result.score).toBe(0);
  });

  it('scores zero behind the threat (behindMultiplier 0) and reports behind', () => {
    const result = evaluateVision(CONFIG, input({ playerPosition: { x: 0, y: 0, z: -3 } }));
    expect(result.behind).toBe(true);
    expect(result.score).toBe(0);
  });

  it('LOS blocked forces score zero even inside the cone', () => {
    const result = evaluateVision(CONFIG, input({ losBlocked: true }));
    expect(result.inCone).toBe(true);
    expect(result.score).toBe(0);
  });

  it('a fully-hidden player is never visually detected at any range', () => {
    const result = evaluateVision(CONFIG, input({ playerFullyHidden: true }));
    expect(result.score).toBe(0);
    expect(result.inCone).toBe(false);
  });
});

describe('VisionEvaluator — graded factors', () => {
  it('applies distance falloff beyond falloffStartDistance', () => {
    const near = evaluateVision(CONFIG, input({ playerPosition: { x: 0, y: 0, z: 4 } }));
    const mid = evaluateVision(CONFIG, input({ playerPosition: { x: 0, y: 0, z: 12 } }));
    const far = evaluateVision(CONFIG, input({ playerPosition: { x: 0, y: 0, z: 19 } }));
    expect(near.score).toBeGreaterThan(mid.score);
    expect(mid.score).toBeGreaterThan(far.score);
    expect(near.score).toBeCloseTo(CONFIG.walkMultiplier, 5); // full inside falloff start
  });

  it('orders movement multipliers sprint > walk > crouch', () => {
    const sprint = evaluateVision(CONFIG, input({ playerStance: 'sprint' }));
    const walk = evaluateVision(CONFIG, input({ playerStance: 'walk' }));
    const crouch = evaluateVision(CONFIG, input({ playerStance: 'crouch' }));
    expect(sprint.score).toBeGreaterThan(walk.score);
    expect(walk.score).toBeGreaterThan(crouch.score);
  });

  it('a still player is as hard to see as a crouched one', () => {
    expect(stanceMultiplier(CONFIG, 'still')).toBe(CONFIG.crouchMultiplier);
  });

  it('dark exposure scales the score down; zero exposure blinds the threat', () => {
    const lit = evaluateVision(CONFIG, input({ exposure: 1 }));
    const dark = evaluateVision(CONFIG, input({ exposure: 0.3 }));
    const black = evaluateVision(CONFIG, input({ exposure: 0 }));
    expect(dark.score).toBeCloseTo(lit.score * 0.3, 5);
    expect(black.score).toBe(0);
  });

  it('penalizes the peripheral outer third of the FOV', () => {
    // 120° FOV => half = 60°; peripheral beyond 40°. 50° off-axis:
    const rad = (50 * Math.PI) / 180;
    const peripheral = evaluateVision(
      CONFIG,
      input({ playerPosition: { x: Math.sin(rad) * 4, y: 0, z: Math.cos(rad) * 4 } }),
    );
    const central = evaluateVision(CONFIG, input({ playerPosition: { x: 0, y: 0, z: 4 } }));
    expect(peripheral.peripheral).toBe(true);
    expect(peripheral.score).toBeCloseTo(central.score * CONFIG.peripheralPenalty, 5);
  });

  it('is deterministic — identical inputs give identical scores', () => {
    const a = evaluateVision(CONFIG, input({ playerPosition: { x: 2, y: 0.5, z: 9 } }));
    const b = evaluateVision(CONFIG, input({ playerPosition: { x: 2, y: 0.5, z: 9 } }));
    expect(a).toEqual(b);
  });

  it('handles facing-yaw wraparound (facing -Z sees a player at -Z)', () => {
    const result = evaluateVision(
      CONFIG,
      input({ threatFacingYaw: Math.PI, playerPosition: { x: 0, y: 0, z: -3 } }),
    );
    expect(result.behind).toBe(false);
    expect(result.score).toBeGreaterThan(0);
  });
});
