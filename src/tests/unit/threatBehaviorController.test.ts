import { describe, expect, it } from 'vitest';
import {
  ThreatBehaviorController,
  type ThreatBehaviorEvents,
} from '../../game/threat/behavior/ThreatBehaviorController';
import type { ThreatNavGraph } from '../../game/threat/behavior/ThreatSearchPattern';
import type { ThreatMovementConfig } from '../../game/threat/ThreatDefinition';
import { isPlayerCaptured } from '../../game/threat/behavior/ThreatEncounterRules';

const GRAPH: ThreatNavGraph = {
  nodes: [
    { id: 'a', position: { x: 0, y: 0, z: 0 }, adjacency: ['b'], zoneId: 'z', searchPriority: 1 },
    {
      id: 'b',
      position: { x: 10, y: 0, z: 0 },
      adjacency: ['a', 'c'],
      zoneId: 'z',
      searchPriority: 2,
    },
    { id: 'c', position: { x: 10, y: 0, z: 10 }, adjacency: ['b'], zoneId: 'z', searchPriority: 3 },
  ],
};

const MOVEMENT: ThreatMovementConfig = {
  moveSpeed: 2,
  pursuitSpeed: 4,
  investigationPauseSeconds: 1,
  searchNodePauseSeconds: 0.5,
  searchTimeoutSeconds: 30,
  pursuitLosLossSeconds: 3,
  captureRadius: 1,
};

function make(events: ThreatBehaviorEvents = {}, startNode = 'a') {
  return new ThreatBehaviorController(
    { graph: GRAPH, movement: MOVEMENT, isDoorPassable: () => true, events },
    startNode,
  );
}

function tick(c: ThreatBehaviorController, seconds: number, dt = 0.05): void {
  for (let t = 0; t < seconds; t += dt) c.update(dt);
}

describe('ThreatBehaviorController — waypoint movement', () => {
  it('moves exactly speed*dt per tick and snaps onto the waypoint (frame-rate independent)', () => {
    const fine = make();
    const coarse = make();
    fine.startRouteTo('b');
    coarse.startRouteTo('b');
    for (let i = 0; i < 100; i++) fine.update(0.01); // 1 s
    for (let i = 0; i < 10; i++) coarse.update(0.1); // 1 s
    expect(fine.currentPosition.x).toBeCloseTo(2, 5);
    expect(coarse.currentPosition.x).toBeCloseTo(2, 5);
    tick(fine, 10);
    expect(fine.currentPosition.x).toBe(10); // exact snap, never overshoots
    expect(fine.behaviorMode).toBe('idle');
  });

  it('faces the movement direction while translating', () => {
    const c = make();
    c.startRouteTo('b'); // +X
    c.update(0.05);
    expect(c.currentFacingYaw).toBeCloseTo(Math.PI / 2, 3); // atan2(+x, 0)
  });

  it('reports node arrivals in route order', () => {
    const reached: string[] = [];
    const c = make({ onNodeReached: (id) => reached.push(id) });
    c.startRouteTo('c');
    tick(c, 15);
    expect(reached).toEqual(['b', 'c']);
  });

  it('refuses routes through closed doors', () => {
    const gated: ThreatNavGraph = {
      nodes: [
        {
          id: 'a',
          position: { x: 0, y: 0, z: 0 },
          adjacency: ['b'],
          zoneId: 'z',
          searchPriority: 1,
        },
        {
          id: 'b',
          position: { x: 5, y: 0, z: 0 },
          adjacency: ['a'],
          zoneId: 'z',
          searchPriority: 2,
          requiresDoorId: 'door-x',
        },
      ],
    };
    const c = new ThreatBehaviorController(
      { graph: gated, movement: MOVEMENT, isDoorPassable: () => false, events: {} },
      'a',
    );
    expect(c.startRouteTo('b')).toBe(false);
    expect(c.behaviorMode).toBe('idle');
  });
});

describe('ThreatBehaviorController — investigation', () => {
  it('moves to the node nearest the stimulus, pauses, then reports completion', () => {
    let completed = 0;
    const c = make({ onInvestigationComplete: () => completed++ });
    expect(c.startInvestigation({ x: 9, y: 0, z: 1 })).toBe(true); // nearest: b
    tick(c, 5); // travel 10 m at 2 m/s
    expect(c.currentPosition.x).toBe(10);
    expect(completed).toBe(0); // still pausing
    tick(c, 1.2);
    expect(completed).toBe(1);
    expect(c.behaviorMode).toBe('idle');
  });
});

describe('ThreatBehaviorController — search', () => {
  it('sweeps nodes deterministically and reports exhaustion', () => {
    const reached: string[] = [];
    let exhausted = 0;
    const c = make({
      onNodeReached: (id) => reached.push(id),
      onSearchExhausted: () => exhausted++,
    });
    c.startSearch({ x: 10, y: 0, z: 10 });
    tick(c, 40);
    expect(exhausted).toBe(1);
    // priority order: c (3) then b (2) — a is the start node.
    expect(reached[reached.length - 1]).toBe('b');
    expect(reached).toContain('c');
    expect(c.behaviorMode).toBe('idle');
  });

  it('withdraws after the authored search timeout even with nodes remaining', () => {
    let exhausted = 0;
    const c = new ThreatBehaviorController(
      {
        graph: GRAPH,
        movement: { ...MOVEMENT, searchTimeoutSeconds: 0.5, moveSpeed: 0.1 },
        isDoorPassable: () => true,
        events: { onSearchExhausted: () => exhausted++ },
      },
      'a',
    );
    c.startSearch({ x: 10, y: 0, z: 0 });
    tick(c, 1);
    expect(exhausted).toBe(1);
  });
});

describe('ThreatBehaviorController — pursuit and withdraw', () => {
  it('pursues the last-known position at pursuit speed without teleporting', () => {
    const c = make();
    c.startPursuit({ x: 8, y: 0, z: 0 });
    c.update(0.1);
    expect(c.currentPosition.x).toBeCloseTo(0.4, 5); // 4 m/s * 0.1 s
    tick(c, 3);
    expect(c.currentPosition.x).toBeCloseTo(8, 1); // arrived, stays put
  });

  it('updatePursuitTarget redirects an active pursuit only', () => {
    const c = make();
    c.updatePursuitTarget({ x: 5, y: 0, z: 5 }); // no-op: not pursuing
    expect(c.behaviorMode).toBe('idle');
    c.startPursuit({ x: 8, y: 0, z: 0 });
    c.updatePursuitTarget({ x: 0, y: 0, z: 8 });
    tick(c, 0.5);
    expect(c.currentPosition.z).toBeGreaterThan(0);
  });

  it('withdraws along the graph back home and reports arrival', () => {
    let arrived = 0;
    const c = make({ onWithdrawArrived: () => arrived++ }, 'c');
    expect(c.startWithdraw('a')).toBe(true);
    tick(c, 15);
    expect(arrived).toBe(1);
    expect(c.currentPosition.x).toBe(0);
    expect(c.nearestNodeId).toBe('a');
  });

  it('withdrawing while already at home resolves immediately', () => {
    let arrived = 0;
    const c = make({ onWithdrawArrived: () => arrived++ }, 'a');
    c.startWithdraw('a');
    expect(arrived).toBe(1);
  });
});

describe('ThreatEncounterRules — capture boundary', () => {
  const base = {
    threatPosition: { x: 0, y: 0, z: 0 },
    playerPosition: { x: 0.5, y: 0, z: 0 },
    captureRadius: 1,
    playerFullyHidden: false,
    playerInSafeZone: false,
  };

  it('captures inside the radius', () => {
    expect(isPlayerCaptured(base)).toBe(true);
    expect(isPlayerCaptured({ ...base, playerPosition: { x: 2, y: 0, z: 0 } })).toBe(false);
  });

  it('never captures a fully-hidden or safe player', () => {
    expect(isPlayerCaptured({ ...base, playerFullyHidden: true })).toBe(false);
    expect(isPlayerCaptured({ ...base, playerInSafeZone: true })).toBe(false);
  });
});
