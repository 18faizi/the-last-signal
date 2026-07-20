import { describe, expect, it } from 'vitest';
import { SoundStimulusRegistry } from '../../game/threat/perception/SoundStimulusRegistry';
import { ThreatController, type ThreatPerceptionInput } from '../../game/threat/ThreatController';
import { ThreatError } from '../../game/threat/ThreatError';
import type { ThreatDefinition } from '../../game/threat/ThreatDefinition';
import type { ThreatNavGraph } from '../../game/threat/behavior/ThreatSearchPattern';
import type { ThreatEvent } from '../../game/threat/ThreatEvent';

const GRAPH: ThreatNavGraph = {
  nodes: [
    {
      id: 'home',
      position: { x: 0, y: 0, z: 0 },
      adjacency: ['mid'],
      zoneId: 'z',
      searchPriority: 1,
    },
    {
      id: 'mid',
      position: { x: 6, y: 0, z: 0 },
      adjacency: ['home', 'far'],
      zoneId: 'z',
      searchPriority: 2,
    },
    {
      id: 'far',
      position: { x: 12, y: 0, z: 0 },
      adjacency: ['mid'],
      zoneId: 'z',
      searchPriority: 3,
    },
  ],
};

const DEFINITION: ThreatDefinition = {
  id: 'test-threat',
  displayName: 'Test Threat',
  vision: {
    maxViewDistance: 20,
    horizontalFovDeg: 360, // orientation-independent for these tests
    verticalToleranceMeters: 3,
    falloffStartDistance: 20,
    sprintMultiplier: 1,
    walkMultiplier: 1,
    crouchMultiplier: 0.4,
    peripheralPenalty: 1,
    behindMultiplier: 1,
  },
  suspicion: {
    suspicionGainPerSecond: 2,
    suspicionDecayPerSecond: 0.5,
    suspiciousThreshold: 0.3,
    investigateThreshold: 0.7,
    relaxThreshold: 0.1,
    detectionGainPerSecond: 2,
    detectionDecayPerSecond: 0.5,
    detectionDecayAfterLosBreakPerSecond: 0.1,
    detectionVisionFloor: 0.4,
  },
  movement: {
    moveSpeed: 3,
    pursuitSpeed: 4,
    investigationPauseSeconds: 0.5,
    searchNodePauseSeconds: 0.2,
    searchTimeoutSeconds: 8,
    pursuitLosLossSeconds: 1,
    captureRadius: 1.2,
  },
  homeNodeId: 'home',
  allowedZoneIds: ['z'],
  safeZoneIds: [],
};

function make(allowed: (p: { x: number; z: number }) => boolean = () => true) {
  const stimuli = new SoundStimulusRegistry();
  const controller = new ThreatController({
    definition: DEFINITION,
    graph: GRAPH,
    stimuli,
    isDoorPassable: () => true,
    isPositionAllowed: (p) => allowed(p),
  });
  const events: ThreatEvent[] = [];
  controller.subscribe((e) => events.push(e));
  return { controller, stimuli, events };
}

const QUIET: ThreatPerceptionInput = {
  playerPosition: { x: 100, y: 0, z: 100 }, // far outside vision
  playerStance: 'still',
  losBlocked: true,
  exposure: 1,
  playerFullyHidden: false,
  playerInSafeZone: false,
};

// Far enough (10 m) that the 2 s escalation window never closes to the
// capture radius during setup — capture is exercised explicitly.
const SEEN: ThreatPerceptionInput = {
  playerPosition: { x: 10, y: 0, z: 0 },
  playerStance: 'sprint',
  losBlocked: false,
  exposure: 1,
  playerFullyHidden: false,
  playerInSafeZone: false,
};

function tick(c: ThreatController, seconds: number, input: ThreatPerceptionInput, dt = 0.05): void {
  for (let t = 0; t < seconds; t += dt) c.update(dt, input);
}

describe('ThreatController — activation and legality', () => {
  it('starts Dormant, performs no work when ticked dormant', () => {
    const { controller } = make();
    expect(controller.threatState).toBe('Dormant');
    controller.update(0.05, SEEN);
    expect(controller.threatState).toBe('Dormant');
    expect(controller.getSnapshot().suspicion).toBe(0);
  });

  it('manifest -> observe -> patrol path follows the table', () => {
    const { controller } = make();
    controller.manifestAt('mid');
    expect(controller.threatState).toBe('Manifesting');
    controller.resolveManifestation('observe');
    expect(controller.threatState).toBe('Observing');
    controller.beginPatrol('far');
    expect(controller.threatState).toBe('Unaware');
  });

  it('rejects illegal commands with a typed ThreatError', () => {
    const { controller } = make();
    expect(() => controller.resolveManifestation('observe')).toThrow(ThreatError);
    controller.manifestAt('mid');
    expect(() => controller.manifestAt('mid')).toThrow(ThreatError);
  });

  it('a Manifesting threat never perceives (no suspicion while staged)', () => {
    const { controller } = make();
    controller.manifestAt('mid');
    tick(controller, 2, SEEN);
    expect(controller.getSnapshot().suspicion).toBe(0);
  });
});

describe('ThreatController — perception-driven escalation', () => {
  it('escalates Unaware -> Suspicious -> Investigating from sustained sight', () => {
    const { controller, events } = make();
    controller.activateUnawareAt('home');
    tick(controller, 0.2, SEEN);
    expect(controller.threatState).toBe('Suspicious');
    tick(controller, 0.5, SEEN);
    expect(['Investigating', 'Pursuing']).toContain(controller.threatState);
    expect(events.some((e) => e.kind === 'SuspicionRaised')).toBe(true);
    expect(events.some((e) => e.kind === 'InvestigationStarted')).toBe(true);
  });

  it('confirms detection once and pursues; the one-shot never refires', () => {
    const { controller, events } = make();
    controller.activateUnawareAt('home');
    tick(controller, 2, SEEN);
    expect(controller.threatState).toBe('Pursuing');
    expect(events.filter((e) => e.kind === 'FullDetection')).toHaveLength(1);
    expect(events.filter((e) => e.kind === 'PursuitStarted')).toHaveLength(1);
  });

  it('a fully-hidden player generates zero vision and no escalation', () => {
    const { controller } = make();
    controller.activateUnawareAt('home');
    tick(controller, 3, { ...SEEN, playerFullyHidden: true });
    expect(controller.threatState).toBe('Unaware');
    expect(controller.getSnapshot().suspicion).toBe(0);
  });

  it('sound stimuli raise suspicion without sight (and while hiding)', () => {
    const { controller, stimuli } = make();
    controller.activateUnawareAt('home');
    stimuli.emit({
      position: { x: 1, y: 0, z: 0 },
      intensity: 1,
      radius: 10,
      category: 'door-operation',
      durationSeconds: 5,
      source: 'door',
    });
    tick(controller, 0.3, { ...QUIET, playerFullyHidden: true });
    expect(controller.getSnapshot().suspicion).toBeGreaterThan(0.3);
    expect(controller.threatState).toBe('Suspicious');
  });

  it('suspicion decays back to Unaware when nothing more is perceived', () => {
    const { controller, events } = make();
    controller.activateUnawareAt('home');
    tick(controller, 0.25, SEEN); // just past Suspicious
    expect(controller.threatState).toBe('Suspicious');
    tick(controller, 5, QUIET);
    expect(controller.threatState).toBe('Unaware');
    expect(events.some((e) => e.kind === 'SuspicionCleared')).toBe(true);
  });
});

describe('ThreatController — pursuit, loss, search, withdraw', () => {
  function pursue() {
    const made = make();
    made.controller.activateUnawareAt('home');
    tick(made.controller, 2, SEEN);
    expect(made.controller.threatState).toBe('Pursuing');
    return made;
  }

  it('tracks only the last-known position after LOS breaks, then loses the target', () => {
    const { controller, events } = pursue();
    const lastSeen = controller.getSnapshot().lastKnownPlayerPosition;
    expect(lastSeen).not.toBeNull();
    tick(controller, 1.5, { ...SEEN, losBlocked: true, playerPosition: { x: -50, y: 0, z: -50 } });
    // The stale last-known position must NOT follow the unseen player.
    const snap = controller.getSnapshot();
    expect(snap.lastKnownPlayerPosition?.x).toBe(lastSeen?.x);
    expect(events.some((e) => e.kind === 'TargetLost')).toBe(true);
    expect(events.some((e) => e.kind === 'SearchStarted')).toBe(true);
    expect(['LostTarget', 'Searching']).toContain(controller.threatState);
  });

  it('an exhausted search withdraws to home and goes Dormant', () => {
    const { controller, events } = pursue();
    tick(controller, 1.5, { ...QUIET }); // lose target -> search
    tick(controller, 30, QUIET); // search timeout -> withdraw -> home
    expect(controller.threatState).toBe('Dormant');
    expect(events.some((e) => e.kind === 'SearchExhausted')).toBe(true);
    expect(events.some((e) => e.kind === 'WithdrawCompleted')).toBe(true);
    expect(events.some((e) => e.kind === 'ThreatDeactivated')).toBe(true);
    expect(controller.position.x).toBe(0);
  });

  it('emits PlayerCaptured exactly once at the capture boundary', () => {
    const { controller, events } = pursue();
    tick(controller, 2, { ...SEEN, playerPosition: { x: controller.position.x, y: 0, z: 0 } });
    expect(events.filter((e) => e.kind === 'PlayerCaptured')).toHaveLength(1);
  });

  it('never captures and instead refuses at a safe zone', () => {
    const { controller, events } = pursue();
    tick(controller, 2, {
      ...SEEN,
      playerPosition: { x: controller.position.x, y: 0, z: 0 },
      playerInSafeZone: true,
    });
    expect(events.some((e) => e.kind === 'PlayerCaptured')).toBe(false);
    expect(events.filter((e) => e.kind === 'SafeZoneRefusal')).toHaveLength(1);
  });

  it('withdraw(final) ends Inactive instead of Dormant', () => {
    const { controller } = make();
    controller.activateUnawareAt('mid');
    controller.withdraw(true);
    tick(controller, 10, QUIET);
    expect(controller.threatState).toBe('Inactive');
  });

  it('confinement reverts any step outside the allowed area', () => {
    const { controller } = make((p) => p.x <= 6.5);
    controller.activateUnawareAt('mid'); // x = 6
    tick(controller, 2, { ...SEEN, playerPosition: { x: 15, y: 0, z: 0 } });
    // Pursuit presses toward x=15 but is clamped at the boundary.
    expect(controller.position.x).toBeLessThanOrEqual(6.5);
  });
});

describe('ThreatController — encounter retry and reset', () => {
  it('resetForEncounterRetry re-arms perception via legal transitions only', () => {
    const { controller, events } = make();
    controller.activateUnawareAt('home');
    tick(controller, 2, SEEN); // Pursuing, detection fired
    controller.resetForEncounterRetry('mid');
    expect(controller.threatState).toBe('Unaware');
    const snap = controller.getSnapshot();
    expect(snap.suspicion).toBe(0);
    expect(snap.detection).toBe(0);
    expect(snap.lastKnownPlayerPosition).toBeNull();
    expect(snap.position.x).toBe(6);
    // Detection one-shot re-armed: a full re-detection fires again.
    tick(controller, 2, SEEN);
    expect(events.filter((e) => e.kind === 'FullDetection')).toHaveLength(2);
  });

  it('an Inactive threat never resumes via retry (full reset only)', () => {
    const { controller } = make();
    controller.activateUnawareAt('mid');
    controller.withdraw(true);
    tick(controller, 10, QUIET);
    expect(controller.threatState).toBe('Inactive');
    controller.resetForEncounterRetry('home');
    expect(controller.threatState).toBe('Inactive');
    controller.reset();
    expect(controller.threatState).toBe('Dormant');
  });

  it('simulateFault holds the Fault state; only reset clears it', () => {
    const { controller } = make();
    controller.activateUnawareAt('home');
    controller.simulateFault();
    expect(controller.threatState).toBe('Fault');
    tick(controller, 2, SEEN);
    expect(controller.threatState).toBe('Fault');
    controller.resetForEncounterRetry('home');
    expect(controller.threatState).toBe('Fault');
    controller.reset();
    expect(controller.threatState).toBe('Dormant');
  });
});
