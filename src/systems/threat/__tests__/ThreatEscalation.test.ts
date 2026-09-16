import { describe, expect, it, vi } from 'vitest';
import {
  ALL_BRAIN_STATES,
  canTransitionBrainState,
  ThreatBrain,
  tryTransitionBrainState,
} from '../ThreatBrain';
import {
  angleDifference,
  isPointInVisionCone,
  normalizeAngle,
  ThreatSearchBehavior,
  type HidingSpotTarget,
} from '../ThreatSearchBehavior';
import { ManifestationDirector, type LightFixtureProxy } from '../ManifestationDirector';
import { ThreatController } from '../../../game/threat/ThreatController';
import type { ThreatDefinition } from '../../../game/threat/ThreatDefinition';
import type { ThreatNavGraph } from '../../../game/threat/behavior/ThreatSearchPattern';
import { SoundStimulusRegistry } from '../../../game/threat/perception/SoundStimulusRegistry';

const TEST_THREAT_DEF: ThreatDefinition = {
  id: 'test-threat',
  displayName: 'Test Presence',
  vision: {
    maxViewDistance: 18,
    horizontalFovDeg: 120,
    verticalToleranceMeters: 2.2,
    falloffStartDistance: 6,
    sprintMultiplier: 1.0,
    walkMultiplier: 0.7,
    crouchMultiplier: 0.35,
    peripheralPenalty: 0.45,
    behindMultiplier: 0,
  },
  suspicion: {
    suspicionGainPerSecond: 0.55,
    suspicionDecayPerSecond: 0.12,
    suspiciousThreshold: 0.3,
    investigateThreshold: 0.7,
    relaxThreshold: 0.12,
    detectionGainPerSecond: 0.65,
    detectionDecayPerSecond: 0.25,
    detectionDecayAfterLosBreakPerSecond: 0.08,
    detectionVisionFloor: 0.35,
  },
  movement: {
    moveSpeed: 2.2,
    pursuitSpeed: 4.2,
    investigationPauseSeconds: 3.0,
    searchNodePauseSeconds: 1.6,
    searchTimeoutSeconds: 26,
    pursuitLosLossSeconds: 3.5,
    captureRadius: 1.1,
  },
  homeNodeId: 'node-home',
  allowedZoneIds: ['zone-a', 'zone-b'],
  safeZoneIds: ['safe-1'],
};

const TEST_GRAPH: ThreatNavGraph = {
  nodes: [
    {
      id: 'node-home',
      position: { x: 0, y: 0, z: 0 },
      adjacency: ['node-hallway'],
      zoneId: 'zone-a',
      searchPriority: 1,
    },
    {
      id: 'node-hallway',
      position: { x: 0, y: 0, z: 10 },
      adjacency: ['node-home', 'node-room-b'],
      zoneId: 'zone-a',
      searchPriority: 2,
    },
    {
      id: 'node-room-b',
      position: { x: 5, y: 0, z: 20 },
      adjacency: ['node-hallway'],
      zoneId: 'zone-b',
      searchPriority: 3,
    },
  ],
};

describe('ThreatBrain — State Machine Transitions', () => {
  it('supports the full escalation chain: Dormant -> Patrol -> AlertedInvestigate -> ActiveSearch -> StalkingPursuit -> EncounterResolution -> Relocate -> Patrol', () => {
    expect(canTransitionBrainState('Dormant', 'Patrol')).toBe(true);
    expect(canTransitionBrainState('Patrol', 'AlertedInvestigate')).toBe(true);
    expect(canTransitionBrainState('AlertedInvestigate', 'ActiveSearch')).toBe(true);
    expect(canTransitionBrainState('ActiveSearch', 'StalkingPursuit')).toBe(true);
    expect(canTransitionBrainState('StalkingPursuit', 'EncounterResolution')).toBe(true);
    expect(canTransitionBrainState('EncounterResolution', 'Relocate')).toBe(true);
    expect(canTransitionBrainState('Relocate', 'Patrol')).toBe(true);
  });

  it('rejects illegal jumps (e.g. Dormant -> StalkingPursuit directly)', () => {
    expect(canTransitionBrainState('Dormant', 'StalkingPursuit')).toBe(false);
    expect(tryTransitionBrainState('Dormant', 'StalkingPursuit')).toBeNull();

    expect(canTransitionBrainState('Dormant', 'ActiveSearch')).toBe(false);
    expect(canTransitionBrainState('Relocate', 'StalkingPursuit')).toBe(false);
  });

  it('rejects self-transitions', () => {
    for (const state of ALL_BRAIN_STATES) {
      expect(canTransitionBrainState(state, state)).toBe(false);
      expect(tryTransitionBrainState(state, state)).toBeNull();
    }
  });

  it('allows state transitions via transitionTo and emits StateChanged events', () => {
    const brain = new ThreatBrain(TEST_THREAT_DEF);
    const events: string[] = [];
    brain.subscribe((e) => {
      if (e.kind === 'StateChanged') {
        events.push(`${e.previous}->${e.current}`);
      }
    });

    expect(brain.brainState).toBe('Dormant');
    expect(brain.transitionTo('Patrol')).toBe(true);
    expect(brain.brainState).toBe('Patrol');

    expect(brain.transitionTo('AlertedInvestigate')).toBe(true);
    expect(brain.transitionTo('ActiveSearch')).toBe(true);
    expect(brain.transitionTo('StalkingPursuit')).toBe(true);

    // Invalid transition should fail and not change state
    expect(brain.transitionTo('Dormant')).toBe(false);
    expect(brain.brainState).toBe('StalkingPursuit');

    expect(events).toEqual([
      'Dormant->Patrol',
      'Patrol->AlertedInvestigate',
      'AlertedInvestigate->ActiveSearch',
      'ActiveSearch->StalkingPursuit',
    ]);
  });
});

describe('ThreatBrain — Escalation Tiers & Modifiers', () => {
  it('correctly provides modifiers for Tier 1, Tier 2, and Tier 3', () => {
    const brain = new ThreatBrain(TEST_THREAT_DEF, 'Tier1_PostGenerator');
    expect(brain.escalationTier).toBe('Tier1_PostGenerator');
    expect(brain.currentModifiers.lightSuppressionRadius).toBe(0);
    expect(brain.currentModifiers.activeRoomSweeps).toBe(false);

    brain.setEscalationTier('Tier2_PostAntenna');
    expect(brain.escalationTier).toBe('Tier2_PostAntenna');
    expect(brain.currentModifiers.visionDistanceMultiplier).toBe(1.0);
    expect(brain.currentModifiers.lightSuppressionRadius).toBe(4.5);
    expect(brain.currentModifiers.activeRoomSweeps).toBe(true);

    brain.setEscalationTier('Tier3_Climax');
    expect(brain.escalationTier).toBe('Tier3_Climax');
    expect(brain.currentModifiers.visionDistanceMultiplier).toBe(1.35);
    expect(brain.currentModifiers.fovMultiplier).toBe(1.2);
    expect(brain.currentModifiers.lightSuppressionRadius).toBe(9.0);
    expect(brain.currentModifiers.activeRoomSweeps).toBe(true);

    // Vision config scales with tier modifiers
    const visionCfg = brain.effectiveVisionConfig;
    expect(visionCfg.maxViewDistance).toBeCloseTo(18 * 1.35);
    expect(visionCfg.horizontalFovDeg).toBeCloseTo(120 * 1.2);
  });
});

describe('ThreatBrain — Hiding Tension Mechanic ("Hold Breath / Heartbeat")', () => {
  it('evaluates tension based on <= 3.0m proximity threshold', () => {
    const brain = new ThreatBrain(TEST_THREAT_DEF);
    const spotPos = { x: 0, y: 0, z: 0 };

    // Threat at 5 meters away: tension is 0
    const tensionFar = brain.evaluateHidingTension({ x: 5, y: 0, z: 0 }, spotPos);
    expect(tensionFar).toBe(0);

    // Threat at 3.0 meters: boundary condition
    const tensionBoundary = brain.evaluateHidingTension({ x: 3.0, y: 0, z: 0 }, spotPos);
    expect(tensionBoundary).toBeCloseTo(0);

    // Threat at 1.5 meters: 50% tension
    const tensionMid = brain.evaluateHidingTension({ x: 1.5, y: 0, z: 0 }, spotPos);
    expect(tensionMid).toBeCloseTo(0.5);

    // Threat at 0.3 meters: high tension
    const tensionClose = brain.evaluateHidingTension({ x: 0.3, y: 0, z: 0 }, spotPos);
    expect(tensionClose).toBeCloseTo(0.9);
  });

  it('notifies stillness broken and escalates to AlertedInvestigate', () => {
    const brain = new ThreatBrain(TEST_THREAT_DEF);
    brain.transitionTo('Patrol');

    const listener = vi.fn();
    brain.subscribe(listener);

    brain.notifyStillnessBroken({ x: 1, y: 0, z: 1 });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'StillnessBroken',
        position: { x: 1, y: 0, z: 1 },
      }),
    );
    expect(brain.brainState).toBe('AlertedInvestigate');
  });
});

describe('ThreatSearchBehavior — Room Sweeping & Math', () => {
  it('normalizes angles and calculates signed angular differences accurately', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(Math.PI)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(-3 * Math.PI)).toBeCloseTo(-Math.PI);

    // Angle difference
    expect(angleDifference(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(angleDifference(Math.PI / 2, 0)).toBeCloseTo(-Math.PI / 2);
    expect(angleDifference(Math.PI * 0.9, -Math.PI * 0.9)).toBeCloseTo(0.2 * Math.PI);
  });

  it('calculates vision cone inclusion correctly', () => {
    const observer = { x: 0, y: 0, z: 0 };
    const facingNorth = 0; // along +Z (in Babylon atan2(dx, dz))

    // Point directly in front (north: x=0, z=10)
    const inFront = isPointInVisionCone(observer, facingNorth, { x: 0, y: 0, z: 10 }, 90, 15);
    expect(inFront.inCone).toBe(true);
    expect(inFront.distance).toBe(10);
    expect(inFront.angleDiff).toBeCloseTo(0);

    // Point behind (south: x=0, z=-10)
    const behind = isPointInVisionCone(observer, facingNorth, { x: 0, y: 0, z: -10 }, 90, 15);
    expect(behind.inCone).toBe(false);

    // Point outside max distance (z=25 > 15)
    const tooFar = isPointInVisionCone(observer, facingNorth, { x: 0, y: 0, z: 25 }, 90, 15);
    expect(tooFar.inCone).toBe(false);

    // Point at 45 degree angle with 90 degree FOV (half-FOV is 45 deg)
    const edge = isPointInVisionCone(observer, facingNorth, { x: 5, y: 0, z: 5 }, 90, 15);
    expect(edge.inCone).toBe(true);
  });

  it('detects zone threshold crossing', () => {
    const behavior = new ThreatSearchBehavior();
    const nodeA1 = TEST_GRAPH.nodes[0];
    const nodeA2 = TEST_GRAPH.nodes[1];
    const nodeB1 = TEST_GRAPH.nodes[2];
    if (!nodeA1 || !nodeA2 || !nodeB1) throw new Error('Missing test nodes');

    expect(behavior.isZoneThresholdCrossing(nodeA1, nodeA2)).toBe(false);
    expect(behavior.isZoneThresholdCrossing(nodeA2, nodeB1)).toBe(true);
  });

  it('executes room sweeping phases across hiding spots', () => {
    const behavior = new ThreatSearchBehavior({
      thresholdPauseDurationSeconds: 1.0,
      spotScanDurationSeconds: 1.0,
      sweepYawSpeedRadPerSec: 5.0,
      maxSweepDistance: 20.0,
      fovDeg: 120,
    });

    const spots: HidingSpotTarget[] = [
      {
        id: 'spot-1',
        displayName: 'Cabinet',
        zoneId: 'zone-b',
        position: { x: 4, y: 0, z: 22 },
        fullyHiding: true,
        concealment: 1.0,
      },
    ];

    behavior.beginThresholdSweep({ x: 5, y: 0, z: 20 }, 0, 'zone-b', spots);
    expect(behavior.currentPhase).toBe('ThresholdPause');
    expect(behavior.isPausedAtThreshold).toBe(true);

    // Tick past threshold pause
    behavior.update(1.1, { x: 5, y: 0, z: 20 });
    expect(behavior.currentPhase).toBe('ScanningHidingSpots');

    // Tick past hiding spot scan
    const res = behavior.update(1.1, { x: 5, y: 0, z: 20 });
    expect(res.completed).toBe(true);
    expect(behavior.currentPhase).toBe('Complete');
  });
});

describe('ManifestationDirector — Light Suppression & Atmospheric Audio', () => {
  it('suppresses lights within proximity radius and restores them when threat moves away', () => {
    const director = new ManifestationDirector('Tier2_PostAntenna');
    const fixtures: LightFixtureProxy[] = [
      { id: 'light-1', position: { x: 0, y: 0, z: 0 }, mode: 'on' },
      { id: 'light-2', position: { x: 20, y: 0, z: 0 }, mode: 'on' },
    ];

    const events: string[] = [];
    director.subscribe((e) => {
      if (e.kind === 'LightSuppressed') events.push(`suppressed:${e.fixtureId}`);
      if (e.kind === 'LightRestored') events.push(`restored:${e.fixtureId}`);
    });

    // Threat at (0, 0, 0): light-1 is at 0m (<= 5m radius), light-2 is at 20m (> 5m radius)
    director.updateLightSuppression({ x: 0, y: 0, z: 0 }, 5.0, fixtures);
    const f0 = fixtures[0];
    const f1 = fixtures[1];
    expect(f0?.mode).toBe('cut');
    expect(f1?.mode).toBe('on');
    expect(events).toContain('suppressed:light-1');

    // Threat moves to (20, 0, 0): light-1 is restored, light-2 becomes suppressed
    director.updateLightSuppression({ x: 20, y: 0, z: 0 }, 5.0, fixtures);
    expect(f0?.mode).toBe('on');
    expect(f1?.mode).toBe('cut');
    expect(events).toContain('restored:light-1');
    expect(events).toContain('suppressed:light-2');

    // Restore all lights
    director.restoreAllLights(fixtures);
    expect(f0?.mode).toBe('on');
    expect(f1?.mode).toBe('on');
  });

  it('triggers door slams and spatial sounds', () => {
    const director = new ManifestationDirector('Tier3_Climax');
    const listener = vi.fn();
    director.subscribe(listener);

    director.triggerDoorSlam('fg-door-relay');
    expect(listener).toHaveBeenCalledWith({
      kind: 'DoorGlitchRequested',
      doorId: 'fg-door-relay',
      effect: 'slam',
    });

    director.triggerAnomalousSound('creak', { x: 2, y: 1, z: 5 }, 0.9);
    expect(listener).toHaveBeenCalledWith({
      kind: 'SpatialSoundRequested',
      soundId: 'creak',
      position: { x: 2, y: 1, z: 5 },
      volume: 0.9,
    });
  });
});

describe('ThreatController Integration with Milestone 1.4 AI Systems', () => {
  it('exposes brain, brainState, searchBehavior, and tension evaluation', () => {
    const stimuli = new SoundStimulusRegistry();
    const ctrl = new ThreatController({
      definition: TEST_THREAT_DEF,
      graph: TEST_GRAPH,
      stimuli,
      isDoorPassable: () => true,
      isPositionAllowed: () => true,
      initialTier: 'Tier2_PostAntenna',
    });

    expect(ctrl.brainState).toBe('Dormant');
    expect(ctrl.brain.escalationTier).toBe('Tier2_PostAntenna');

    // Transitioning brain state updates threat controller
    const success = ctrl.transitionBrainState('Patrol');
    expect(success).toBe(true);
    expect(ctrl.brainState).toBe('Patrol');
    expect(ctrl.threatState).toBe('Unaware');

    // Tension evaluation works through ThreatController
    const tension = ctrl.evaluateHidingTension({ x: 1, y: 0, z: 0 });
    expect(tension).toBeGreaterThan(0);

    // Breaking stillness triggers investigation
    ctrl.notifyStillnessBroken({ x: 5, y: 0, z: 5 });
    expect(ctrl.brainState).toBe('AlertedInvestigate');

    ctrl.dispose();
  });
});
