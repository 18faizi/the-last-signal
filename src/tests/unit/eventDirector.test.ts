import { describe, expect, it } from 'vitest';
import { EventDirector } from '../../game/event-director/EventDirector';
import type { EventConditionContext } from '../../game/event-director/EventCondition';
import type { EventAction } from '../../game/event-director/EventAction';
import type { EventDefinition } from '../../game/event-director/EventDefinition';
import { validateEventDefinitions } from '../../game/event-director/EventValidation';
import { FACILITY_THREAT_EVENTS } from '../../scenes/facility-greybox/threat/facilityEncounterDefinitions';

interface MutableWorld {
  revealComplete: boolean;
  zoneInside: Set<string>;
  circuits: Set<string>;
  doorsOpen: Set<string>;
  items: Set<string>;
  gameplayMode: boolean;
}

function makeContext(world: MutableWorld, director: () => EventDirector): EventConditionContext {
  return {
    isAntennaRevealComplete: () => world.revealComplete,
    compareThreatPhase: () => 0,
    isZoneDiscovered: (z) => world.zoneInside.has(z),
    isZoneInside: (z) => world.zoneInside.has(z),
    isCircuitEnergized: (c) => world.circuits.has(c),
    isSignalDecoded: () => false,
    isDoorOpen: (d) => world.doorsOpen.has(d),
    hasInventoryItem: (i) => world.items.has(i),
    secondsSinceEvent: (id) => director().secondsSinceFired(id),
    getThreatState: () => 'Dormant',
    isPlayerInGameplayMode: () => world.gameplayMode,
    isEventCompleted: (id) => director().hasFired(id),
  };
}

function makeDirector(events: EventDefinition[], world?: Partial<MutableWorld>) {
  const w: MutableWorld = {
    revealComplete: false,
    zoneInside: new Set(),
    circuits: new Set(),
    doorsOpen: new Set(),
    items: new Set(),
    gameplayMode: true,
    ...world,
  };
  const executed: EventAction[] = [];
  let directorRef: EventDirector | null = null;
  const director = new EventDirector(
    makeContext(w, () => directorRef as EventDirector),
    {
      execute: (action) => executed.push(action),
    },
  );
  directorRef = director;
  for (const e of events) director.register(e);
  return { director, world: w, executed };
}

const simpleEvent = (id: string, overrides: Partial<EventDefinition> = {}): EventDefinition => ({
  id,
  label: id,
  conditions: [{ kind: 'zone-inside', zoneId: 'zone-a' }],
  dependencies: [],
  oneShot: true,
  delaySeconds: 0,
  actions: [{ kind: 'dev-message', text: id }],
  ...overrides,
});

describe('EventDirector — condition-driven firing', () => {
  it('fires only when every condition holds, in authored action order', () => {
    const { director, world, executed } = makeDirector([
      simpleEvent('e1', {
        conditions: [
          { kind: 'zone-inside', zoneId: 'zone-a' },
          { kind: 'circuit-energized', circuitId: 'c1', energized: true },
        ],
        actions: [
          { kind: 'dev-message', text: 'first' },
          { kind: 'set-light', lightId: 'l1', mode: 'blink' },
          { kind: 'dev-message', text: 'third' },
        ],
      }),
    ]);
    director.evaluate();
    expect(executed).toHaveLength(0);
    world.zoneInside.add('zone-a');
    director.evaluate();
    expect(executed).toHaveLength(0); // circuit still missing
    world.circuits.add('c1');
    director.evaluate();
    expect(executed.map((a) => a.kind)).toEqual(['dev-message', 'set-light', 'dev-message']);
    expect(director.getState('e1')).toBe('Fired');
  });

  it('one-shot events never refire; repeatable events re-arm after conditions drop', () => {
    const { director, world, executed } = makeDirector([
      simpleEvent('once'),
      simpleEvent('again', { oneShot: false }),
    ]);
    world.zoneInside.add('zone-a');
    director.evaluate();
    director.evaluate();
    expect(executed.filter((a) => a.kind === 'dev-message')).toHaveLength(2); // once each
    // Drop + restore conditions: only the repeatable event re-fires.
    world.zoneInside.delete('zone-a');
    director.evaluate();
    world.zoneInside.add('zone-a');
    director.evaluate();
    const texts = executed.map((a) => (a.kind === 'dev-message' ? a.text : ''));
    expect(texts.filter((t) => t === 'once')).toHaveLength(1);
    expect(texts.filter((t) => t === 'again')).toHaveLength(2);
  });

  it('dependencies gate firing until every dependency has fired', () => {
    const { director, world, executed } = makeDirector([
      simpleEvent('parent', { conditions: [{ kind: 'zone-inside', zoneId: 'zone-p' }] }),
      simpleEvent('child', { dependencies: ['parent'] }),
    ]);
    world.zoneInside.add('zone-a'); // child's own condition holds
    director.evaluate();
    expect(director.hasFired('child')).toBe(false);
    world.zoneInside.add('zone-p');
    director.evaluate();
    expect(director.hasFired('parent')).toBe(true);
    expect(director.hasFired('child')).toBe(true);
    expect(executed.length).toBe(2);
  });

  it('delays fire through update() and can be cancelled while pending', () => {
    const { director, world, executed } = makeDirector([
      simpleEvent('slow', { delaySeconds: 1 }),
      simpleEvent('doomed', { delaySeconds: 1 }),
    ]);
    world.zoneInside.add('zone-a');
    director.evaluate();
    expect(director.getState('slow')).toBe('PendingDelay');
    director.cancel('doomed');
    director.update(0.6);
    expect(executed).toHaveLength(0);
    director.update(0.6);
    expect(director.hasFired('slow')).toBe(true);
    expect(director.getState('doomed')).toBe('Cancelled');
    expect(director.hasFired('doomed')).toBe(false);
  });

  it('time-since-event conditions hold only after enough director-clock time', () => {
    const { director, world } = makeDirector([
      simpleEvent('first'),
      simpleEvent('later', {
        conditions: [
          { kind: 'zone-inside', zoneId: 'zone-a' },
          { kind: 'time-since-event', eventId: 'first', seconds: 2 },
        ],
        dependencies: ['first'],
      }),
    ]);
    world.zoneInside.add('zone-a');
    director.evaluate();
    expect(director.hasFired('first')).toBe(true);
    expect(director.hasFired('later')).toBe(false);
    director.update(1);
    expect(director.hasFired('later')).toBe(false);
    director.update(1.5);
    expect(director.hasFired('later')).toBe(true);
  });

  it('a throwing action never blocks the remaining actions', () => {
    const failures: string[] = [];
    let directorRef: EventDirector | null = null;
    const world: MutableWorld = {
      revealComplete: false,
      zoneInside: new Set(['zone-a']),
      circuits: new Set(),
      doorsOpen: new Set(),
      items: new Set(),
      gameplayMode: true,
    };
    const executed: EventAction[] = [];
    const director = new EventDirector(
      makeContext(world, () => directorRef as EventDirector),
      {
        execute: (action) => {
          if (action.kind === 'set-light') throw new Error('boom');
          executed.push(action);
        },
      },
      (eventId, action) => failures.push(`${eventId}:${action.kind}`),
    );
    directorRef = director;
    director.register(
      simpleEvent('mixed', {
        actions: [
          { kind: 'set-light', lightId: 'l1', mode: 'on' },
          { kind: 'dev-message', text: 'after-failure' },
        ],
      }),
    );
    director.evaluate();
    expect(failures).toEqual(['mixed:set-light']);
    expect(executed.map((a) => a.kind)).toEqual(['dev-message']);
  });

  it('reset restores every event to Idle and zeroes the clock', () => {
    const { director, world } = makeDirector([simpleEvent('e1', { delaySeconds: 0 })]);
    world.zoneInside.add('zone-a');
    director.evaluate();
    director.update(5);
    director.reset();
    expect(director.getState('e1')).toBe('Idle');
    expect(director.hasFired('e1')).toBe(false);
    expect(director.secondsSinceFired('e1')).toBeNull();
    // Re-fires after reset (dev replay path).
    director.evaluate();
    expect(director.hasFired('e1')).toBe(true);
  });

  it('rejects duplicate event ids', () => {
    const { director } = makeDirector([simpleEvent('dup')]);
    expect(() => director.register(simpleEvent('dup'))).toThrow();
  });
});

describe('EventValidation', () => {
  it('accepts the authored facility events', () => {
    expect(validateEventDefinitions(FACILITY_THREAT_EVENTS)).toEqual([]);
  });

  it('flags unknown, self and circular dependencies', () => {
    const problems = validateEventDefinitions([
      simpleEvent('a', { dependencies: ['ghost', 'a', 'b'] }),
      simpleEvent('b', { dependencies: ['c'] }),
      simpleEvent('c', { dependencies: ['b'] }),
    ]);
    expect(problems.some((p) => p.includes('unknown dependency "ghost"'))).toBe(true);
    expect(problems.some((p) => p.includes('depends on itself'))).toBe(true);
    expect(problems.some((p) => p.includes('circular'))).toBe(true);
  });

  it('flags negative delays, empty actions and unknown condition references', () => {
    const problems = validateEventDefinitions([
      simpleEvent('bad', {
        delaySeconds: -1,
        actions: [],
        conditions: [{ kind: 'time-since-event', eventId: 'nope', seconds: 1 }],
      }),
    ]);
    expect(problems.some((p) => p.includes('delaySeconds'))).toBe(true);
    expect(problems.some((p) => p.includes('at least one action'))).toBe(true);
    expect(problems.some((p) => p.includes('unknown event "nope"'))).toBe(true);
  });

  it('flags duplicate ids', () => {
    const problems = validateEventDefinitions([simpleEvent('dup'), simpleEvent('dup')]);
    expect(problems.some((p) => p.includes('duplicate'))).toBe(true);
  });
});
