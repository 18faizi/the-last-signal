/**
 * Comprehensive Unit Tests for Persistent Save/Load System (Milestone 1.2).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  type SaveSnapshot,
  validateSaveSnapshot,
  migrateSaveSnapshot,
} from '../schema';
import { SaveManager } from '../SaveManager';
import { SaveRestoreService, type SaveRestoreContext } from '../SaveRestoreService';
import { FacilityRuntimeState } from '../../../game/facility/FacilityRuntimeState';
import { ZoneRegistry } from '../../../game/facility/ZoneRegistry';
import { CheckpointRegistry } from '../../../game/facility/Checkpoint';
import { PowerNetwork } from '../../../game/power/PowerNetwork';
import { GeneratorController } from '../../../game/generator/GeneratorController';
import { InventoryService } from '../../../game/inventory/InventoryService';
import { InventoryRegistry } from '../../../game/inventory/InventoryRegistry';
import { PickupRegistry } from '../../../game/pickups/PickupRegistry';
import { DoorRegistry } from '../../../game/doors/DoorRegistry';
import { ReceiverController } from '../../../game/receiver/ReceiverController';
import { AntennaController } from '../../../game/antenna/AntennaController';
import { ThreatController } from '../../../game/threat/ThreatController';
import { ThreatRuntimeState } from '../../../game/threat/ThreatRuntimeState';
import { NarrativeFactRegistry } from '../../../game/narrative/NarrativeFactRegistry';
import { ObjectiveController } from '../../../game/objectives/ObjectiveController';
import { HintController } from '../../../game/hints/HintController';
import { GameFlowState } from '../../../game/flow/GameFlowState';
import type { FirstPersonController } from '../../../game/player/FirstPersonController';
import type { DoorController } from '../../../game/doors/DoorController';
import type { AnyPickupTarget } from '../../../game/pickups/PickupController';
import { SoundStimulusRegistry } from '../../../game/threat/perception/SoundStimulusRegistry';
import { FACILITY_THREAT_DEFINITION } from '../../../scenes/facility-greybox/threat/facilityThreatDefinitions';
import type { ThreatNavGraph } from '../../../game/threat/behavior/ThreatSearchPattern';
import { asSignalId } from '../../../game/signal/SignalId';

const TEST_GRAPH: ThreatNavGraph = {
  nodes: [
    {
      id: 'node-home',
      position: { x: 0, y: 0, z: 0 },
      adjacency: ['node-mid'],
      zoneId: 'z',
      searchPriority: 1,
    },
    {
      id: 'node-mid',
      position: { x: 5, y: 0, z: 0 },
      adjacency: ['node-home'],
      zoneId: 'z',
      searchPriority: 2,
    },
  ],
};

function createMockSnapshot(overrides: Partial<SaveSnapshot> = {}): SaveSnapshot {
  return {
    saveVersion: CURRENT_SAVE_SCHEMA_VERSION,
    metadata: {
      slotId: 'test-slot-1',
      saveVersion: CURRENT_SAVE_SCHEMA_VERSION,
      timestamp: 1700000000000,
      playtimeSeconds: 120,
      chapterId: 'FacilityExploration',
    },
    player: {
      position: [10, 1.5, -25],
      yaw: 1.57,
      pitch: 0.1,
      crouched: false,
      sprinting: false,
      activeCheckpointId: 'fg-cp-generator',
    },
    facility: {
      progressionPhase: 'GeneratorRestoration',
      discoveredZoneIds: ['fg-zone-courtyard', 'fg-zone-generator-hall'],
      activeZoneId: 'fg-zone-generator-hall',
      openedDoorIds: ['door-courtyard-main'],
      unlockedDoorIds: ['door-courtyard-main'],
      collectedPickupIds: ['pickup-key-generator'],
      activatedCheckpointIds: ['fg-cp-gate', 'fg-cp-generator'],
    },
    inventory: {
      itemIds: ['item-card-level-1'],
      activeSlot: null,
      inspectionHistory: [],
    },
    power: {
      generatorState: 'Running',
      breakerStates: { 'pwr-ckt-doors': true },
      activeCircuitIds: ['pwr-ckt-doors'],
      powerPhase: 'Operational',
    },
    signal: {
      receiverState: 'Tuning',
      currentFrequencyMHz: 1420.5,
      bandwidth: 2.5,
      lockConfidence: 0.85,
      decodedSignalIds: ['sig-carrier-alpha'],
      signalPhase: 'Tuning',
    },
    antenna: {
      azimuth: 45.0,
      elevation: 12.5,
      alignmentScore: 0.9,
      waveguideRoute: 'Direct',
      telemetryReport: true,
      selectedArray: 'ant-array-north',
    },
    threat: {
      threatPhase: 'Hunting',
      threatState: 'Searching',
      suspicion: 0.4,
      detection: 0.2,
      completedEventIds: ['threat-manifestation-power-loss'],
      encounterSurvivals: 1,
    },
    narrative: {
      revealedFacts: ['SecurityLogRead', 'GeneratorRestored'],
      readDocumentIds: [],
    },
    objectives: {
      activeObjectiveId: 'obj-analyze-source',
      completedObjectiveIds: ['obj-restore-power'],
      activeStepIndex: 0,
    },
    hints: {
      activeHintLevel: 'Directional',
      struggleTimeSeconds: 45,
    },
    ...overrides,
  };
}

function createMockContext(): {
  context: SaveRestoreContext;
  getTeleported: () => { position: Vector3; yaw: number; pitch: number } | null;
  inputLocks: { acquired: number; released: number };
  physicsTimestepHistory: number[];
} {
  const facilityState = new FacilityRuntimeState();
  const zoneRegistry = new ZoneRegistry();
  const checkpointRegistry = new CheckpointRegistry();
  const powerNetwork = new PowerNetwork();
  const generatorController = new GeneratorController();
  const itemRegistry = new InventoryRegistry();
  itemRegistry.register({
    id: 'item-card-level-1',
    displayName: 'Keycard Level 1',
    category: 'card',
  });
  const inventory = new InventoryService(itemRegistry);
  const pickupRegistry = new PickupRegistry();
  const doorRegistry = new DoorRegistry();
  const receiverController = new ReceiverController();
  const antennaController = new AntennaController();
  const stimuli = new SoundStimulusRegistry();
  const graph = TEST_GRAPH;
  const threatController = new ThreatController({
    definition: FACILITY_THREAT_DEFINITION,
    graph,
    stimuli,
    isDoorPassable: () => true,
    isPositionAllowed: () => true,
  });
  const threatRuntimeState = new ThreatRuntimeState();
  const narrativeRegistry = new NarrativeFactRegistry();
  const objectiveController = new ObjectiveController();
  const hintController = new HintController({
    subtleDelaySeconds: 30,
    directionalDelaySeconds: 60,
    specificDelaySeconds: 90,
  });
  const gameFlowState = new GameFlowState();

  const physicsTimestepHistory: number[] = [];
  const sceneMock = {
    getPhysicsEngine: () => ({
      setTimeStep: (dt: number) => {
        physicsTimestepHistory.push(dt);
      },
    }),
  } as unknown as Scene;

  let teleported: { position: Vector3; yaw: number; pitch: number } | null = null;
  const inputLocks = { acquired: 0, released: 0 };

  const controllerMock = {
    getDebugSnapshot: () => ({
      position: { x: 10, y: 1.5, z: -25 },
      yaw: 1.57,
      pitch: 0.1,
      crouched: false,
      mode: 'walking',
    }),
    acquireInputLock: () => {
      inputLocks.acquired += 1;
      return { reason: 'transition' };
    },
    releaseInputLock: () => {
      inputLocks.released += 1;
    },
    teleportTo: (pos: Vector3, yaw: number, pitch = 0) => {
      teleported = { position: pos.clone(), yaw, pitch };
    },
  } as unknown as FirstPersonController;

  const context: SaveRestoreContext = {
    scene: sceneMock,
    controller: controllerMock,
    facilityState,
    zoneRegistry,
    checkpointRegistry,
    powerNetwork,
    generatorController,
    inventory,
    pickupRegistry,
    doorRegistry,
    receiverController,
    antennaController,
    threatController,
    threatRuntimeState,
    narrativeRegistry,
    objectiveController,
    hintController,
    gameFlowState,
  };

  return { context, getTeleported: () => teleported, inputLocks, physicsTimestepHistory };
}

describe('Save Schema & Validation', () => {
  it('validates a well-formed SaveSnapshot', () => {
    const snap = createMockSnapshot();
    const res = validateSaveSnapshot(snap);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('rejects invalid or incomplete objects', () => {
    expect(validateSaveSnapshot(null).valid).toBe(false);
    expect(validateSaveSnapshot('string').valid).toBe(false);
    expect(validateSaveSnapshot({ saveVersion: 1 }).valid).toBe(false);
  });

  it('migrates version 1 without alteration', () => {
    const snap = createMockSnapshot();
    const migrated = migrateSaveSnapshot(snap);
    expect(migrated.saveVersion).toBe(1);
    expect(migrated.metadata.slotId).toBe('test-slot-1');
  });

  it('throws error when migrating an invalid schema', () => {
    expect(() => migrateSaveSnapshot({ invalid: true })).toThrow(
      /Cannot migrate invalid save data/,
    );
  });
});

describe('SaveManager Storage Engine', () => {
  let manager: SaveManager;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    manager = new SaveManager();
  });

  it('persists and loads a snapshot via fallback engine', async () => {
    const snap = createMockSnapshot({
      metadata: {
        slotId: 'slot-alpha',
        saveVersion: 1,
        timestamp: 1000,
        playtimeSeconds: 50,
        chapterId: 'ch1',
      },
    });
    const saved = await manager.saveGame('slot-alpha', snap);
    expect(saved).toBe(true);

    const loaded = await manager.loadGame('slot-alpha');
    expect(loaded).not.toBeNull();
    expect(loaded?.metadata.slotId).toBe('slot-alpha');
    expect(loaded?.player.position).toEqual([10, 1.5, -25]);
    expect(loaded?.facility.progressionPhase).toBe('GeneratorRestoration');
  });

  it('lists saves sorted by timestamp descending', async () => {
    const snapA = createMockSnapshot({
      metadata: {
        slotId: 'save-a',
        saveVersion: 1,
        timestamp: 1000,
        playtimeSeconds: 10,
        chapterId: 'ch1',
      },
    });
    const snapB = createMockSnapshot({
      metadata: {
        slotId: 'save-b',
        saveVersion: 1,
        timestamp: 2500,
        playtimeSeconds: 30,
        chapterId: 'ch2',
      },
    });

    await manager.saveGame('save-a', snapA);
    await manager.saveGame('save-b', snapB);

    const list = await manager.listSaves();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0]?.slotId).toBe('save-b'); // higher timestamp first
    expect(list[1]?.slotId).toBe('save-a');
  });

  it('deletes saved slot correctly', async () => {
    const snap = createMockSnapshot({
      metadata: {
        slotId: 'to-delete',
        saveVersion: 1,
        timestamp: 1000,
        playtimeSeconds: 5,
        chapterId: 'ch1',
      },
    });
    await manager.saveGame('to-delete', snap);
    expect(await manager.hasSave('to-delete')).toBe(true);

    await manager.deleteSave('to-delete');
    expect(await manager.hasSave('to-delete')).toBe(false);
    expect(await manager.loadGame('to-delete')).toBeNull();
  });
});

describe('SaveRestoreService Execution & Scene Restoration', () => {
  it('captures full valid snapshot from active subsystems', () => {
    const mock = createMockContext();
    const service = new SaveRestoreService(mock.context);

    mock.context.gameFlowState.startGame();
    mock.context.gameFlowState.tick(42);

    const snap = service.captureSaveSnapshot('quicksave');
    expect(snap.saveVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(snap.metadata.slotId).toBe('quicksave');
    expect(snap.metadata.playtimeSeconds).toBe(42);
    expect(snap.player.position).toEqual([10, 1.5, -25]);
    expect(validateSaveSnapshot(snap).valid).toBe(true);
  });

  it('executes atomic deterministic restoration and updates all stores in order', async () => {
    const mock = createMockContext();
    const service = new SaveRestoreService(mock.context);

    // Register door to test door mesh & state updating
    let doorUnlocked = false;
    let doorOpened = false;
    const mockDoor: DoorController = {
      id: 'door-courtyard-main',
      isOpen: false,
      isLocked: true,
      forceUnlock: () => {
        doorUnlocked = true;
      },
      forceLock: () => {
        doorUnlocked = false;
      },
      forceOpen: () => {
        doorOpened = true;
      },
      forceClosed: () => {
        doorOpened = false;
      },
    } as unknown as DoorController;
    mock.context.doorRegistry.register(mockDoor);

    // Register pickup
    let pickupHidden = false;
    const mockPickup: AnyPickupTarget = {
      id: 'pickup-key-generator',
      isCollected: false,
      meshes: [
        {
          setEnabled: (enabled: boolean) => {
            if (!enabled) pickupHidden = true;
          },
          isPickable: true,
        },
      ],
    } as unknown as AnyPickupTarget;
    mock.context.pickupRegistry.register(mockPickup);

    // Register zone
    mock.context.zoneRegistry.register({
      id: 'fg-zone-courtyard',
      label: 'Courtyard',
      aabb: { minX: -100, minY: -10, minZ: -100, maxX: 100, maxY: 10, maxZ: 100 },
    });
    mock.context.zoneRegistry.register({
      id: 'fg-zone-generator-hall',
      label: 'Generator Hall',
      aabb: { minX: 0, minY: 0, minZ: 0, maxX: 10, maxY: 10, maxZ: 10 },
    });

    // Register checkpoint
    mock.context.checkpointRegistry.register({
      id: 'fg-cp-generator',
      label: 'Generator Hall Entrance',
      spawnPosition: { x: 10, y: 1.5, z: -25 },
      spawnYaw: 1.57,
    });

    const snapshot = createMockSnapshot();
    const result = await service.restoreSaveSnapshot(snapshot);

    expect(result).toBe(true);

    // 1. Checkpoints & Zones
    expect(mock.context.zoneRegistry.isDiscovered('fg-zone-courtyard')).toBe(true);
    expect(mock.context.zoneRegistry.isDiscovered('fg-zone-generator-hall')).toBe(true);
    expect(mock.context.checkpointRegistry.isActivated('fg-cp-generator')).toBe(true);
    expect(mock.context.facilityState.progressionPhase).toBe('GeneratorRestoration');

    // 2. Power
    expect(mock.context.generatorController.generatorState).toBe('Running');

    // 3. Inventory & Pickups
    expect(mock.context.inventory.has('item-card-level-1')).toBe(true);
    expect(mockPickup.isCollected).toBe(true);
    expect(pickupHidden).toBe(true);

    // 4. Doors & Access
    expect(doorUnlocked).toBe(true);
    expect(doorOpened).toBe(true);

    // 5. Signal & Antenna
    expect(mock.context.receiverController.isDecoded(asSignalId('sig-carrier-alpha'))).toBe(true);

    // 6. Threat & Narrative
    expect(mock.context.threatRuntimeState.threatPhase).toBe('Hunting');
    expect(mock.context.narrativeRegistry.hasFact('GeneratorRestored')).toBe(true);
    expect(mock.context.narrativeRegistry.hasFact('SecurityLogRead')).toBe(true);

    // 7. Player Transform
    expect(mock.getTeleported()?.position).toEqual(new Vector3(10, 1.5, -25));
    expect(mock.getTeleported()?.yaw).toBe(1.57);

    // 8. Physics pausing & Input lock lifecycle
    expect(mock.inputLocks.acquired).toBe(1);
    expect(mock.inputLocks.released).toBe(1);
    expect(mock.physicsTimestepHistory).toEqual([0, 1 / 60]);
  });

  it('completes end-to-end saveGame and loadGame roundtrip', async () => {
    const mock = createMockContext();
    const manager = new SaveManager();
    const service = new SaveRestoreService(mock.context, manager);

    // Give some initial state
    mock.context.inventory.add('item-card-level-1');
    mock.context.narrativeRegistry.unlockFact('SecurityLogRead');

    // Save
    const saved = await service.saveGame('e2e-slot');
    expect(saved).toBe(true);

    // Reset state to ensure load restores it
    mock.context.inventory.reset();
    mock.context.narrativeRegistry.reset();
    expect(mock.context.inventory.has('item-card-level-1')).toBe(false);
    expect(mock.context.narrativeRegistry.hasFact('SecurityLogRead')).toBe(false);

    // Load and restore
    const loaded = await service.loadGame('e2e-slot');
    expect(loaded).toBe(true);

    // Verify restored
    expect(mock.context.inventory.has('item-card-level-1')).toBe(true);
    expect(mock.context.narrativeRegistry.hasFact('SecurityLogRead')).toBe(true);
  });
});
