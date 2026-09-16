/**
 * Persistent Save/Load Restoration Service for The Last Signal (Milestone 1.2).
 *
 * Coordinates atomic state capture and deterministic scene restoration:
 * 1. Pauses physics simulation and acquires input lock.
 * 2. Restores subsystems in strict deterministic order:
 *    Zones/Checkpoints -> Power Network -> Inventory & Items -> Doors/Access ->
 *    Signal/Antenna -> Threat & Event Director -> Player Transform.
 * 3. Releases locks and unpauses physics simulation.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { FirstPersonController } from '../../game/player/FirstPersonController';
import type { FacilityRuntimeState } from '../../game/facility/FacilityRuntimeState';
import type { ProgressionPhase } from '../../game/facility/ProgressionPhase';
import type { ZoneRegistry } from '../../game/facility/ZoneRegistry';
import type { CheckpointRegistry } from '../../game/facility/Checkpoint';
import type { PowerNetwork } from '../../game/power/PowerNetwork';
import type { PowerCircuitId } from '../../game/power/PowerCircuitId';
import type { PowerSourceId } from '../../game/power/PowerSourceId';
import type { GeneratorController } from '../../game/generator/GeneratorController';
import type { GeneratorState } from '../../game/generator/GeneratorState';
import type { InventoryService } from '../../game/inventory/InventoryService';
import type { PickupRegistry } from '../../game/pickups/PickupRegistry';
import type { DoorRegistry } from '../../game/doors/DoorRegistry';
import type { ReceiverController } from '../../game/receiver/ReceiverController';
import type { AntennaController } from '../../game/antenna/AntennaController';
import type { SourceAnalysisController } from '../../game/source-analysis/SourceAnalysisController';
import type { ThreatController } from '../../game/threat/ThreatController';
import type { ThreatRuntimeState } from '../../game/threat/ThreatRuntimeState';
import type { ThreatProgressionPhase } from '../../game/threat/ThreatProgressionPhase';
import type {
  NarrativeFactRegistry,
  NarrativeFactId,
} from '../../game/narrative/NarrativeFactRegistry';
import type { ObjectiveController } from '../../game/objectives/ObjectiveController';
import type { HintController } from '../../game/hints/HintController';
import type { HintTier } from '../../game/hints/HintTypes';
import type { GameFlowState } from '../../game/flow/GameFlowState';
import type { GameChapter } from '../../game/flow/GameChapter';
import type { InvestigationStore } from '../investigation/InvestigationStore';
import { SaveManager } from './SaveManager';
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  type SaveMetadata,
  type SaveSnapshot,
  validateSaveSnapshot,
  migrateSaveSnapshot,
} from './schema';

export interface SaveRestoreContext {
  readonly scene?: Scene | null;
  readonly controller: FirstPersonController;
  readonly facilityState: FacilityRuntimeState;
  readonly zoneRegistry: ZoneRegistry;
  readonly checkpointRegistry: CheckpointRegistry;
  readonly powerNetwork: PowerNetwork;
  readonly generatorController: GeneratorController;
  readonly inventory: InventoryService;
  readonly pickupRegistry: PickupRegistry;
  readonly doorRegistry: DoorRegistry;
  readonly receiverController: ReceiverController;
  readonly antennaController: AntennaController;
  readonly sourceAnalysisController?: SourceAnalysisController | null;
  readonly threatController: ThreatController;
  readonly threatRuntimeState: ThreatRuntimeState;
  readonly narrativeRegistry: NarrativeFactRegistry;
  readonly objectiveController: ObjectiveController;
  readonly hintController: HintController;
  readonly gameFlowState: GameFlowState;
  readonly investigationStore?: InvestigationStore | null;
}

export class SaveRestoreService {
  private readonly saveManager: SaveManager;
  private readonly context: SaveRestoreContext;

  constructor(context: SaveRestoreContext, saveManager: SaveManager = new SaveManager()) {
    this.context = context;
    this.saveManager = saveManager;
  }

  /**
   * Captures an atomic, purely serializable SaveSnapshot from all active subsystems.
   */
  captureSaveSnapshot(slotId = 'quicksave'): SaveSnapshot {
    const ctx = this.context;
    const playerSnap = ctx.controller.getDebugSnapshot();
    const rxSnap = ctx.receiverController.getSnapshot();
    const thSnap = ctx.threatController.getSnapshot();
    const facilitySnap = ctx.facilityState.getSnapshot();
    const invSnap = ctx.inventory.getSnapshot();
    const selectedArray = ctx.antennaController.selectedArray;

    const breakerStates: Record<string, boolean> = {};
    for (const c of ctx.powerNetwork.getAllCircuits()) {
      breakerStates[c.id] = ctx.powerNetwork.isCircuitEnergized(c.id);
    }

    const narrativeSnap = ctx.narrativeRegistry.captureSnapshot();
    const objectiveSnap = ctx.objectiveController.captureSnapshot();
    const hintSnap = ctx.hintController.captureSnapshot();

    const completedObjectiveIds = Object.values(objectiveSnap.objectives)
      .filter((o) => o.state === 'completed')
      .map((o) => o.id);

    const snapshot: SaveSnapshot = {
      saveVersion: CURRENT_SAVE_SCHEMA_VERSION,
      metadata: {
        slotId,
        saveVersion: CURRENT_SAVE_SCHEMA_VERSION,
        timestamp: Date.now(),
        playtimeSeconds: Math.floor(ctx.gameFlowState.elapsedPlaytimeSeconds),
        chapterId: ctx.gameFlowState.currentChapterId,
      },
      player: {
        position: [playerSnap.position.x, playerSnap.position.y, playerSnap.position.z],
        yaw: playerSnap.yaw,
        pitch: playerSnap.pitch,
        crouched: playerSnap.crouched,
        sprinting: playerSnap.mode === 'sprinting',
        activeCheckpointId: ctx.checkpointRegistry.latestCheckpoint?.id ?? null,
      },
      facility: {
        progressionPhase: facilitySnap.progressionPhase,
        discoveredZoneIds: [...facilitySnap.discoveredZoneIds],
        activeZoneId: ctx.zoneRegistry.activeZoneIds[0] ?? null,
        openedDoorIds: ctx.doorRegistry
          .getAll()
          .filter((d) => d.isOpen)
          .map((d) => d.id),
        unlockedDoorIds: ctx.doorRegistry
          .getAll()
          .filter((d) => !d.isLocked)
          .map((d) => d.id),
        collectedPickupIds: ctx.pickupRegistry
          .getAll()
          .filter((p) => p.isCollected)
          .map((p) => p.id),
        activatedCheckpointIds: ctx.checkpointRegistry
          .getAll()
          .filter((c) => ctx.checkpointRegistry.isActivated(c.id))
          .map((c) => c.id),
      },
      inventory: {
        itemIds: invSnap.entries.map((e) => e.itemId),
        activeSlot: null,
        inspectionHistory: [],
      },
      power: {
        generatorState: ctx.generatorController.generatorState,
        breakerStates,
        activeCircuitIds: ctx.powerNetwork
          .getAllCircuits()
          .filter((c) => ctx.powerNetwork.isCircuitEnergized(c.id))
          .map((c) => c.id),
        powerPhase: facilitySnap.power.powerNetworkOperational ? 'Operational' : 'Restricted',
      },
      signal: {
        receiverState: rxSnap.mode,
        currentFrequencyMHz: rxSnap.controls.frequencyMHz,
        bandwidth: rxSnap.controls.filter,
        lockConfidence: rxSnap.metrics?.effectiveSignalStrength ?? 0,
        decodedSignalIds: [...rxSnap.decodedSignalIds],
        signalPhase: rxSnap.mode,
      },
      antenna: {
        azimuth: selectedArray
          ? (ctx.antennaController.getMechanicalState(selectedArray)?.currentAzimuthDeg ?? 0)
          : 0,
        elevation: selectedArray
          ? (ctx.antennaController.getMechanicalState(selectedArray)?.currentElevationDeg ?? 0)
          : 0,
        alignmentScore: selectedArray
          ? (ctx.antennaController.getMetrics(selectedArray)?.alignmentQuality ?? 0)
          : 0,
        waveguideRoute: 'Direct',
        telemetryReport: ctx.sourceAnalysisController?.analysisState === 'Resolved',
        selectedArray,
      },
      threat: {
        threatPhase: ctx.threatRuntimeState.threatPhase,
        threatState: thSnap.state,
        suspicion: thSnap.suspicion,
        detection: thSnap.detection,
        completedEventIds: [...ctx.threatRuntimeState.getSnapshot().completedEventIds],
        encounterSurvivals: ctx.narrativeRegistry.hasFact('ThreatEncounterSurvived') ? 1 : 0,
      },
      narrative: {
        revealedFacts: [...narrativeSnap.discoveredFacts],
        readDocumentIds: [],
      },
      investigation: ctx.investigationStore
        ? ctx.investigationStore.captureSnapshot()
        : {
            discoveredDocumentIds: [],
            discoveredClueIds: [],
            completedChainIds: [],
            highlightedClueIds: [],
            unlockedFrequencies: [],
            unlockedDoorCodes: [],
          },
      objectives: {
        activeObjectiveId: objectiveSnap.activeObjectiveId,
        completedObjectiveIds,
        activeStepIndex: 0,
      },
      hints: {
        activeHintLevel: hintSnap.currentTier,
        struggleTimeSeconds: hintSnap.elapsedSinceProgressSeconds,
      },
    };

    return snapshot;
  }

  /**
   * Restores the complete game state from a SaveSnapshot in strict deterministic order:
   * Zones/Checkpoints -> Power Network -> Inventory & Items -> Doors/Access ->
   * Signal/Antenna -> Threat & Event Director -> Player Transform.
   */
  async restoreSaveSnapshot(rawSnapshot: unknown): Promise<boolean> {
    const validated = migrateSaveSnapshot(rawSnapshot);
    const validation = validateSaveSnapshot(validated);
    if (!validation.valid) {
      console.error('[SaveRestoreService] Snapshot validation failed:', validation.errors);
      return false;
    }

    const snap = validated;
    const ctx = this.context;

    // 0. Pause physics and lock gameplay inputs
    type PhysicsEngineLike = { setTimeStep(dt: number): void };
    const physicsEngine = (ctx.scene?.getPhysicsEngine?.() ?? null) as PhysicsEngineLike | null;
    physicsEngine?.setTimeStep(0);
    const lockToken = ctx.controller.acquireInputLock('transition');

    try {
      await Promise.resolve();
      // 1. Zones / Checkpoints / Flow
      if (snap.metadata.chapterId) {
        ctx.gameFlowState.forceChapter(snap.metadata.chapterId as GameChapter);
      }
      ctx.zoneRegistry.restoreDiscoveredZones(snap.facility.discoveredZoneIds);
      ctx.checkpointRegistry.restoreActivated(
        snap.facility.activatedCheckpointIds,
        snap.player.activeCheckpointId,
      );
      ctx.facilityState.restoreSnapshot({
        progressionPhase: snap.facility.progressionPhase as ProgressionPhase,
        discoveredZoneIds: snap.facility.discoveredZoneIds,
        activatedCheckpointIds: snap.facility.activatedCheckpointIds,
        openedDoorIds: snap.facility.openedDoorIds,
        collectedPickupIds: snap.facility.collectedPickupIds,
      });

      // 2. Power Network
      if (snap.power.generatorState) {
        ctx.generatorController.restoreFrom({
          state: snap.power.generatorState as GeneratorState,
          fuelValve:
            snap.power.generatorState === 'Running' ||
            snap.power.generatorState === 'RunningUnstable'
              ? 'Open'
              : 'Closed',
          starterBattery:
            snap.power.generatorState === 'Running' ||
            snap.power.generatorState === 'RunningUnstable'
              ? 'Connected'
              : 'Disconnected',
          emergencyStop: 'Released',
          selector: 'Manual',
          mainBreaker: snap.power.generatorState === 'Running' ? 'Closed' : 'Open',
          warmUpProgress: snap.power.generatorState === 'Running' ? 1 : 0,
          inspected: true,
        });

        if (snap.power.generatorState === 'Running') {
          try {
            ctx.powerNetwork.setSourceAvailability(
              'pwr-src-generator' as PowerSourceId,
              'available',
            );
          } catch {
            // Source not registered in test harness
          }
        }
      }

      if (Array.isArray(snap.power.activeCircuitIds)) {
        for (const circuitId of snap.power.activeCircuitIds) {
          try {
            ctx.powerNetwork.requestCircuit(
              circuitId as PowerCircuitId,
              'pwr-src-generator' as PowerSourceId,
              'on',
            );
          } catch {
            // Ignore circuit errors
          }
        }
      }

      // 3. Inventory & Items
      ctx.inventory.reset();
      for (const itemId of snap.inventory.itemIds) {
        try {
          ctx.inventory.add(itemId);
        } catch {
          // Unknown item definition
        }
      }

      for (const pickupId of snap.facility.collectedPickupIds) {
        ctx.facilityState.recordPickupCollected(pickupId);
        const pickup = ctx.pickupRegistry.get(pickupId);
        if (pickup && !pickup.isCollected) {
          (pickup as { isCollected?: boolean }).isCollected = true;
          for (const m of (pickup as { meshes?: readonly AbstractMesh[] }).meshes ?? []) {
            m.setEnabled(false);
            m.isPickable = false;
          }
        }
      }

      // 4. Doors & Access
      const openedSet = new Set(snap.facility.openedDoorIds);
      const unlockedSet = new Set(snap.facility.unlockedDoorIds);
      for (const door of ctx.doorRegistry.getAll()) {
        if (unlockedSet.has(door.id)) {
          door.forceUnlock();
        } else {
          door.forceLock();
        }

        if (openedSet.has(door.id)) {
          door.forceOpen();
        } else {
          door.forceClosed();
        }
      }

      // 5. Signal & Antenna
      ctx.receiverController.restoreSnapshot({
        receiverState: snap.signal.receiverState,
        currentFrequencyMHz: snap.signal.currentFrequencyMHz,
        bandwidth: snap.signal.bandwidth,
        decodedSignalIds: snap.signal.decodedSignalIds,
      });

      ctx.antennaController.restoreSnapshot({
        selectedArray: snap.antenna.selectedArray,
        azimuth: snap.antenna.azimuth,
        elevation: snap.antenna.elevation,
      });

      // 6. Threat & Event Director / Narrative / Objectives / Hints
      ctx.threatRuntimeState.restoreSnapshot({
        threatPhase: snap.threat.threatPhase as ThreatProgressionPhase,
        completedEventIds: snap.threat.completedEventIds,
      });

      ctx.narrativeRegistry.restoreSnapshot({
        discoveredFacts: snap.narrative.revealedFacts as NarrativeFactId[],
        discoveryTimestamps: {},
      });

      if (snap.investigation && ctx.investigationStore) {
        ctx.investigationStore.restoreSnapshot(snap.investigation);
      }

      if (snap.objectives.activeObjectiveId) {
        ctx.objectiveController.activateObjective(snap.objectives.activeObjectiveId);
      }
      for (const compId of snap.objectives.completedObjectiveIds) {
        ctx.objectiveController.completeObjective(compId);
      }

      ctx.hintController.restoreSnapshot({
        activeObjectiveId: snap.objectives.activeObjectiveId,
        currentTier: (snap.hints.activeHintLevel as HintTier) ?? 'None',
        elapsedSinceProgressSeconds: snap.hints.struggleTimeSeconds ?? 0,
        lastHintText: null,
      });

      // 7. Player Transform
      ctx.controller.teleportTo(
        new Vector3(snap.player.position[0], snap.player.position[1], snap.player.position[2]),
        snap.player.yaw,
        snap.player.pitch ?? 0,
      );

      return true;
    } finally {
      // Release locks and resume physics
      ctx.controller.releaseInputLock(lockToken);
      physicsEngine?.setTimeStep(1 / 60);
    }
  }

  /**
   * High-level: saves current game state to storage.
   */
  async saveGame(slotId = 'quicksave'): Promise<boolean> {
    const snapshot = this.captureSaveSnapshot(slotId);
    return this.saveManager.saveGame(slotId, snapshot);
  }

  /**
   * High-level: loads and restores game state from storage.
   */
  async loadGame(slotId = 'quicksave'): Promise<boolean> {
    const snapshot = await this.saveManager.loadGame(slotId);
    if (!snapshot) return false;
    return this.restoreSaveSnapshot(snapshot);
  }

  /**
   * Lists all available saves.
   */
  async listSaves(): Promise<SaveMetadata[]> {
    return this.saveManager.listSaves();
  }

  /**
   * Deletes a save slot.
   */
  async deleteSave(slotId: string): Promise<void> {
    return this.saveManager.deleteSave(slotId);
  }
}
