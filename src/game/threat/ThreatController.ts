/**
 * Threat orchestrator (Milestone 0.9): composes the state machine,
 * perception (vision + suspicion + sound) and behavior (graph movement)
 * into one Babylon-free controller.
 *
 * Ticking contract: the scene adapter (buildThreatEventBindings.ts) owns
 * ONE scoped onBeforeRenderObservable subscription that exists ONLY while
 * the threat is active — a Dormant/Inactive/Fault threat is never ticked,
 * performs zero raycasts and zero perception work. The adapter feeds
 * update() a plain ThreatPerceptionInput (player position/stance, the
 * LOS-blocked boolean from its reused-ray occlusion probe, exposure,
 * hiding/safe-zone flags); this class never touches the scene.
 *
 * No omniscience: everything the threat knows arrives through that input.
 * The last-known player position updates ONLY while unbroken line of sight
 * yields a positive vision score — a hidden or unseen player is tracked by
 * stale data, never live position.
 */
import type { Point3 } from '../facility/FacilityZone';
import { ThreatBehaviorController } from './behavior/ThreatBehaviorController';
import type { ThreatNavGraph } from './behavior/ThreatSearchPattern';
import { isPlayerCaptured } from './behavior/ThreatEncounterRules';
import { evaluateVision, type PlayerStance } from './perception/VisionEvaluator';
import { SuspicionController } from './perception/SuspicionController';
import type { SoundStimulusRegistry } from './perception/SoundStimulusRegistry';
import type { ThreatDefinition } from './ThreatDefinition';
import { ThreatError } from './ThreatError';
import { ThreatEventBus, type ThreatEvent } from './ThreatEvent';
import type { ThreatNodeId } from './ThreatId';
import type { ThreatControllerSnapshot } from './ThreatSnapshot';
import {
  isThreatActive,
  isThreatPerceiving,
  tryTransitionThreatState,
  type ThreatState,
} from './ThreatState';

export interface ThreatPerceptionInput {
  readonly playerPosition: Point3;
  readonly playerStance: PlayerStance;
  /** Occlusion probe result from the scene adapter (reused ray, cadenced). */
  readonly losBlocked: boolean;
  /** 0-1 exposure from ExposureEvaluator (computed by the adapter). */
  readonly exposure: number;
  readonly playerFullyHidden: boolean;
  readonly playerInSafeZone: boolean;
}

export interface ThreatControllerDeps {
  readonly definition: ThreatDefinition;
  readonly graph: ThreatNavGraph;
  readonly stimuli: SoundStimulusRegistry;
  readonly isDoorPassable: (doorId: string) => boolean;
  /** Confinement test: false when a position leaves encounter-approved zones. */
  readonly isPositionAllowed: (position: Point3) => boolean;
}

/** Stimulus strength an Observing/Unaware threat reacts to immediately. */
const OBSERVING_REACT_THRESHOLD = 0.4;

export class ThreatController {
  private state: ThreatState = 'Dormant';
  private readonly bus = new ThreatEventBus();
  private readonly suspicionCtrl: SuspicionController;
  private readonly behavior: ThreatBehaviorController;

  private lastKnownPlayerPosition: Point3 | null = null;
  private lastStimulusPosition: Point3 | null = null;
  private hasLos = false;
  private lastVisionScore = 0;
  private losBrokenSeconds = 0;
  private withdrawToInactive = false;
  private captureEmitted = false;
  private safeZoneRefusalEmitted = false;

  private investigationDone = false;
  private searchDone = false;
  private withdrawDone = false;
  /**
   * EDGE flag set by the suspicion controller's one-shot full-detection
   * event. Pursuit begins on this edge exactly once per encounter — the
   * LEVEL flag (hasFullDetectionFired) stays true afterwards, and using it
   * directly would chain LostTarget -> Searching straight back into
   * Pursuing forever.
   */
  private pendingPursuit = false;

  constructor(private readonly deps: ThreatControllerDeps) {
    this.suspicionCtrl = new SuspicionController(deps.definition.suspicion);
    this.suspicionCtrl.subscribe(() => {
      this.pendingPursuit = true;
    });
    this.behavior = new ThreatBehaviorController(
      {
        graph: deps.graph,
        movement: deps.definition.movement,
        isDoorPassable: deps.isDoorPassable,
        events: {
          onNodeReached: (nodeId) => this.emit({ kind: 'NodeReached', nodeId }),
          onInvestigationComplete: () => {
            this.investigationDone = true;
          },
          onSearchExhausted: () => {
            this.searchDone = true;
          },
          onWithdrawArrived: () => {
            this.withdrawDone = true;
          },
        },
      },
      deps.definition.homeNodeId,
    );
  }

  // ----- read ------------------------------------------------------------

  get threatState(): ThreatState {
    return this.state;
  }

  get isActive(): boolean {
    return isThreatActive(this.state);
  }

  get position(): Readonly<Point3> {
    return this.behavior.currentPosition;
  }

  get facingYaw(): number {
    return this.behavior.currentFacingYaw;
  }

  getSnapshot(): ThreatControllerSnapshot {
    const suspicionSnap = this.suspicionCtrl.getSnapshot();
    return {
      id: this.deps.definition.id,
      state: this.state,
      active: this.isActive,
      position: { ...this.behavior.currentPosition },
      facingYaw: this.behavior.currentFacingYaw,
      behaviorMode: this.behavior.behaviorMode,
      currentNodeId: this.behavior.nearestNodeId,
      suspicion: suspicionSnap.suspicion,
      detection: suspicionSnap.detection,
      fullDetectionFired: suspicionSnap.fullDetectionFired,
      lastKnownPlayerPosition:
        this.lastKnownPlayerPosition !== null ? { ...this.lastKnownPlayerPosition } : null,
      hasLineOfSight: this.hasLos,
      visionScore: this.lastVisionScore,
      remainingSearchNodes: [...this.behavior.remainingSearchNodes],
    };
  }

  subscribe(listener: (event: ThreatEvent) => void): () => void {
    return this.bus.subscribe(listener);
  }

  // ----- commands (event director / scene bindings) -----------------------

  /** Dormant -> Manifesting at a node (staged presence; no perception yet). */
  manifestAt(nodeId: ThreatNodeId): void {
    this.transitionOrThrow('Manifesting');
    this.behavior.placeAtNode(nodeId);
    this.emit({ kind: 'ThreatActivated', nodeId });
  }

  /** Manifesting -> Observing | Inactive. */
  resolveManifestation(outcome: 'observe' | 'inactive'): void {
    if (outcome === 'observe') {
      this.transitionOrThrow('Observing');
    } else {
      this.transitionOrThrow('Inactive');
      this.emit({ kind: 'ThreatDeactivated' });
    }
  }

  /** Dormant -> Unaware at a node (active patrol without a staged reveal). */
  activateUnawareAt(nodeId: ThreatNodeId): void {
    this.transitionOrThrow('Unaware');
    this.behavior.placeAtNode(nodeId);
    this.suspicionCtrl.resetEncounter();
    this.emit({ kind: 'ThreatActivated', nodeId });
  }

  /** Observing -> Unaware (begin active patrol toward an optional node). */
  beginPatrol(targetNodeId?: ThreatNodeId): void {
    this.transitionOrThrow('Unaware');
    if (targetNodeId !== undefined) {
      this.behavior.startRouteTo(targetNodeId);
    }
  }

  /** Directed investigation of an authored position (event director action). */
  commandInvestigate(position: Point3): void {
    if (this.state !== 'Observing' && this.state !== 'Suspicious' && this.state !== 'Unaware') {
      if (this.state === 'Searching') {
        // A searching threat redirects legally through Investigating.
        this.transitionOrThrow('Investigating');
        this.investigationDone = false;
        this.lastStimulusPosition = { ...position };
        this.behavior.startInvestigation(position);
        this.emit({ kind: 'InvestigationStarted', position: { ...position } });
      }
      return;
    }
    if (this.state === 'Unaware') {
      // Legal path: Unaware -> Suspicious -> Investigating.
      this.transitionOrThrow('Suspicious');
    }
    this.transitionOrThrow('Investigating');
    this.investigationDone = false;
    this.lastStimulusPosition = { ...position };
    this.behavior.startInvestigation(position);
    this.emit({ kind: 'InvestigationStarted', position: { ...position } });
  }

  /** Any active state -> Withdrawing; ends at Dormant (or Inactive when final). */
  withdraw(final = false): void {
    if (!isThreatActive(this.state)) return;
    this.withdrawToInactive = final;
    this.transitionOrThrow('Withdrawing');
    this.withdrawDone = false;
    this.emit({ kind: 'WithdrawStarted' });
    const started = this.behavior.startWithdraw(this.deps.definition.homeNodeId);
    if (!started) {
      // Unreachable home (should be impossible in validated graphs): resolve
      // in place rather than wandering.
      this.withdrawDone = true;
    }
  }

  /**
   * Encounter failure retry: walks the LEGAL path current -> Withdrawing ->
   * Dormant -> Unaware, so the transition table is never bypassed, then
   * re-places the actor (invisible behind the failure fade) and re-arms
   * perception. Only encounter/threat state is touched.
   */
  resetForEncounterRetry(nodeId: ThreatNodeId): void {
    if (isThreatActive(this.state)) {
      this.transitionOrThrow('Withdrawing');
      this.transitionOrThrow('Dormant');
    } else if (this.state !== 'Dormant') {
      // Inactive/Fault never resume via retry — full dev reset only.
      return;
    }
    this.behavior.placeAtNode(nodeId);
    this.suspicionCtrl.resetEncounter();
    this.deps.stimuli.clearStimuli();
    this.lastKnownPlayerPosition = null;
    this.lastStimulusPosition = null;
    this.hasLos = false;
    this.lastVisionScore = 0;
    this.losBrokenSeconds = 0;
    this.captureEmitted = false;
    this.safeZoneRefusalEmitted = false;
    this.investigationDone = false;
    this.searchDone = false;
    this.withdrawDone = false;
    this.pendingPursuit = false;
    this.transitionOrThrow('Unaware');
    this.emit({ kind: 'ThreatActivated', nodeId });
  }

  /** Dev-only fault injection. */
  simulateFault(): void {
    const next = tryTransitionThreatState(this.state, 'Fault');
    if (next !== null) {
      this.setState(next);
    }
  }

  /** Full reset (dev "full reset" action only) — the one sanctioned table bypass. */
  reset(): void {
    const previous = this.state;
    this.state = 'Dormant';
    this.behavior.placeAtNode(this.deps.definition.homeNodeId);
    this.suspicionCtrl.resetEncounter();
    this.lastKnownPlayerPosition = null;
    this.lastStimulusPosition = null;
    this.hasLos = false;
    this.lastVisionScore = 0;
    this.losBrokenSeconds = 0;
    this.withdrawToInactive = false;
    this.captureEmitted = false;
    this.safeZoneRefusalEmitted = false;
    this.investigationDone = false;
    this.searchDone = false;
    this.withdrawDone = false;
    this.pendingPursuit = false;
    if (previous !== 'Dormant') {
      this.emit({ kind: 'ThreatDeactivated' });
    }
  }

  dispose(): void {
    this.bus.dispose();
    this.suspicionCtrl.dispose();
  }

  // ----- per-tick (scoped observer, active states only) --------------------

  update(deltaSeconds: number, input: ThreatPerceptionInput): void {
    if (!isThreatActive(this.state)) return;
    const dt = Math.min(Math.max(deltaSeconds, 0), 0.1);

    // ---- perception -----------------------------------------------------
    if (isThreatPerceiving(this.state)) {
      let soundPressure = 0;
      const vision = evaluateVision(this.deps.definition.vision, {
        threatPosition: this.behavior.currentPosition,
        threatFacingYaw: this.behavior.currentFacingYaw,
        playerPosition: input.playerPosition,
        losBlocked: input.losBlocked,
        exposure: input.exposure,
        playerStance: input.playerStance,
        playerFullyHidden: input.playerFullyHidden,
      });
      this.hasLos = vision.score > 0 && !input.losBlocked;
      if (this.hasLos) {
        this.lastKnownPlayerPosition = { ...input.playerPosition };
        this.losBrokenSeconds = 0;
      } else {
        this.losBrokenSeconds += dt;
      }

      const strongest = this.deps.stimuli.strongestFor(this.behavior.currentPosition);
      if (strongest !== null) {
        soundPressure = strongest.perceived;
        this.lastStimulusPosition = { ...strongest.stimulus.position };
      }

      const wasBelow =
        this.suspicionCtrl.currentSuspicion < this.deps.definition.suspicion.suspiciousThreshold;
      this.suspicionCtrl.update(dt, {
        visionScore: vision.score,
        soundPressure,
        hasLineOfSight: this.hasLos,
      });
      this.lastVisionScore = vision.score;

      const suspicion = this.suspicionCtrl.currentSuspicion;
      const cfg = this.deps.definition.suspicion;

      // ---- suspicion-driven state escalation ---------------------------
      if (this.state === 'Unaware' && suspicion >= cfg.suspiciousThreshold) {
        this.setState('Suspicious');
        if (this.lastStimulusPosition !== null) this.behavior.faceToward(this.lastStimulusPosition);
        else if (this.hasLos) this.behavior.faceToward(input.playerPosition);
        if (wasBelow) this.emit({ kind: 'SuspicionRaised' });
      } else if (this.state === 'Suspicious') {
        if (suspicion >= cfg.investigateThreshold) {
          const target =
            this.lastStimulusPosition ?? this.lastKnownPlayerPosition ?? input.playerPosition;
          this.setState('Investigating');
          this.investigationDone = false;
          this.behavior.startInvestigation(target);
          this.emit({ kind: 'InvestigationStarted', position: { ...target } });
        } else if (suspicion <= cfg.relaxThreshold) {
          this.setState('Unaware');
          this.emit({ kind: 'SuspicionCleared' });
        }
      } else if (this.state === 'Observing') {
        if (soundPressure >= OBSERVING_REACT_THRESHOLD && this.lastStimulusPosition !== null) {
          this.setState('Investigating');
          this.investigationDone = false;
          this.behavior.startInvestigation(this.lastStimulusPosition);
          this.emit({
            kind: 'InvestigationStarted',
            position: { ...this.lastStimulusPosition },
          });
        }
      }

      // ---- confirmed detection -> pursuit (one-shot per encounter) ------
      if (
        this.pendingPursuit &&
        (this.state === 'Suspicious' ||
          this.state === 'Investigating' ||
          this.state === 'Searching')
      ) {
        this.pendingPursuit = false;
        this.setState('Pursuing');
        const target = this.lastKnownPlayerPosition ?? input.playerPosition;
        this.behavior.startPursuit(target);
        this.emit({ kind: 'FullDetection' });
        this.emit({ kind: 'PursuitStarted' });
      }
    }

    // ---- state-specific behavior progression -----------------------------
    if (this.state === 'Investigating' && this.investigationDone) {
      this.investigationDone = false;
      this.emit({ kind: 'InvestigationCompleted' });
      const suspicion = this.suspicionCtrl.currentSuspicion;
      if (suspicion >= this.deps.definition.suspicion.investigateThreshold) {
        this.setState('Searching');
        this.searchDone = false;
        const origin = this.lastKnownPlayerPosition ?? this.lastStimulusPosition;
        this.behavior.startSearch(origin ?? this.behavior.currentPosition);
        this.emit({ kind: 'SearchStarted' });
      } else if (suspicion >= this.deps.definition.suspicion.suspiciousThreshold) {
        this.setState('Suspicious');
      } else {
        this.setState('Unaware');
        this.emit({ kind: 'SuspicionCleared' });
      }
    }

    if (this.state === 'Searching' && this.searchDone) {
      this.searchDone = false;
      this.emit({ kind: 'SearchExhausted' });
      this.withdraw();
    }

    if (this.state === 'Pursuing') {
      // Pursuit target only ever updates from CONFIRMED sightings.
      if (this.hasLos && this.lastKnownPlayerPosition !== null) {
        this.behavior.updatePursuitTarget(this.lastKnownPlayerPosition);
      }
      if (input.playerInSafeZone) {
        if (!this.safeZoneRefusalEmitted) {
          this.safeZoneRefusalEmitted = true;
          this.emit({ kind: 'SafeZoneRefusal' });
        }
      } else if (
        !this.captureEmitted &&
        isPlayerCaptured({
          threatPosition: this.behavior.currentPosition,
          playerPosition: input.playerPosition,
          captureRadius: this.deps.definition.movement.captureRadius,
          playerFullyHidden: input.playerFullyHidden,
          playerInSafeZone: input.playerInSafeZone,
        })
      ) {
        this.captureEmitted = true;
        this.emit({ kind: 'PlayerCaptured' });
      }
      if (this.losBrokenSeconds >= this.deps.definition.movement.pursuitLosLossSeconds) {
        this.setState('LostTarget');
        this.emit({ kind: 'TargetLost' });
      }
    } else if (this.state === 'LostTarget') {
      this.setState('Searching');
      this.searchDone = false;
      this.behavior.startSearch(this.lastKnownPlayerPosition ?? this.behavior.currentPosition);
      this.emit({ kind: 'SearchStarted' });
    }

    // ---- movement integration (kinematic, confined) ----------------------
    const beforeX = this.behavior.currentPosition.x;
    const beforeY = this.behavior.currentPosition.y;
    const beforeZ = this.behavior.currentPosition.z;
    this.behavior.update(dt);
    if (!this.deps.isPositionAllowed(this.behavior.currentPosition)) {
      // Confinement: never leave encounter-approved zones. Revert the step
      // (graph nodes are authored inside the area; only direct pursuit can
      // press against the boundary).
      this.behavior.placeAtPosition(beforeX, beforeY, beforeZ);
    }

    if (this.state === 'Withdrawing' && this.withdrawDone) {
      this.withdrawDone = false;
      this.emit({ kind: 'WithdrawCompleted' });
      if (this.withdrawToInactive) {
        this.setState('Inactive');
      } else {
        this.setState('Dormant');
      }
      this.emit({ kind: 'ThreatDeactivated' });
    }
  }

  // ----- private ---------------------------------------------------------

  private setState(target: ThreatState): void {
    const next = tryTransitionThreatState(this.state, target);
    if (next === null) {
      return;
    }
    const previous = this.state;
    this.state = next;
    this.emit({ kind: 'ThreatStateChanged', state: next, previousState: previous });
  }

  private transitionOrThrow(target: ThreatState): void {
    const next = tryTransitionThreatState(this.state, target);
    if (next === null) {
      throw new ThreatError(
        'invalid-transition',
        `ThreatController: illegal transition ${this.state} -> ${target}`,
      );
    }
    const previous = this.state;
    this.state = next;
    this.emit({ kind: 'ThreatStateChanged', state: next, previousState: previous });
  }

  private emit(event: Omit<ThreatEvent, 'threatId'>): void {
    this.bus.emit({ ...event, threatId: this.deps.definition.id });
  }
}
