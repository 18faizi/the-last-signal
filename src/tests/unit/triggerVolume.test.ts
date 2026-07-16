import { describe, expect, it, vi } from 'vitest';
import { TriggerVolumeSet } from '../../game/facility/TriggerVolume';
import type { ZoneAabb } from '../../game/facility/FacilityZone';

const BOX_A: ZoneAabb = { minX: 0, minY: 0, minZ: 0, maxX: 10, maxY: 5, maxZ: 10 };
const INSIDE_A = { x: 5, y: 2, z: 5 };
const OUTSIDE = { x: 50, y: 0, z: 50 };

describe('TriggerVolumeSet', () => {
  it('adds a trigger and retrieves it', () => {
    const set = new TriggerVolumeSet();
    const onEnter = vi.fn();
    set.add({ id: 'trig-1', aabb: BOX_A, onEnter });
    expect(set.get('trig-1')).toBeDefined();
  });

  it('throws on duplicate trigger id', () => {
    const set = new TriggerVolumeSet();
    set.add({ id: 'trig-1', aabb: BOX_A, onEnter: vi.fn() });
    expect(() => set.add({ id: 'trig-1', aabb: BOX_A, onEnter: vi.fn() })).toThrow(
      /duplicate trigger id/,
    );
  });

  it('fires onEnter when player enters the AABB', () => {
    const set = new TriggerVolumeSet();
    const onEnter = vi.fn();
    set.add({ id: 'trig-1', aabb: BOX_A, onEnter });

    set.update(INSIDE_A);

    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('one-shot trigger fires exactly once', () => {
    const set = new TriggerVolumeSet();
    const onEnter = vi.fn();
    set.add({ id: 'trig-1', aabb: BOX_A, onEnter, repeatable: false });

    set.update(INSIDE_A); // enter → fires
    set.update(OUTSIDE); // exit
    set.update(INSIDE_A); // re-enter → should NOT fire again

    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('repeatable trigger fires each time player enters', () => {
    const set = new TriggerVolumeSet();
    const onEnter = vi.fn();
    set.add({ id: 'trig-1', aabb: BOX_A, onEnter, repeatable: true });

    set.update(INSIDE_A); // first enter
    set.update(OUTSIDE); // exit
    set.update(INSIDE_A); // second enter

    expect(onEnter).toHaveBeenCalledTimes(2);
  });

  it('fires onExit when player leaves', () => {
    const set = new TriggerVolumeSet();
    const onExit = vi.fn();
    set.add({ id: 'trig-1', aabb: BOX_A, onEnter: vi.fn(), onExit });

    set.update(INSIDE_A); // enter
    set.update(OUTSIDE); // exit

    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('hasFired returns true after one-shot trigger fires', () => {
    const set = new TriggerVolumeSet();
    set.add({ id: 'trig-1', aabb: BOX_A, onEnter: vi.fn() });

    expect(set.hasFired('trig-1')).toBe(false);
    set.update(INSIDE_A);
    expect(set.hasFired('trig-1')).toBe(true);
  });

  it('count returns number of registered triggers', () => {
    const set = new TriggerVolumeSet();
    expect(set.count).toBe(0);
    set.add({ id: 'trig-1', aabb: BOX_A, onEnter: vi.fn() });
    set.add({ id: 'trig-2', aabb: BOX_A, onEnter: vi.fn() });
    expect(set.count).toBe(2);
  });

  it('reset clears fired state and inside state', () => {
    const set = new TriggerVolumeSet();
    const onEnter = vi.fn();
    set.add({ id: 'trig-1', aabb: BOX_A, onEnter });

    set.update(INSIDE_A);
    expect(set.hasFired('trig-1')).toBe(true);

    set.reset();
    expect(set.hasFired('trig-1')).toBe(false);

    set.update(INSIDE_A); // should fire again after reset
    expect(onEnter).toHaveBeenCalledTimes(2);
  });

  it('clear removes all triggers', () => {
    const set = new TriggerVolumeSet();
    set.add({ id: 'trig-1', aabb: BOX_A, onEnter: vi.fn() });
    set.clear();
    expect(set.count).toBe(0);
    expect(set.get('trig-1')).toBeUndefined();
  });

  it('swallows errors thrown by onEnter callback', () => {
    const set = new TriggerVolumeSet();
    set.add({
      id: 'trig-1',
      aabb: BOX_A,
      onEnter: () => {
        throw new Error('boom');
      },
    });
    expect(() => set.update(INSIDE_A)).not.toThrow();
  });

  it('swallows errors thrown by onExit callback', () => {
    const set = new TriggerVolumeSet();
    set.add({
      id: 'trig-1',
      aabb: BOX_A,
      onEnter: vi.fn(),
      onExit: () => {
        throw new Error('boom');
      },
    });
    set.update(INSIDE_A);
    expect(() => set.update(OUTSIDE)).not.toThrow();
  });

  it('does not fire onEnter when player was already inside on previous update', () => {
    const set = new TriggerVolumeSet();
    const onEnter = vi.fn();
    set.add({ id: 'trig-1', aabb: BOX_A, onEnter, repeatable: true });

    set.update(INSIDE_A); // enter
    set.update({ x: 3, y: 1, z: 3 }); // still inside — no second fire

    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});
