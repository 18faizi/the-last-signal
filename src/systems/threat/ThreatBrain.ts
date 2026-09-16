/**
 * ThreatBrain: Reactive AI State Machine & Escalation Engine (Milestone 1.4).
 *
 * Expands the M0.9 threat foundation into a multi-phase reactive stalking AI:
 *  - 7 authored states with strict transition validation:
 *    Dormant -> Patrol -> AlertedInvestigate -> ActiveSearch ->
 *    StalkingPursuit -> EncounterResolution -> Relocate.
 *  - 3 escalation tiers tied to facility progression:
 *    Tier 1 (Post-Generator): Distant anomalies, cable tunnel rumbles, locked door glitches.
 *    Tier 2 (Post-Antenna Reveal): Active Compound & Staff Quarters patrol, room sweeps near hiding spots.
 *    Tier 3 (Climax / Final Descent): Heightened sensory range, dynamic pursuit, environmental light suppression.
 *
 * Pure TypeScript — no direct DOM or Babylon dependencies.
 */
import type { Point3 } from '../../game/facility/FacilityZone';
import type { ThreatDefinition, ThreatVisionConfig } from '../../game/threat/ThreatDefinition';
import type { ThreatNodeId } from '../../game/threat/ThreatId';

export type ThreatBrainState =
  | 'Dormant'
  | 'Patrol'
  | 'AlertedInvestigate'
  | 'ActiveSearch'
  | 'StalkingPursuit'
  | 'EncounterResolution'
  | 'Relocate';

export const ALL_BRAIN_STATES: readonly ThreatBrainState[] = [
  'Dormant',
  'Patrol',
  'AlertedInvestigate',
  'ActiveSearch',
  'StalkingPursuit',
  'EncounterResolution',
  'Relocate',
];

export type ThreatEscalationTier = 'Tier1_PostGenerator' | 'Tier2_PostAntenna' | 'Tier3_Climax';

export interface ThreatSensoryModifiers {
  /** Multiplier applied to base vision distance (e.g. 1.0 -> 1.35 in Tier 3). */
  readonly visionDistanceMultiplier: number;
  /** Multiplier applied to base FOV (degrees). */
  readonly fovMultiplier: number;
  /** Multiplier for suspicion accumulation speed. */
  readonly suspicionRateMultiplier: number;
  /** Movement speed multiplier. */
  readonly speedMultiplier: number;
  /** Radius in meters within which environmental lights are suppressed. */
  readonly lightSuppressionRadius: number;
  /** Whether the threat actively performs room sweeps across hiding spots. */
  readonly activeRoomSweeps: boolean;
}

export const TIER_CONFIGS: Readonly<Record<ThreatEscalationTier, ThreatSensoryModifiers>> = {
  Tier1_PostGenerator: {
    visionDistanceMultiplier: 0.8,
    fovMultiplier: 0.85,
    suspicionRateMultiplier: 0.7,
    speedMultiplier: 0.85,
    lightSuppressionRadius: 0,
    activeRoomSweeps: false,
  },
  Tier2_PostAntenna: {
    visionDistanceMultiplier: 1.0,
    fovMultiplier: 1.0,
    suspicionRateMultiplier: 1.0,
    speedMultiplier: 1.0,
    lightSuppressionRadius: 4.5,
    activeRoomSweeps: true,
  },
  Tier3_Climax: {
    visionDistanceMultiplier: 1.35,
    fovMultiplier: 1.2,
    suspicionRateMultiplier: 1.45,
    speedMultiplier: 1.15,
    lightSuppressionRadius: 9.0,
    activeRoomSweeps: true,
  },
};

/** Strict transition matrix for ThreatBrainState */
const BRAIN_TRANSITIONS: Readonly<Record<ThreatBrainState, readonly ThreatBrainState[]>> = {
  Dormant: ['Patrol', 'Relocate', 'AlertedInvestigate'],
  Patrol: ['AlertedInvestigate', 'ActiveSearch', 'StalkingPursuit', 'Relocate', 'Dormant'],
  AlertedInvestigate: ['ActiveSearch', 'StalkingPursuit', 'Patrol', 'Relocate'],
  ActiveSearch: [
    'StalkingPursuit',
    'AlertedInvestigate',
    'Patrol',
    'Relocate',
    'EncounterResolution',
  ],
  StalkingPursuit: ['EncounterResolution', 'ActiveSearch', 'Relocate'],
  EncounterResolution: ['Relocate', 'Dormant', 'Patrol'],
  Relocate: ['Patrol', 'ActiveSearch', 'Dormant'],
};

export function canTransitionBrainState(from: ThreatBrainState, to: ThreatBrainState): boolean {
  if (from === to) return false;
  return BRAIN_TRANSITIONS[from].includes(to);
}

export function tryTransitionBrainState(
  from: ThreatBrainState,
  to: ThreatBrainState,
): ThreatBrainState | null {
  if (!canTransitionBrainState(from, to)) return null;
  return to;
}

export interface ThreatBrainPerception {
  readonly playerPosition: Point3;
  readonly distanceToPlayer: number;
  readonly hasLineOfSight: boolean;
  readonly visionScore: number;
  readonly soundPressure: number;
  readonly lastSoundPosition: Point3 | null;
  readonly playerFullyHidden: boolean;
  readonly playerInSafeZone: boolean;
}

export interface ThreatBrainHidingSpotInfo {
  readonly id: string;
  readonly position: Point3;
  readonly fullyHidden: boolean;
}

export type ThreatBrainEvent =
  | { kind: 'StateChanged'; previous: ThreatBrainState; current: ThreatBrainState }
  | { kind: 'TierChanged'; tier: ThreatEscalationTier }
  | { kind: 'CloseProxyTension'; distance: number; tension: number; spotId?: string | undefined }
  | { kind: 'StillnessBroken'; position: Point3 }
  | { kind: 'LightSuppressionRequested'; radius: number }
  | { kind: 'SweepThresholdPauseStarted'; zoneId: string }
  | { kind: 'SweepThresholdPauseFinished'; zoneId: string };

export type ThreatBrainListener = (event: ThreatBrainEvent) => void;

/** Proximity threshold in meters where close-proxy hiding tension activates. */
export const CLOSE_PROXY_TENSION_DISTANCE = 3.0;

export class ThreatBrain {
  private state: ThreatBrainState = 'Dormant';
  private tier: ThreatEscalationTier = 'Tier1_PostGenerator';
  private readonly listeners = new Set<ThreatBrainListener>();

  private pursuitElapsed = 0;
  private losBrokenSeconds = 0;
  private investigateElapsed = 0;
  private activeSearchElapsed = 0;
  private relocateTargetNode: ThreatNodeId | null = null;

  constructor(
    private readonly baseDefinition: ThreatDefinition,
    initialTier: ThreatEscalationTier = 'Tier1_PostGenerator',
  ) {
    this.tier = initialTier;
  }

  get brainState(): ThreatBrainState {
    return this.state;
  }

  get escalationTier(): ThreatEscalationTier {
    return this.tier;
  }

  get currentModifiers(): ThreatSensoryModifiers {
    return TIER_CONFIGS[this.tier];
  }

  get effectiveVisionConfig(): ThreatVisionConfig {
    const mods = this.currentModifiers;
    const base = this.baseDefinition.vision;
    return {
      ...base,
      maxViewDistance: base.maxViewDistance * mods.visionDistanceMultiplier,
      horizontalFovDeg: Math.min(180, base.horizontalFovDeg * mods.fovMultiplier),
    };
  }

  setEscalationTier(newTier: ThreatEscalationTier): void {
    if (this.tier === newTier) return;
    this.tier = newTier;
    this.emit({ kind: 'TierChanged', tier: newTier });
    if (this.currentModifiers.lightSuppressionRadius > 0) {
      this.emit({
        kind: 'LightSuppressionRequested',
        radius: this.currentModifiers.lightSuppressionRadius,
      });
    }
  }

  subscribe(listener: ThreatBrainListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  transitionTo(target: ThreatBrainState): boolean {
    const next = tryTransitionBrainState(this.state, target);
    if (next === null) return false;
    const prev = this.state;
    this.state = next;

    // Reset timers on state change
    if (next === 'StalkingPursuit') this.pursuitElapsed = 0;
    if (next === 'AlertedInvestigate') this.investigateElapsed = 0;
    if (next === 'ActiveSearch') this.activeSearchElapsed = 0;

    this.emit({ kind: 'StateChanged', previous: prev, current: next });
    return true;
  }

  /**
   * Evaluates close-proxy tension when player is in a hiding spot.
   * Returns a tension value [0, 1] (1.0 = right on top of spot, 0.0 = >= 3m away).
   */
  evaluateHidingTension(
    threatPosition: Point3,
    hidingSpotPosition: Point3,
    spotId?: string,
  ): number {
    const dx = threatPosition.x - hidingSpotPosition.x;
    const dy = threatPosition.y - hidingSpotPosition.y;
    const dz = threatPosition.z - hidingSpotPosition.z;
    const dist = Math.hypot(dx, dy, dz);

    if (dist <= CLOSE_PROXY_TENSION_DISTANCE) {
      const tension = Math.max(0, Math.min(1, 1 - dist / CLOSE_PROXY_TENSION_DISTANCE));
      this.emit({ kind: 'CloseProxyTension', distance: dist, tension, spotId });
      return tension;
    }
    return 0;
  }

  /**
   * Called when player breaks stillness while in close proxy.
   * Immediately causes threat to investigate the hiding spot.
   */
  notifyStillnessBroken(position: Point3): void {
    this.emit({ kind: 'StillnessBroken', position: { ...position } });
    if (this.state === 'Patrol' || this.state === 'ActiveSearch') {
      this.transitionTo('AlertedInvestigate');
    }
  }

  /**
   * Ticks the brain state machine given sensory input and delta time.
   */
  update(dt: number, perception: ThreatBrainPerception, _currentPosition: Point3): void {
    if (this.state === 'Dormant') return;

    // Line of sight tracking
    if (perception.hasLineOfSight && perception.visionScore > 0) {
      this.losBrokenSeconds = 0;
    } else {
      this.losBrokenSeconds += dt;
    }

    // State machine logic
    switch (this.state) {
      case 'Patrol': {
        // High sound stimulus or sighting initiates investigation or pursuit
        if (
          perception.visionScore >= 0.8 &&
          !perception.playerFullyHidden &&
          !perception.playerInSafeZone
        ) {
          this.transitionTo('StalkingPursuit');
        } else if (perception.soundPressure >= 0.4 || perception.visionScore >= 0.3) {
          this.transitionTo('AlertedInvestigate');
        }
        break;
      }

      case 'AlertedInvestigate': {
        this.investigateElapsed += dt;
        if (
          perception.visionScore >= 0.85 &&
          !perception.playerFullyHidden &&
          !perception.playerInSafeZone
        ) {
          this.transitionTo('StalkingPursuit');
        } else if (this.investigateElapsed >= 4.0) {
          // Investigation point reached and lingered; transition to dynamic room search
          this.transitionTo('ActiveSearch');
        }
        break;
      }

      case 'ActiveSearch': {
        this.activeSearchElapsed += dt;
        if (
          perception.visionScore >= 0.85 &&
          !perception.playerFullyHidden &&
          !perception.playerInSafeZone
        ) {
          this.transitionTo('StalkingPursuit');
        } else if (perception.soundPressure >= 0.6) {
          // New loud stimulus diverts search back to investigation
          this.transitionTo('AlertedInvestigate');
        } else if (this.activeSearchElapsed >= 18.0) {
          // Search exhausted without finding player; relocate or resume patrol
          this.transitionTo('Relocate');
        }
        break;
      }

      case 'StalkingPursuit': {
        this.pursuitElapsed += dt;
        if (perception.playerInSafeZone) {
          // Player reached safety — safe zone refusal and encounter resolution
          this.transitionTo('EncounterResolution');
        } else if (this.losBrokenSeconds >= 3.5) {
          // Target lost due to broken LOS
          this.transitionTo('ActiveSearch');
        }
        break;
      }

      case 'EncounterResolution': {
        // Short pause to realize target escaped / reached safe zone, then relocate
        this.transitionTo('Relocate');
        break;
      }

      case 'Relocate': {
        // Relocating back to patrol route in next zone
        this.transitionTo('Patrol');
        break;
      }
    }
  }

  reset(): void {
    const prev = this.state;
    this.state = 'Dormant';
    this.pursuitElapsed = 0;
    this.losBrokenSeconds = 0;
    this.investigateElapsed = 0;
    this.activeSearchElapsed = 0;
    this.relocateTargetNode = null;
    if (prev !== 'Dormant') {
      this.emit({ kind: 'StateChanged', previous: prev, current: 'Dormant' });
    }
  }

  dispose(): void {
    this.listeners.clear();
  }

  private emit(event: ThreatBrainEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Do not fail engine loop on listener error
      }
    }
  }
}
