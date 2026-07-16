import { describe, expect, it } from 'vitest';
import { CheckpointRegistry } from '../../game/facility/Checkpoint';
import type { CheckpointDefinition } from '../../game/facility/Checkpoint';

const CP_SPAWN: CheckpointDefinition = {
  id: 'cp-spawn',
  label: 'Spawn',
  spawnPosition: { x: -58, y: 0.1, z: 0 },
  spawnYaw: 0,
};

const CP_GATE: CheckpointDefinition = {
  id: 'cp-gate',
  label: 'Gate',
  spawnPosition: { x: -15, y: 0.1, z: 0 },
  spawnYaw: 0,
};

const CP_COURTYARD: CheckpointDefinition = {
  id: 'cp-courtyard',
  label: 'Courtyard',
  spawnPosition: { x: 10, y: 0.1, z: 0 },
  spawnYaw: 0,
};

describe('CheckpointRegistry', () => {
  it('registers and retrieves a checkpoint', () => {
    const reg = new CheckpointRegistry();
    reg.register(CP_SPAWN);
    expect(reg.get('cp-spawn')).toBe(CP_SPAWN);
  });

  it('throws on duplicate checkpoint id', () => {
    const reg = new CheckpointRegistry();
    reg.register(CP_SPAWN);
    expect(() => reg.register(CP_SPAWN)).toThrow(/duplicate checkpoint id/);
  });

  it('latestCheckpoint is null with no activations', () => {
    const reg = new CheckpointRegistry();
    reg.register(CP_SPAWN);
    expect(reg.latestCheckpoint).toBeNull();
  });

  it('activate sets latestCheckpoint', () => {
    const reg = new CheckpointRegistry();
    reg.register(CP_SPAWN);
    reg.activate('cp-spawn');
    expect(reg.latestCheckpoint).toBe(CP_SPAWN);
  });

  it('activate returns true on first activation, false on subsequent', () => {
    const reg = new CheckpointRegistry();
    reg.register(CP_SPAWN);
    expect(reg.activate('cp-spawn')).toBe(true);
    expect(reg.activate('cp-spawn')).toBe(false);
  });

  it('latestCheckpoint reflects most recently activated', () => {
    const reg = new CheckpointRegistry();
    reg.register(CP_SPAWN);
    reg.register(CP_GATE);
    reg.register(CP_COURTYARD);

    const t0 = 1000;
    const t1 = 2000;
    const t2 = 3000;

    reg.activate('cp-spawn', t0);
    reg.activate('cp-gate', t1);
    reg.activate('cp-courtyard', t2);

    expect(reg.latestCheckpoint?.id).toBe('cp-courtyard');
  });

  it('activatedCount increments with each unique activation', () => {
    const reg = new CheckpointRegistry();
    reg.register(CP_SPAWN);
    reg.register(CP_GATE);

    expect(reg.activatedCount).toBe(0);
    reg.activate('cp-spawn');
    expect(reg.activatedCount).toBe(1);
    reg.activate('cp-gate');
    expect(reg.activatedCount).toBe(2);
  });

  it('totalCount matches number of registered checkpoints', () => {
    const reg = new CheckpointRegistry();
    reg.register(CP_SPAWN);
    reg.register(CP_GATE);
    expect(reg.totalCount).toBe(2);
  });

  it('isActivated reflects activation state', () => {
    const reg = new CheckpointRegistry();
    reg.register(CP_SPAWN);
    expect(reg.isActivated('cp-spawn')).toBe(false);
    reg.activate('cp-spawn');
    expect(reg.isActivated('cp-spawn')).toBe(true);
  });

  it('reset clears all activation state', () => {
    const reg = new CheckpointRegistry();
    reg.register(CP_SPAWN);
    reg.register(CP_GATE);
    reg.activate('cp-spawn');
    reg.activate('cp-gate');

    reg.reset();

    expect(reg.activatedCount).toBe(0);
    expect(reg.latestCheckpoint).toBeNull();
    expect(reg.isActivated('cp-spawn')).toBe(false);
    expect(reg.isActivated('cp-gate')).toBe(false);
  });

  it('getAll returns all registered definitions', () => {
    const reg = new CheckpointRegistry();
    reg.register(CP_SPAWN);
    reg.register(CP_GATE);
    const all = reg.getAll();
    expect(all).toHaveLength(2);
    expect(all.map((c) => c.id)).toContain('cp-spawn');
  });

  it('activate on unknown id is a no-op and returns false', () => {
    const reg = new CheckpointRegistry();
    expect(reg.activate('nonexistent')).toBe(false);
    expect(reg.latestCheckpoint).toBeNull();
  });
});
