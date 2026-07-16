import { describe, expect, it, vi } from 'vitest';
import { ZoneRegistry } from '../../game/facility/ZoneRegistry';
import type { FacilityZoneDefinition } from '../../game/facility/FacilityZone';

const ZONE_A: FacilityZoneDefinition = {
  id: 'zone-a',
  label: 'Zone A',
  isKeyZone: true,
  aabb: { minX: 0, minY: 0, minZ: 0, maxX: 10, maxY: 5, maxZ: 10 },
};

const ZONE_B: FacilityZoneDefinition = {
  id: 'zone-b',
  label: 'Zone B',
  isKeyZone: false,
  aabb: { minX: 5, minY: 0, minZ: 5, maxX: 15, maxY: 5, maxZ: 15 },
};

describe('ZoneRegistry', () => {
  it('registers a zone and retrieves it by id', () => {
    const reg = new ZoneRegistry();
    reg.register(ZONE_A);
    expect(reg.get('zone-a')).toBe(ZONE_A);
  });

  it('throws on duplicate zone id', () => {
    const reg = new ZoneRegistry();
    reg.register(ZONE_A);
    expect(() => reg.register(ZONE_A)).toThrow(/duplicate zone id/);
  });

  it('emits discovered and entered on first entry', () => {
    const reg = new ZoneRegistry();
    reg.register(ZONE_A);
    const events: string[] = [];
    reg.onZoneEvent((e) => events.push(`${e.kind}:${e.zoneId}`));

    reg.update({ x: 5, y: 2, z: 5 }); // inside zone-a

    expect(events).toContain('discovered:zone-a');
    expect(events).toContain('entered:zone-a');
  });

  it('emits exited when player leaves a zone', () => {
    const reg = new ZoneRegistry();
    reg.register(ZONE_A);
    const events: string[] = [];
    reg.onZoneEvent((e) => events.push(`${e.kind}:${e.zoneId}`));

    reg.update({ x: 5, y: 2, z: 5 }); // enter
    reg.update({ x: 50, y: 2, z: 50 }); // exit

    expect(events).toContain('exited:zone-a');
  });

  it('does not emit discovered again on re-entry', () => {
    const reg = new ZoneRegistry();
    reg.register(ZONE_A);
    const discovered: string[] = [];
    reg.onZoneEvent((e) => {
      if (e.kind === 'discovered') discovered.push(e.zoneId);
    });

    reg.update({ x: 5, y: 2, z: 5 }); // first entry
    reg.update({ x: 50, y: 0, z: 50 }); // exit
    reg.update({ x: 5, y: 2, z: 5 }); // re-enter

    expect(discovered.filter((id) => id === 'zone-a')).toHaveLength(1);
  });

  it('tracks multiple overlapping zones simultaneously', () => {
    const reg = new ZoneRegistry();
    reg.register(ZONE_A);
    reg.register(ZONE_B);

    reg.update({ x: 7, y: 2, z: 7 }); // inside both A and B

    expect(reg.isCurrentlyInside('zone-a')).toBe(true);
    expect(reg.isCurrentlyInside('zone-b')).toBe(true);
  });

  it('totalCount and discoveredCount are correct', () => {
    const reg = new ZoneRegistry();
    reg.register(ZONE_A);
    reg.register(ZONE_B);

    expect(reg.totalCount).toBe(2);
    expect(reg.discoveredCount).toBe(0);

    // (2,2,2) is inside ZONE_A (0-10 on all axes) but outside ZONE_B (5-15 on all axes).
    reg.update({ x: 2, y: 2, z: 2 });
    expect(reg.discoveredCount).toBe(1);
  });

  it('reset clears current membership and discoveries', () => {
    const reg = new ZoneRegistry();
    reg.register(ZONE_A);
    reg.update({ x: 5, y: 2, z: 5 });

    reg.reset();

    expect(reg.isCurrentlyInside('zone-a')).toBe(false);
    expect(reg.isDiscovered('zone-a')).toBe(false);
    expect(reg.discoveredCount).toBe(0);
  });

  it('unsubscribe stops further notifications', () => {
    const reg = new ZoneRegistry();
    reg.register(ZONE_A);
    const events: string[] = [];
    const unsub = reg.onZoneEvent((e) => events.push(e.kind));

    reg.update({ x: 5, y: 2, z: 5 });
    unsub();
    reg.update({ x: 50, y: 0, z: 50 }); // this would emit 'exited' if subscribed

    const kinds = events.filter((k) => k === 'exited');
    expect(kinds).toHaveLength(0);
  });

  it('swallows errors thrown by listeners', () => {
    const reg = new ZoneRegistry();
    reg.register(ZONE_A);
    reg.onZoneEvent(() => {
      throw new Error('boom');
    });
    expect(() => reg.update({ x: 5, y: 2, z: 5 })).not.toThrow();
  });

  it('getAll returns all registered zones', () => {
    const reg = new ZoneRegistry();
    reg.register(ZONE_A);
    reg.register(ZONE_B);
    expect(reg.getAll()).toHaveLength(2);
  });

  it('activeZoneIds reflects current membership', () => {
    const reg = new ZoneRegistry();
    reg.register(ZONE_A);
    reg.update({ x: 5, y: 2, z: 5 });
    expect(reg.activeZoneIds).toContain('zone-a');
    reg.update({ x: 100, y: 0, z: 100 });
    expect(reg.activeZoneIds).not.toContain('zone-a');
  });

  // Listener error isolation
  it('calls remaining listeners even when one throws', () => {
    const reg = new ZoneRegistry();
    reg.register(ZONE_A);
    const called = vi.fn();
    reg.onZoneEvent(() => {
      throw new Error('bad listener');
    });
    reg.onZoneEvent(called);
    reg.update({ x: 5, y: 2, z: 5 });
    expect(called).toHaveBeenCalled();
  });
});
