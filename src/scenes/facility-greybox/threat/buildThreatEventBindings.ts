/**
 * Facility threat/event-director wiring (Milestone 0.9) — the one place the
 * pure threat, perception, stealth, manifestation and event-director
 * domains meet the Babylon scene (mirrors facilityAntennaBindings.ts).
 *
 * Responsibilities:
 *  - EventDirector construction: condition context (narrow query callbacks
 *    over the real registries/controllers) + typed action executor.
 *  - Event-driven evaluation: subscriptions on power/zone/door/receiver/
 *    antenna/threat/runtime-state events call director.evaluate() — no
 *    per-frame condition rescans.
 *  - ONE scoped per-frame observer that exists ONLY while the threat actor
 *    or a manifestation is active: stimulus expiry, player footstep
 *    adapter, cadenced LOS probe (one reused Ray + Vector3 pair), exposure,
 *    ThreatController tick, kinematic actor/manifestation mesh transforms,
 *    detection meter (change-only writes inside the view).
 *  - A second, always-on LIGHTWEIGHT observer that only advances the
 *    director clock/delays and blinking fixtures (a handful of arithmetic
 *    ops per frame — the heavy observer stays fully detached while
 *    dormant, so a dormant threat costs zero raycasts and zero perception).
 *  - Threat progression phase advancement (the FIFTH separate chain),
 *    encounter completion (one-shot) and encounter failure (fade +
 *    checkpoint reset preserving all major progression).
 */
import { Ray } from '@babylonjs/core/Culling/ray';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import type { Point3 } from '../../../game/facility/FacilityZone';
import type { EventActionExecutor, EventAction } from '../../../game/event-director/EventAction';
import type { EventConditionContext } from '../../../game/event-director/EventCondition';
import { EventDirector } from '../../../game/event-director/EventDirector';
import type { FirstPersonController } from '../../../game/player/FirstPersonController';
import { isCrouchedState, type CrouchState } from '../../../game/player/CrouchState';
import type { InteractionSystem } from '../../../game/interaction/InteractionSystem';
import type { HidingSession } from '../../../game/interaction/hiding/HidingSession';
import type { ThreatController } from '../../../game/threat/ThreatController';
import type { ThreatRuntimeState } from '../../../game/threat/ThreatRuntimeState';
import { compareThreatPhase } from '../../../game/threat/ThreatProgressionPhase';
import type { ManifestationController } from '../../../game/threat/manifestation/ManifestationController';
import type { SoundStimulusRegistry } from '../../../game/threat/perception/SoundStimulusRegistry';
import { PlayerStimulusAdapter } from '../../../game/threat/perception/PlayerStimulusAdapter';
import { evaluateExposure } from '../../../game/threat/perception/ExposureEvaluator';
import type { PlayerStance } from '../../../game/threat/perception/VisionEvaluator';
import type { HidingController } from '../../../game/threat/stealth/HidingController';
import type { SafeZoneRegistry } from '../../../game/threat/stealth/SafeZoneRegistry';
import type {
  DetectionMeterView,
  DetectionMeterState,
} from '../../../ui/threat/DetectionMeterView';
import type { EncounterStatusView } from '../../../ui/threat/EncounterStatusView';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import {
  CIRCUIT_CONTROL_ROOM_ID,
  CIRCUIT_EMERGENCY_SECURITY_ID,
} from '../power/facilityPowerDefinitions';
import type { HidingPromptGate } from './buildHidingSpots';
import type { ThreatPropsHandle } from './buildThreatManifestation';
import { LIGHT_CTRL_CORRIDOR } from './facilityThreatDefinitions';
import { FACILITY_THREAT_EVENTS, FIRST_CONTACT_RESET_PLAN } from './facilityEncounterDefinitions';

const LOS_PROBE_INTERVAL_SECONDS = 0.12;
const MANIFEST_PROBE_INTERVAL_SECONDS = 0.15;
const MANIFESTATION_SEEN_DISTANCE = 28;
/** Above this horizontal speed the player counts as sprinting (walk 3.2, sprint 5.4). */
const SPRINT_SPEED_THRESHOLD = 4.2;
const STILL_SPEED_THRESHOLD = 0.4;

export interface ThreatBindingsDeps {
  readonly ctx: FacilitySceneContext;
  readonly scene: Scene;
  readonly player: FirstPersonController;
  readonly interaction: InteractionSystem;
  readonly threatController: ThreatController;
  readonly threatRuntimeState: ThreatRuntimeState;
  readonly manifestationController: ManifestationController;
  readonly stimuli: SoundStimulusRegistry;
  readonly hidingController: HidingController;
  readonly hidingSession: HidingSession;
  readonly safeZones: SafeZoneRegistry;
  readonly props: ThreatPropsHandle;
  readonly detectionMeter: DetectionMeterView;
  readonly encounterStatus: EncounterStatusView;
  readonly hidingPromptGate: HidingPromptGate;
}

export interface ThreatBindingsHandle {
  readonly director: EventDirector;
  getDevMessages(): readonly string[];
  getDebugFields(): ReadonlyArray<readonly [string, string]>;
  /** Full dev reset of every threat/event/hiding/safe-zone runtime state. */
  resetAll(): void;
  dispose(): void;
}

interface MotorState {
  footPosition: Vector3;
  horizontalSpeed: number;
  grounded: boolean;
  crouchState: CrouchState;
}

interface MotorPeek {
  motor?: { motorState?: MotorState };
}

export function bindFacilityThreat(deps: ThreatBindingsDeps): ThreatBindingsHandle {
  const {
    ctx,
    scene,
    player,
    interaction,
    threatController,
    threatRuntimeState,
    manifestationController,
    stimuli,
    hidingController,
    hidingSession,
    safeZones,
    props,
    detectionMeter,
    encounterStatus,
    hidingPromptGate,
  } = deps;

  const devMessages: string[] = [];
  const logDev = (text: string): void => {
    devMessages.push(text);
    if (devMessages.length > 20) devMessages.shift();
    if (ctx.environment.isDevelopment) {
      console.info(`[EventDirector] ${text}`);
    }
  };

  // ----- condition context -------------------------------------------------
  let directorRef: EventDirector | null = null;
  const conditionContext: EventConditionContext = {
    isAntennaRevealComplete: () => ctx.antennaRuntimeState.isRevealComplete,
    compareThreatPhase: (phase) => compareThreatPhase(threatRuntimeState.threatPhase, phase),
    isZoneDiscovered: (zoneId) => ctx.zoneRegistry.isDiscovered(zoneId),
    isZoneInside: (zoneId) => ctx.zoneRegistry.isCurrentlyInside(zoneId),
    isCircuitEnergized: (circuitId) => ctx.powerNetwork.isCircuitEnergized(circuitId as never),
    isSignalDecoded: (signalId) => ctx.receiverController.isDecoded(signalId as never),
    isDoorOpen: (doorId) => ctx.doorRegistry.get(doorId)?.isOpen ?? false,
    hasInventoryItem: (itemId) => ctx.inventory.getSnapshot().has(itemId),
    secondsSinceEvent: (eventId) => directorRef?.secondsSinceFired(eventId) ?? null,
    getThreatState: () => threatController.threatState,
    isPlayerInGameplayMode: () => interaction.currentMode === 'gameplay',
    isEventCompleted: (eventId) => directorRef?.hasFired(eventId) ?? false,
  };

  // ----- action executor ---------------------------------------------------
  const executor: EventActionExecutor = {
    execute(action: EventAction): void {
      switch (action.kind) {
        case 'begin-manifestation':
          manifestationController.begin(action.manifestationId);
          break;
        case 'set-light':
          props.lights.get(action.lightId)?.setMode(action.mode);
          break;
        case 'operate-door': {
          const door = ctx.doorRegistry.get(action.doorId);
          if (door === undefined) break;
          const wantOpen = action.operation === 'open';
          if (door.isOpen !== wantOpen) door.interact();
          break;
        }
        case 'phone-indicator':
          props.lights.get(action.messageId)?.setMode('blink');
          break;
        case 'begin-encounter':
          threatRuntimeState.recordEncounterStarted(action.encounterId);
          break;
        case 'enable-hiding-prompts':
          hidingPromptGate.enabled = true;
          break;
        case 'set-checkpoint':
          ctx.checkpointRegistry.activate(action.checkpointId);
          break;
        case 'dev-message':
          logDev(action.text);
          break;
        case 'threat-manifest':
          threatController.manifestAt(action.nodeId);
          break;
        case 'threat-resolve-manifestation':
          threatController.resolveManifestation(action.outcome);
          break;
        case 'threat-activate-unaware':
          threatController.activateUnawareAt(action.nodeId);
          break;
        case 'threat-route-to':
          threatController.beginPatrol(action.nodeId);
          break;
        case 'threat-investigate':
          threatController.commandInvestigate(action.position);
          break;
        case 'threat-withdraw':
          threatController.withdraw(action.final);
          break;
        case 'complete-encounter':
          threatRuntimeState.recordEncounterCompleted(action.encounterId);
          threatRuntimeState.tryAdvancePhase('EncounterResolved');
          break;
        case 'advance-threat-phase':
          threatRuntimeState.tryAdvancePhase(action.phase);
          break;
      }
    },
  };

  const director = new EventDirector(conditionContext, executor, (eventId, action, error) => {
    if (ctx.environment.isDevelopment) {
      console.warn(`[EventDirector] action ${action.kind} of ${eventId} failed`, error);
    }
  });
  directorRef = director;
  for (const event of FACILITY_THREAT_EVENTS) {
    director.register(event);
  }

  // ----- scoped heavy observer (threat/manifestation active only) ----------
  const stimulusAdapter = new PlayerStimulusAdapter(stimuli);
  const losRay = new Ray(new Vector3(), new Vector3(), 1);
  const losScratch = new Vector3();
  let losBlocked = true;
  let losTimer = 0;
  let manifestProbeTimer = 0;
  let manifestSeenOnce = false;
  let playerWasInSafeZone = false;
  let exposure = 1;

  const losPredicate = (mesh: AbstractMesh): boolean =>
    mesh.isPickable &&
    mesh.isEnabled() &&
    !(props.losExcludedMeshes as ReadonlySet<AbstractMesh>).has(mesh);

  const peekMotor = (): MotorState | null => {
    // Same allocation-free motor peek the scene's zone-polling observer uses.
    const state = (player as unknown as MotorPeek).motor?.motorState;
    return state ?? null;
  };

  const probeLos = (threatPos: Readonly<Point3>, playerPos: Point3): void => {
    const ox = threatPos.x;
    const oy = threatPos.y + 1.6;
    const oz = threatPos.z;
    losScratch.set(playerPos.x - ox, playerPos.y + 1.5 - oy, playerPos.z - oz);
    const distance = losScratch.length();
    if (distance < 1e-3) {
      losBlocked = false;
      return;
    }
    losScratch.scaleInPlace(1 / distance);
    losRay.origin.set(ox, oy, oz);
    losRay.direction.copyFrom(losScratch);
    losRay.length = distance;
    const pick = scene.pickWithRay(losRay, losPredicate);
    losBlocked = pick?.hit === true && pick.distance < distance - 0.35;
  };

  const computeStance = (speed: number, crouched: boolean): PlayerStance => {
    if (crouched) return 'crouch';
    if (speed <= STILL_SPEED_THRESHOLD) return 'still';
    if (speed >= SPRINT_SPEED_THRESHOLD) return 'sprint';
    return 'walk';
  };

  const computeExposure = (crouched: boolean): number => {
    const insideBuilding =
      ctx.zoneRegistry.isCurrentlyInside('fg-zone-control-room') ||
      ctx.zoneRegistry.isCurrentlyInside('fg-zone-control-lobby') ||
      ctx.zoneRegistry.isCurrentlyInside('fg-zone-relay-room') ||
      ctx.zoneRegistry.isCurrentlyInside('fg-zone-stairwell');
    const corridorLit = props.lights.get(LIGHT_CTRL_CORRIDOR)?.mode === 'on';
    const zonePowered = insideBuilding
      ? ctx.powerNetwork.isCircuitEnergized(CIRCUIT_CONTROL_ROOM_ID) && corridorLit
      : true; // outdoors: daylight
    const emergencyOnly =
      insideBuilding &&
      !zonePowered &&
      ctx.powerNetwork.isCircuitEnergized(CIRCUIT_EMERGENCY_SECURITY_ID);
    return evaluateExposure({
      zonePowered,
      emergencyLightingOnly: emergencyOnly,
      crouched,
      hidingConcealment: hidingController.getConcealment().concealment,
      inDarkCover: false,
    });
  };

  let heavyObserver: Observer<Scene> | null = null;

  const heavyTick = (): void => {
    const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
    const motorState = peekMotor();
    if (motorState === null) return;
    const fp = motorState.footPosition;
    const playerPos: Point3 = { x: fp.x, y: fp.y, z: fp.z };
    const crouched = isCrouchedState(motorState.crouchState);
    const concealment = hidingController.getConcealment();

    // Footsteps only while gameplay-controlled (hidden players are parked).
    if (!concealment.hidden) {
      stimulusAdapter.update(dt, {
        position: playerPos,
        horizontalSpeed: motorState.horizontalSpeed,
        grounded: motorState.grounded,
        sprinting: motorState.horizontalSpeed >= SPRINT_SPEED_THRESHOLD,
        crouched,
        zoneId: null,
      });
    }

    // ---- manifestation update + visual + obstruction/seen probe ---------
    manifestationController.update(dt);
    const activeManifest = manifestationController.activeManifestation;
    const manifestSnap = manifestationController.getSnapshot();
    const silhouette = props.manifestationSilhouette;
    if (
      activeManifest !== null &&
      manifestSnap.activePosition !== null &&
      activeManifest.type !== 'mechanical-disturbance'
    ) {
      silhouette.setVisible(true);
      silhouette.setTransform(
        manifestSnap.activePosition.x,
        manifestSnap.activePosition.y,
        manifestSnap.activePosition.z,
        manifestSnap.activeFacingYaw,
      );
      manifestProbeTimer -= dt;
      if (manifestProbeTimer <= 0) {
        manifestProbeTimer = MANIFEST_PROBE_INTERVAL_SECONDS;
        const mp = manifestSnap.activePosition;
        losScratch.set(mp.x - fp.x, mp.y + 1.4 - (fp.y + 1.5), mp.z - fp.z);
        const distance = losScratch.length();
        if (distance > 1e-3 && distance <= MANIFESTATION_SEEN_DISTANCE) {
          losScratch.scaleInPlace(1 / distance);
          losRay.origin.set(fp.x, fp.y + 1.5, fp.z);
          losRay.direction.copyFrom(losScratch);
          losRay.length = distance;
          const pick = scene.pickWithRay(losRay, losPredicate);
          const obstructed = pick?.hit === true && pick.distance < distance - 0.35;
          if (!obstructed) {
            manifestSeenOnce = true;
            threatRuntimeState.recordManifestationSeen(activeManifest.id);
          } else if (manifestSeenOnce) {
            manifestationController.notifyObstructed();
          }
        }
      }
    } else if (silhouette.isVisible) {
      silhouette.setVisible(false);
    }

    // ---- threat actor tick ----------------------------------------------
    if (threatController.isActive) {
      losTimer -= dt;
      if (losTimer <= 0) {
        losTimer = LOS_PROBE_INTERVAL_SECONDS;
        probeLos(threatController.position, playerPos);
        exposure = computeExposure(crouched);
      }
      const playerInSafeZone = safeZones.isInsideAny(playerPos);
      threatController.update(dt, {
        playerPosition: playerPos,
        playerStance: computeStance(motorState.horizontalSpeed, crouched),
        losBlocked,
        exposure,
        playerFullyHidden: concealment.fullyHidden,
        playerInSafeZone,
      });
      playerWasInSafeZone = playerInSafeZone;

      const actor = props.actorSilhouette;
      const pos = threatController.position;
      actor.setVisible(threatController.threatState !== 'Dormant');
      actor.setTransform(pos.x, pos.y, pos.z, threatController.facingYaw);

      // Detection meter (view performs change-only DOM writes).
      const snap = threatController.getSnapshot();
      detectionMeter.update(
        meterState(snap.state, snap.suspicion, snap.detection),
        Math.max(snap.suspicion, snap.detection),
      );
    }
  };

  const meterState = (
    state: string,
    suspicion: number,
    detection: number,
  ): DetectionMeterState | null => {
    if (state === 'Pursuing') return 'DETECTED';
    if (state === 'Searching' || state === 'LostTarget') return 'SEARCHING';
    if (state === 'Investigating' || suspicion >= 0.7) return 'SUSPICION';
    if (suspicion >= 0.3) return 'OBSERVED';
    if (suspicion > 0.05 || detection > 0.05) return 'UNSEEN';
    return null;
  };

  const ensureHeavyObserver = (): void => {
    if (heavyObserver !== null) return;
    losTimer = 0;
    manifestProbeTimer = 0;
    heavyObserver = scene.onBeforeRenderObservable.add(heavyTick);
  };

  const maybeDetachHeavyObserver = (): void => {
    if (heavyObserver === null) return;
    if (threatController.isActive || manifestationController.hasActive) return;
    scene.onBeforeRenderObservable.remove(heavyObserver);
    heavyObserver = null;
    props.actorSilhouette.setVisible(false);
    props.manifestationSilhouette.setVisible(false);
    detectionMeter.hide();
    stimulusAdapter.reset();
  };

  // ----- always-on lightweight observer -----------------------------------
  const lightObserver = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
    director.update(dt);
    // Stimulus expiry lives here (not the heavy observer) so stimuli emitted
    // while the threat is dormant still expire on schedule.
    stimuli.update(dt);
    for (const light of props.lights.values()) {
      light.tick(dt);
    }
  });

  // ----- encounter failure -------------------------------------------------
  let resetInFlight = false;
  const runEncounterFailure = (): void => {
    if (resetInFlight) return;
    resetInFlight = true;
    const plan = FIRST_CONTACT_RESET_PLAN;
    threatRuntimeState.recordEncounterReset(plan.encounterId);
    logDev(plan.devMessage);
    encounterStatus.playEncounterReset(() => {
      try {
        if (hidingSession.isOpen) hidingSession.close();
        const cp = ctx.checkpointRegistry.get(plan.checkpointId);
        if (cp !== undefined) {
          player.teleportTo(
            new Vector3(cp.spawnPosition.x, cp.spawnPosition.y, cp.spawnPosition.z),
            cp.spawnYaw,
          );
        }
        // ONLY encounter/threat-local state is touched (structural
        // guarantee: the plan enumerates it) — inventory, power, signal,
        // antenna and all other doors are never listed, never reset.
        threatController.resetForEncounterRetry(plan.threatResetNodeId);
        for (const doorReset of plan.doorResets) {
          const door = ctx.doorRegistry.get(doorReset.doorId);
          if (door !== undefined && door.isOpen !== doorReset.open) {
            door.interact();
          }
        }
        detectionMeter.hide();
      } finally {
        resetInFlight = false;
      }
    }, plan.devMessage);
  };

  // ----- typed event subscriptions -> director evaluation ------------------
  const unsubscribers: Array<() => void> = [];

  unsubscribers.push(ctx.powerNetwork.subscribe(() => director.evaluate()));
  unsubscribers.push(ctx.zoneRegistry.onZoneEvent(() => director.evaluate()));
  unsubscribers.push(ctx.receiverController.subscribe(() => director.evaluate()));
  for (const door of ctx.doorRegistry.getAll()) {
    unsubscribers.push(
      door.onEvent((event) => {
        // Narrow adapter: door operations are audible stimuli (spec) — the
        // DoorController itself is untouched.
        if (event.kind === 'door-opening' || event.kind === 'door-closing') {
          const mesh = door.motion.meshes[0];
          if (mesh !== undefined) {
            const pos = mesh.getAbsolutePosition();
            stimuli.emit({
              position: { x: pos.x, y: pos.y, z: pos.z },
              intensity: 0.55,
              radius: 12,
              category: 'door-operation',
              durationSeconds: 1.2,
              source: 'door',
            });
          }
        }
        director.evaluate();
      }),
    );
  }

  // Generator startup: a large authored stimulus at the generator hall.
  unsubscribers.push(
    ctx.generatorController.subscribe((event) => {
      if (event.kind === 'GeneratorStarted') {
        stimuli.emit({
          position: { x: 47, y: 1.5, z: 0 },
          intensity: 1,
          radius: 45,
          category: 'generator-startup',
          durationSeconds: 5,
          source: 'generator',
        });
      }
    }),
  );

  // Signal-category stimuli: receiver decode + antenna sample analysis.
  unsubscribers.push(
    ctx.receiverController.subscribe((event) => {
      if (event.kind === 'DecodeCompleted') {
        stimuli.emit({
          position: { x: -9.7, y: 1.6, z: 22 },
          intensity: 0.6,
          radius: 14,
          category: 'signal-activity',
          durationSeconds: 3,
          source: 'receiver',
        });
      }
    }),
  );
  unsubscribers.push(
    ctx.sourceAnalysisController.subscribe((event) => {
      if (event.kind === 'SampleCollected' || event.kind === 'AnalysisResolved') {
        stimuli.emit({
          position: { x: 0, y: 6.5, z: 20 },
          intensity: 0.5,
          radius: 12,
          category: 'signal-activity',
          durationSeconds: 3,
          source: 'antenna',
        });
      }
    }),
  );
  unsubscribers.push(
    ctx.antennaRuntimeState.subscribe((event) => {
      if (event.kind === 'completed' || event.kind === 'phase-changed') {
        if (ctx.antennaRuntimeState.isRevealComplete) {
          threatRuntimeState.tryAdvancePhase('AntennaAftermathPending');
        }
        director.evaluate();
      }
    }),
  );
  unsubscribers.push(
    threatRuntimeState.subscribe((event) => {
      if (event.kind === 'phase-changed' || event.kind === 'encounter-completed') {
        director.evaluate();
      }
    }),
  );
  unsubscribers.push(
    hidingController.subscribe((event) => {
      if (event.kind === 'entered' && threatRuntimeState.activeEncounterId !== null) {
        threatRuntimeState.tryAdvancePhase('InvestigationActive');
        threatRuntimeState.tryAdvancePhase('StealthRequired');
      }
      director.evaluate();
    }),
  );
  unsubscribers.push(
    manifestationController.subscribe((event) => {
      if (event.kind === 'ManifestationStarted') {
        manifestSeenOnce = false;
        ensureHeavyObserver();
      } else if (event.kind === 'DisturbanceTriggered') {
        const targetId = event.definition.disturbanceTargetId;
        if (targetId !== undefined) {
          props.lights.get(targetId)?.setMode('blink');
        }
      } else if (event.kind === 'ManifestationEnded') {
        props.manifestationSilhouette.setVisible(false);
        if (event.definition.type === 'mechanical-disturbance') {
          const targetId = event.definition.disturbanceTargetId;
          if (targetId !== undefined && event.definition.disturbance === 'phone-indicator') {
            props.lights.get(targetId)?.setMode('off');
          }
          if (targetId !== undefined && event.definition.disturbance === 'light') {
            props.lights.get(targetId)?.setMode('off');
          }
        }
        maybeDetachHeavyObserver();
      }
      director.evaluate();
    }),
  );
  unsubscribers.push(
    threatController.subscribe((event) => {
      switch (event.kind) {
        case 'ThreatActivated':
          ensureHeavyObserver();
          break;
        case 'InvestigationStarted':
          threatRuntimeState.tryAdvancePhase('InvestigationActive');
          break;
        case 'FullDetection':
          threatRuntimeState.tryAdvancePhase('InvestigationActive');
          threatRuntimeState.tryAdvancePhase('StealthRequired');
          threatRuntimeState.tryAdvancePhase('PlayerDetected');
          break;
        case 'PursuitStarted':
          threatRuntimeState.tryAdvancePhase('PursuitActive');
          break;
        case 'SafeZoneRefusal':
          threatRuntimeState.tryAdvancePhase('SafeZoneReached');
          threatRuntimeState.recordSafeZoneReached();
          break;
        case 'PlayerCaptured':
          runEncounterFailure();
          break;
        case 'WithdrawCompleted':
          threatRuntimeState.recordThreatWithdrawn();
          break;
        case 'ThreatDeactivated':
          if (
            threatRuntimeState.hasCompletedEncounter(FIRST_CONTACT_RESET_PLAN.encounterId) &&
            threatRuntimeState.tryAdvancePhase('ThreatFoundationComplete')
          ) {
            encounterStatus.showCompletionBanner('THREAT FOUNDATION COMPLETE');
            logDev('THREAT FOUNDATION COMPLETE');
          }
          maybeDetachHeavyObserver();
          break;
        default:
          break;
      }
      director.evaluate();
    }),
  );

  // Reconcile once at bind time (checkpoint recovery: reveal may already be
  // complete before this scene wiring ran).
  if (ctx.antennaRuntimeState.isRevealComplete) {
    threatRuntimeState.tryAdvancePhase('AntennaAftermathPending');
  }
  director.evaluate();

  return {
    director,
    getDevMessages: () => devMessages,
    getDebugFields: () => {
      const snap = threatController.getSnapshot();
      const concealment = hidingController.getConcealment();
      const directorSnap = director.getSnapshot();
      return [
        ['Threat state', snap.state],
        ['Threat phase', threatRuntimeState.threatPhase],
        ['Encounter', threatRuntimeState.activeEncounterId ?? 'none'],
        ['Suspicion', snap.suspicion.toFixed(2)],
        ['Detection', snap.detection.toFixed(2)],
        ['Exposure', exposure.toFixed(2)],
        ['LOS', snap.hasLineOfSight ? 'yes' : losBlocked ? 'blocked' : 'no'],
        [
          'Last known',
          snap.lastKnownPlayerPosition !== null
            ? `${snap.lastKnownPlayerPosition.x.toFixed(1)},${snap.lastKnownPlayerPosition.z.toFixed(1)}`
            : '—',
        ],
        ['Route node', snap.currentNodeId ?? '—'],
        ['Behavior', snap.behaviorMode],
        ['Hiding', concealment.hidden ? `${concealment.spotId ?? ''}` : 'no'],
        ['Safe zone', playerWasInSafeZone ? 'inside' : 'outside'],
        ['Manifestation', manifestationController.activeManifestation?.id ?? 'none'],
        ['Events fired', directorSnap.firedEventIds.join(',') || 'none'],
        [
          'Encounter done',
          threatRuntimeState.hasCompletedEncounter(FIRST_CONTACT_RESET_PLAN.encounterId)
            ? 'yes'
            : 'no',
        ],
      ];
    },
    resetAll: () => {
      hidingSession.close();
      hidingController.reset();
      threatController.reset();
      manifestationController.reset();
      stimuli.reset();
      stimulusAdapter.reset();
      director.reset();
      threatRuntimeState.reset();
      props.reset();
      hidingPromptGate.enabled = false;
      detectionMeter.hide();
      encounterStatus.hideAll();
      losBlocked = true;
      exposure = 1;
      playerWasInSafeZone = false;
      resetInFlight = false;
      maybeDetachHeavyObserver();
      // Re-run first-bind reconciliation for the fresh playthrough.
      if (ctx.antennaRuntimeState.isRevealComplete) {
        threatRuntimeState.tryAdvancePhase('AntennaAftermathPending');
      }
      director.evaluate();
    },
    dispose: () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
      if (heavyObserver !== null) {
        scene.onBeforeRenderObservable.remove(heavyObserver);
        heavyObserver = null;
      }
      scene.onBeforeRenderObservable.remove(lightObserver);
      director.dispose();
    },
  };
}
