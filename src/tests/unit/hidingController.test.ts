import { describe, expect, it } from 'vitest';
import { HidingController } from '../../game/threat/stealth/HidingController';
import { HidingSpotRegistry } from '../../game/threat/stealth/HidingSpotRegistry';
import { NOT_CONCEALED } from '../../game/threat/stealth/ConcealmentState';
import type { HidingSpotDefinition } from '../../game/threat/stealth/HidingSpotDefinition';
import { SafeZoneRegistry } from '../../game/threat/stealth/SafeZoneRegistry';
import type { SafeZoneDefinition } from '../../game/threat/stealth/SafeZoneDefinition';
import { canTransitionMode, isOverlayMode } from '../../game/interaction/InteractionMode';

function spot(id: string, overrides: Partial<HidingSpotDefinition> = {}): HidingSpotDefinition {
  return {
    id,
    kind: 'locker',
    displayName: id.toUpperCase(),
    zoneId: 'zone-1',
    entryPosition: { x: 0, y: 0, z: 0 },
    colliderPosition: { x: 0.5, y: 0, z: 0 },
    cameraPosition: { x: 0.5, y: 1.5, z: 0 },
    exitPosition: { x: 0, y: 0, z: 0 },
    facingYaw: 0,
    lookYawLimit: 0.3,
    concealment: 1,
    fullyHiding: true,
    inspectable: true,
    interactionDistance: 2,
    ...overrides,
  };
}

function make() {
  const registry = new HidingSpotRegistry();
  registry.register(spot('locker-1'));
  registry.register(spot('desk-1', { kind: 'under-desk', concealment: 0.8, fullyHiding: false }));
  const controller = new HidingController(registry);
  return { registry, controller };
}

describe('HidingSpotRegistry', () => {
  it('rejects duplicate ids and validates zones + definition invariants', () => {
    const { registry } = make();
    expect(() => registry.register(spot('locker-1'))).toThrow();
    expect(registry.validate(['zone-1'])).toEqual([]);
    expect(registry.validate(['other-zone']).length).toBeGreaterThan(0);
  });

  it('flags fullyHiding spots with partial concealment as invalid', () => {
    const bad = new HidingSpotRegistry();
    bad.register(spot('bad', { concealment: 0.5, fullyHiding: true }));
    expect(bad.validate(['zone-1']).some((p) => p.includes('concealment 1'))).toBe(true);
  });

  it('enforces single occupancy', () => {
    const { registry } = make();
    expect(registry.tryOccupy('locker-1')).toBe(true);
    expect(registry.tryOccupy('desk-1')).toBe(false);
    registry.release('locker-1');
    expect(registry.tryOccupy('desk-1')).toBe(true);
  });
});

describe('HidingController', () => {
  it('enter/exit round-trip updates occupancy and emits typed events', () => {
    const { registry, controller } = make();
    const events: string[] = [];
    controller.subscribe((e) => events.push(`${e.kind}:${e.spotId}`));
    const def = controller.enter('locker-1');
    expect(def?.id).toBe('locker-1');
    expect(controller.isHiding).toBe(true);
    expect(registry.occupiedSpotId).toBe('locker-1');
    const exited = controller.exit();
    expect(exited?.id).toBe('locker-1');
    expect(controller.isHiding).toBe(false);
    expect(registry.occupiedSpotId).toBeNull();
    expect(events).toEqual(['entered:locker-1', 'exited:locker-1']);
  });

  it('cannot enter a second spot while hiding, or unknown spots', () => {
    const { controller } = make();
    controller.enter('locker-1');
    expect(controller.enter('desk-1')).toBeNull();
    expect(controller.exit()).not.toBeNull();
    expect(controller.enter('ghost')).toBeNull();
  });

  it('exposes explicit concealment data — never inferred from meshes', () => {
    const { controller } = make();
    expect(controller.getConcealment()).toEqual(NOT_CONCEALED);
    controller.enter('desk-1');
    expect(controller.getConcealment()).toEqual({
      hidden: true,
      spotId: 'desk-1',
      concealment: 0.8,
      fullyHidden: false,
    });
    controller.exit();
    controller.enter('locker-1');
    expect(controller.getConcealment().fullyHidden).toBe(true);
  });

  it('exit when not hiding is a safe no-op; reset vacates', () => {
    const { registry, controller } = make();
    expect(controller.exit()).toBeNull();
    controller.enter('locker-1');
    controller.reset();
    expect(controller.isHiding).toBe(false);
    expect(registry.occupiedSpotId).toBeNull();
  });
});

describe('Hiding interaction mode (central table)', () => {
  it('hiding is entered via transitioning and exits only to gameplay', () => {
    expect(canTransitionMode('transitioning', 'hiding')).toBe(true);
    expect(canTransitionMode('hiding', 'gameplay')).toBe(true);
  });

  it('blocks inventory/receiver/panels/reading/inspection while hiding', () => {
    for (const target of [
      'inventory',
      'receiver',
      'power-panel',
      'antenna-panel',
      'reading',
      'inspecting',
      'holding',
    ] as const) {
      expect(canTransitionMode('hiding', target)).toBe(false);
    }
  });

  it('hiding cannot be entered from other overlay modes', () => {
    for (const from of ['inventory', 'receiver', 'power-panel', 'reading'] as const) {
      expect(canTransitionMode(from, 'hiding')).toBe(false);
    }
  });

  it('hiding suspends gameplay input (overlay-mode classification)', () => {
    expect(isOverlayMode('hiding')).toBe(true);
  });
});

describe('SafeZoneRegistry', () => {
  const zone: SafeZoneDefinition = {
    id: 'safe-1',
    displayName: 'Safe Room',
    aabb: { minX: 0, minY: 0, minZ: 0, maxX: 4, maxY: 3, maxZ: 4 },
    resolvesEncounterIds: ['enc-1'],
    threatEnterable: false,
    detectionDecays: true,
    checkpointId: 'cp-1',
  };

  it('answers containment queries', () => {
    const registry = new SafeZoneRegistry();
    registry.register(zone);
    expect(registry.isInsideAny({ x: 2, y: 1, z: 2 })).toBe(true);
    expect(registry.isInsideAny({ x: 9, y: 1, z: 2 })).toBe(false);
    expect(registry.zoneContaining({ x: 2, y: 1, z: 2 })?.id).toBe('safe-1');
  });

  it('validates checkpoint links and the threat-enterable invariant', () => {
    const registry = new SafeZoneRegistry();
    registry.register(zone);
    expect(registry.validate(['cp-1'])).toEqual([]);
    expect(registry.validate([]).some((p) => p.includes('checkpoint'))).toBe(true);

    const bad = new SafeZoneRegistry();
    bad.register({ ...zone, id: 'bad', threatEnterable: true });
    expect(bad.validate(['cp-1']).some((p) => p.includes('threatEnterable'))).toBe(true);
  });

  it('rejects duplicate ids', () => {
    const registry = new SafeZoneRegistry();
    registry.register(zone);
    expect(() => registry.register(zone)).toThrow();
  });
});
