import { describe, expect, it } from 'vitest';
import { ManifestationController } from '../../game/threat/manifestation/ManifestationController';
import { canTransitionManifestation } from '../../game/threat/manifestation/ManifestationState';
import type { ManifestationDefinition } from '../../game/threat/manifestation/ManifestationDefinition';

const SILHOUETTE: ManifestationDefinition = {
  id: 'm-silhouette',
  type: 'distant-silhouette',
  position: { x: 0, y: 0, z: 0 },
  facingYaw: 0,
  durationSeconds: 2,
  endsWhenObstructed: true,
};

const MOVER: ManifestationDefinition = {
  id: 'm-mover',
  type: 'moving-presence',
  position: { x: 0, y: 0, z: 0 },
  facingYaw: 0,
  durationSeconds: 10,
  moveTo: { x: 4, y: 0, z: 0 },
  moveSpeed: 2,
};

const DISTURBANCE: ManifestationDefinition = {
  id: 'm-light',
  type: 'mechanical-disturbance',
  position: { x: 0, y: 0, z: 0 },
  facingYaw: 0,
  durationSeconds: 1,
  disturbance: 'light',
  disturbanceTargetId: 'light-1',
};

function make() {
  const c = new ManifestationController();
  c.register(SILHOUETTE);
  c.register(MOVER);
  c.register(DISTURBANCE);
  const events: string[] = [];
  c.subscribe((e) => events.push(`${e.kind}:${e.manifestationId}`));
  return { c, events };
}

describe('ManifestationState', () => {
  it('is strictly Idle -> Active -> Completed', () => {
    expect(canTransitionManifestation('Idle', 'Active')).toBe(true);
    expect(canTransitionManifestation('Active', 'Completed')).toBe(true);
    expect(canTransitionManifestation('Completed', 'Idle')).toBe(false);
    expect(canTransitionManifestation('Idle', 'Completed')).toBe(false);
  });
});

describe('ManifestationController', () => {
  it('rejects duplicate registration', () => {
    const { c } = make();
    expect(() => c.register(SILHOUETTE)).toThrow();
  });

  it('begins a manifestation and expires it after its duration', () => {
    const { c, events } = make();
    expect(c.begin('m-silhouette')).toBe(true);
    expect(c.activeManifestation?.id).toBe('m-silhouette');
    for (let t = 0; t < 2.2; t += 0.1) c.update(0.1);
    expect(c.hasActive).toBe(false);
    expect(c.getState('m-silhouette')).toBe('Completed');
    expect(events).toContain('ManifestationStarted:m-silhouette');
    expect(events).toContain('ManifestationEnded:m-silhouette');
  });

  it('only one manifestation can run at a time; completed ones never replay', () => {
    const { c } = make();
    c.begin('m-silhouette');
    expect(c.begin('m-mover')).toBe(false); // busy
    c.end();
    expect(c.begin('m-silhouette')).toBe(false); // one-shot
    expect(c.begin('m-mover')).toBe(true);
  });

  it('unknown ids are rejected', () => {
    const { c } = make();
    expect(c.begin('ghost')).toBe(false);
  });

  it('moving presences translate frame-rate independently toward moveTo', () => {
    const { c } = make();
    c.begin('m-mover');
    for (let i = 0; i < 10; i++) c.update(0.1); // 1 s at 2 m/s
    expect(c.getSnapshot().activePosition?.x).toBeCloseTo(2, 5);
    for (let i = 0; i < 20; i++) c.update(0.1);
    expect(c.getSnapshot().activePosition?.x).toBeCloseTo(4, 5); // arrived, no overshoot
  });

  it('ends early when the sightline is reported obstructed (flagged types only)', () => {
    const { c } = make();
    c.begin('m-silhouette');
    c.update(0.1);
    c.notifyObstructed();
    expect(c.hasActive).toBe(false);
    // The mover has no endsWhenObstructed flag: obstruction is ignored.
    c.begin('m-mover');
    c.notifyObstructed();
    expect(c.hasActive).toBe(true);
  });

  it('mechanical disturbances also emit DisturbanceTriggered', () => {
    const { c, events } = make();
    c.begin('m-light');
    expect(events).toContain('DisturbanceTriggered:m-light');
  });

  it('reset returns every manifestation to Idle for dev replay', () => {
    const { c } = make();
    c.begin('m-silhouette');
    c.end();
    c.begin('m-mover');
    c.reset();
    expect(c.hasActive).toBe(false);
    expect(c.getState('m-silhouette')).toBe('Idle');
    expect(c.getState('m-mover')).toBe('Idle');
    expect(c.begin('m-silhouette')).toBe(true);
  });
});
