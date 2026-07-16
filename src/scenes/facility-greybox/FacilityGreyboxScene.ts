/**
 * Milestone 0.5 — Facility Greybox Scene.
 *
 * Orchestrates all facility builders, player controller, interaction system,
 * UI, zone/trigger polling, dev tools (F8 teleport, F9 facility debug) and
 * the test bridge extension.
 *
 * One continuous Babylon.js scene; no scene switches.
 * Zone triggers use AABB polling on onBeforeRenderObservable (not Havok).
 * No per-frame Zustand writes — all progression state lives in FacilityRuntimeState.
 */
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import type {
  SceneCreationContext,
  SceneDefinition,
  SceneHandle,
} from '../../core/scenes/SceneDefinition';
import { InputAction } from '../../core/input/InputAction';
import {
  installTestBridge,
  installInteractionBridge,
  installAccessBridge,
} from '../../game/dev/TestBridge';
import {
  DEFAULT_INTERACTION_CONFIG,
  validateInteractionConfig,
} from '../../game/interaction/InteractionConfig';
import { InteractionDebugView } from '../../game/interaction/InteractionDebugView';
import { InteractionRegistry } from '../../game/interaction/InteractionRegistry';
import { InteractionSystem } from '../../game/interaction/InteractionSystem';
import { DocumentController } from '../../game/interaction/documents/DocumentController';
import { DocumentRegistry } from '../../game/interaction/documents/DocumentRegistry';
import { InspectionController } from '../../game/interaction/inspection/InspectionController';
import { InventoryRegistry } from '../../game/inventory/InventoryRegistry';
import { InventoryService } from '../../game/inventory/InventoryService';
import { DoorRegistry } from '../../game/doors/DoorRegistry';
import { DoorDebugView } from '../../game/doors/DoorDebugView';
import { PickupRegistry } from '../../game/pickups/PickupRegistry';
import { FirstPersonController } from '../../game/player/FirstPersonController';
import { DEFAULT_PLAYER_CONFIG, validatePlayerConfig } from '../../game/player/PlayerConfig';
import { CheckpointRegistry } from '../../game/facility/Checkpoint';
import { FacilityRuntimeState } from '../../game/facility/FacilityRuntimeState';
import { TeleportRegistry } from '../../game/facility/TeleportRegistry';
import { TriggerVolumeSet } from '../../game/facility/TriggerVolume';
import { ZoneRegistry } from '../../game/facility/ZoneRegistry';
import { validateFacilityData } from '../../game/facility/FacilityValidator';
import { DocumentReaderView } from '../../ui/interaction/DocumentReaderView';
import { InspectionOverlay } from '../../ui/interaction/InspectionOverlay';
import { InteractionPromptView } from '../../ui/interaction/InteractionPromptView';
import { InventoryNotificationView } from '../../ui/inventory/InventoryNotificationView';
import { InventoryViewer } from '../../ui/inventory/InventoryViewer';
import { FacilityMaterials } from './FacilityMaterials';
import { FacilityGeometryHelper } from './FacilityGeometryHelper';
import type { FacilitySceneContext } from './FacilitySceneContext';
import { TeleportMenuOverlay } from './overlay/TeleportMenuOverlay';
import { FacilityDebugOverlay } from './overlay/FacilityDebugOverlay';
import { PowerDebugOverlay } from './overlay/PowerDebugOverlay';
import { FACILITY_ITEM_DEFS } from './facilityItemDefinitions';
import { FACILITY_DOCUMENTS } from './facilityDocumentDefinitions';
import { FACILITY_ZONES } from './facilityZoneDefinitions';
import { FACILITY_CHECKPOINTS } from './facilityCheckpointDefinitions';
import { FACILITY_TELEPORTS } from './facilityTeleportDefinitions';
import { ALL_DOOR_DEFS } from './facilityDoorDefinitions';
import { buildMountainApproach } from './builders/buildMountainApproach';
import { buildPerimeterGate } from './builders/buildPerimeterGate';
import { buildCourtyard } from './builders/buildCourtyard';
import { buildControlBuilding } from './builders/buildControlBuilding';
import { buildGeneratorBuilding } from './builders/buildGeneratorBuilding';
import { buildCableTunnel } from './builders/buildCableTunnel';
import { buildStaffQuarters } from './builders/buildStaffQuarters';
import { buildSupervisorOffice } from './builders/buildSupervisorOffice';
import { buildRooftopAntennaDeck } from './builders/buildRooftopAntennaDeck';
import type { AccessRequirement } from '../../game/access/AccessRequirement';
import type { PowerAccessQuery } from '../../game/access/PowerAccessQuery';
import { PowerNetwork } from '../../game/power/PowerNetwork';
import { validatePowerNetworkData } from '../../game/power/PowerValidation';
import { GeneratorController } from '../../game/generator/GeneratorController';
import { BreakerController } from '../../game/electrical/BreakerController';
import { DistributionPanelController } from '../../game/electrical/DistributionPanelController';
import { EmergencyPowerController } from '../../game/electrical/EmergencyPowerController';
import { PowerPanelSession } from '../../game/interaction/power/PowerPanelSession';
import { DistributionPanelView } from '../../ui/power/DistributionPanelView';
import { PowerStatusView } from '../../ui/power/PowerStatusView';
import { GeneratorStatusView } from '../../ui/power/GeneratorStatusView';
import {
  FACILITY_POWER_SOURCES,
  FACILITY_POWER_CIRCUITS,
  FACILITY_POWER_LOADS,
  GENERATOR_SOURCE_ID,
  BATTERY_SOURCE_ID,
} from './power/facilityPowerDefinitions';
import { buildDistributionPanel } from './power/buildDistributionPanel';
import { buildPoweredIndicators, INDICATORS } from './power/buildPoweredIndicators';
import type { PowerCircuitId } from '../../game/power/PowerCircuitId';
import type { PowerSourceId } from '../../game/power/PowerSourceId';

const SPAWN_POSITION = new Vector3(-58, 0.1, 0);
const SPAWN_YAW = 0; // facing east (+X)

/**
 * Position caching threshold: skip zone/trigger update when the player has
 * moved less than this distance since the last update (metres).
 */
const POSITION_CHANGE_THRESHOLD = 0.1;

export const facilityGreyboxSceneDefinition: SceneDefinition = {
  id: 'facility-greybox',

  async create(context: SceneCreationContext): Promise<SceneHandle> {
    // ----- Config validation ------------------------------------------------
    const playerProblems = validatePlayerConfig(DEFAULT_PLAYER_CONFIG);
    const interactionProblems = validateInteractionConfig(DEFAULT_INTERACTION_CONFIG);
    if (playerProblems.length > 0 || interactionProblems.length > 0) {
      throw new Error(`Invalid config: ${[...playerProblems, ...interactionProblems].join('; ')}`);
    }

    // ----- Scene setup -------------------------------------------------------
    const scene = new Scene(context.engine);
    scene.clearColor = new Color4(0.06, 0.07, 0.1, 1);

    // Lighting: overcast daylight mood
    const hemi = new HemisphericLight('hemi', new Vector3(0.1, 1, 0.2), scene);
    hemi.intensity = 0.7;
    hemi.groundColor = new Color3(0.08, 0.09, 0.12);
    const sun = new DirectionalLight('sun', new Vector3(-0.4, -1, 0.3), scene);
    sun.intensity = 0.55;
    sun.diffuse = new Color3(0.9, 0.88, 0.82);

    const physicsPlugin = await context.physics.enableForScene(scene);

    // ----- Registries -------------------------------------------------------
    const interactionRegistry = new InteractionRegistry();
    const documentRegistry = new DocumentRegistry();
    const itemRegistry = new InventoryRegistry();
    const doorRegistry = new DoorRegistry();
    const pickupRegistry = new PickupRegistry();
    const zoneRegistry = new ZoneRegistry();
    const triggerVolumes = new TriggerVolumeSet();
    const checkpointRegistry = new CheckpointRegistry();
    const teleportRegistry = new TeleportRegistry();

    // ----- Services ---------------------------------------------------------
    const inventory = new InventoryService(itemRegistry);
    const facilityState = new FacilityRuntimeState();

    // ----- Power domain (Milestone 0.6) --------------------------------------
    const powerNetwork = new PowerNetwork();
    const generatorController = new GeneratorController();
    const powerQuery: PowerAccessQuery = {
      isCircuitEnergized: (circuitId) => powerNetwork.isCircuitEnergized(circuitId),
    };

    // ----- Register static definitions -------------------------------------
    for (const itemDef of FACILITY_ITEM_DEFS) {
      itemRegistry.register(itemDef);
    }
    for (const doc of FACILITY_DOCUMENTS) {
      documentRegistry.register(doc);
    }
    for (const zone of FACILITY_ZONES) {
      zoneRegistry.register(zone);
    }
    for (const cp of FACILITY_CHECKPOINTS) {
      checkpointRegistry.register(cp);
    }
    for (const tp of FACILITY_TELEPORTS) {
      teleportRegistry.register(tp);
    }
    for (const source of FACILITY_POWER_SOURCES) {
      powerNetwork.registerSource(source);
    }
    for (const circuit of FACILITY_POWER_CIRCUITS) {
      powerNetwork.registerCircuit(circuit);
    }
    for (const load of FACILITY_POWER_LOADS) {
      powerNetwork.registerLoad(load);
    }

    if (context.environment.isDevelopment) {
      const powerProblems = validatePowerNetworkData({
        sources: FACILITY_POWER_SOURCES,
        circuits: FACILITY_POWER_CIRCUITS,
        loads: FACILITY_POWER_LOADS,
      });
      if (powerProblems.length > 0) {
        throw new Error(`[PowerValidator] ${powerProblems.join('; ')}`);
      }
    }

    // Per-circuit breakers (all sourced from the generator; the emergency
    // circuit is additionally pre-energized from the battery below,
    // independent of its breaker's own Open/Closed bookkeeping).
    const breakers = new Map<PowerCircuitId, BreakerController>();
    for (const circuit of FACILITY_POWER_CIRCUITS) {
      breakers.set(
        circuit.id,
        new BreakerController(
          {
            id: `brk-${circuit.id}`,
            circuitId: circuit.id,
            sourceId: GENERATOR_SOURCE_ID,
            displayName: circuit.displayName,
          },
          powerNetwork,
        ),
      );
    }
    const distributionPanel = new DistributionPanelController(
      powerNetwork,
      breakers,
      GENERATOR_SOURCE_ID,
      BATTERY_SOURCE_ID,
    );
    const emergencyPower = new EmergencyPowerController(
      powerNetwork,
      GENERATOR_SOURCE_ID,
      BATTERY_SOURCE_ID,
    );
    emergencyPower.initializeEmergencyPower();

    // ----- Shared resources -------------------------------------------------
    const materials = new FacilityMaterials(scene);
    const geo = new FacilityGeometryHelper(scene, materials.palette);

    // ----- Scene context ----------------------------------------------------
    const ctx: FacilitySceneContext = {
      scene,
      environment: context.environment,
      interactionRegistry,
      documentRegistry,
      itemRegistry,
      doorRegistry,
      pickupRegistry,
      zoneRegistry,
      triggerVolumes,
      checkpointRegistry,
      teleportRegistry,
      inventory,
      facilityState,
      powerNetwork,
      generatorController,
      distributionPanel,
      emergencyPower,
      powerQuery,
      materials,
      geo,
      devConfig: { isDevelopment: context.environment.isDevelopment },
    };

    // ----- Dev-time data validation (throws in dev if data is invalid) ------
    if (context.environment.isDevelopment) {
      // Collect required item ids from door lock requirements
      const doorRequiredItemIds: string[] = [];
      for (const doorDef of ALL_DOOR_DEFS) {
        if (doorDef.lock !== undefined) {
          collectRequiredItemIds(doorDef.lock.requirement, doorRequiredItemIds);
        }
      }
      const problems = validateFacilityData({
        zones: FACILITY_ZONES,
        checkpoints: FACILITY_CHECKPOINTS,
        teleports: FACILITY_TELEPORTS,
        registeredItemIds: FACILITY_ITEM_DEFS.map((d) => d.id),
        doorRequiredItemIds,
        // Pickup placements: we don't track zone membership statically, so pass empty.
        pickupPlacements: [],
        doorGrants: [],
      });
      if (problems.length > 0) {
        // Non-fatal: log to console so the scene still loads.
        console.warn(`[FacilityValidator]`, problems.join('; '));
      }
    }

    // ----- Build level geometry + interactions ------------------------------
    buildMountainApproach(ctx);
    buildPerimeterGate(ctx, scene);
    buildCourtyard(ctx);
    buildControlBuilding(ctx, scene);
    buildGeneratorBuilding(ctx, scene);
    buildCableTunnel(ctx);
    buildStaffQuarters(ctx, scene);
    buildSupervisorOffice(ctx, scene);
    buildRooftopAntennaDeck(ctx, scene);
    buildDistributionPanel(ctx, scene);
    const powerIndicatorBindings = buildPoweredIndicators(ctx, scene);

    context.onPhysicsReady();

    // ----- Player -----------------------------------------------------------
    const controller = new FirstPersonController(
      scene,
      DEFAULT_PLAYER_CONFIG,
      { position: SPAWN_POSITION, yaw: SPAWN_YAW, pitch: 0 },
      {
        input: context.input,
        settings: context.settings,
        environment: context.environment,
        canvas: context.canvas,
        overlayParent: context.overlayParent,
        pointerLockPromptLabel: 'Click to enter The Last Signal — Facility',
      },
    );

    // ----- UI views ---------------------------------------------------------
    const promptView = new InteractionPromptView(context.overlayParent);
    const inspectionOverlay = new InspectionOverlay(context.overlayParent);
    const readerView = new DocumentReaderView(context.overlayParent);
    const notificationView = new InventoryNotificationView(context.overlayParent);
    const inventoryViewer = new InventoryViewer(context.overlayParent, inventory, itemRegistry);
    const distributionPanelView = new DistributionPanelView(
      context.overlayParent,
      () => distributionPanel.getPanelData(),
      (circuitId) => distributionPanel.toggleCircuit(circuitId as PowerCircuitId),
    );
    const powerStatusView = new PowerStatusView(context.overlayParent, powerNetwork);
    const generatorStatusView = new GeneratorStatusView(context.overlayParent, generatorController);
    const powerPanelSession = new PowerPanelSession(
      distributionPanel,
      distributionPanelView,
      controller,
      context.canvas,
    );

    // Inventory events → pickup notifications.
    const unsubInventory = inventory.subscribe((event) => {
      if (event.kind === 'item-added') {
        const def = itemRegistry.get(event.itemId);
        notificationView.notify(def?.displayName ?? event.itemId);
      }
    });

    // ----- Interaction controllers -----------------------------------------
    const inspection = new InspectionController(scene, controller, inspectionOverlay);
    const documentController = new DocumentController(
      documentRegistry,
      readerView,
      controller,
      context.canvas,
      context.errorReporter,
    );

    const debugView = context.environment.isDevelopment
      ? new InteractionDebugView(scene, DEFAULT_INTERACTION_CONFIG.probeDistance)
      : null;
    const doorDebugView = context.environment.isDevelopment
      ? new DoorDebugView(scene, doorRegistry)
      : null;

    const interaction = new InteractionSystem({
      scene,
      player: controller,
      input: context.input,
      registry: interactionRegistry,
      environment: context.environment,
      errorReporter: context.errorReporter,
      promptView,
      inspection,
      documents: documentController,
      config: DEFAULT_INTERACTION_CONFIG,
      debugView,
      inventoryViewer,
      powerPanel: powerPanelSession,
    });

    // ----- Dev overlays (F7, F8, F9) ---------------------------------------
    let removeDoorDebugListener: (() => void) | null = null;
    if (doorDebugView !== null) {
      removeDoorDebugListener = context.input.onAction((action) => {
        if (action === InputAction.ToggleDoorDebug) {
          doorDebugView.toggle();
        }
      });
    }

    // F8 teleport menu (dev only)
    let teleportMenu: TeleportMenuOverlay | null = null;
    let removeTeleportListener: (() => void) | null = null;
    if (context.environment.isDevelopment) {
      teleportMenu = new TeleportMenuOverlay(context.overlayParent, FACILITY_TELEPORTS, controller);
      removeTeleportListener = context.input.onAction((action) => {
        if (action === InputAction.ToggleTeleport) {
          teleportMenu?.toggle();
        }
      });
    }

    // F9 facility debug overlay (dev only)
    let facilityDebugOverlay: FacilityDebugOverlay | null = null;
    let removeFacilityDebugListener: (() => void) | null = null;
    if (context.environment.isDevelopment) {
      facilityDebugOverlay = new FacilityDebugOverlay(
        context.overlayParent,
        facilityState,
        zoneRegistry,
        checkpointRegistry,
      );
      removeFacilityDebugListener = context.input.onAction((action) => {
        if (action === InputAction.ToggleFacilityDebug) {
          facilityDebugOverlay?.toggle();
        }
      });
    }

    // F10 power-network debug overlay (dev only)
    let powerDebugOverlay: PowerDebugOverlay | null = null;
    let removePowerDebugListener: (() => void) | null = null;
    if (context.environment.isDevelopment) {
      powerDebugOverlay = new PowerDebugOverlay(
        context.overlayParent,
        scene,
        powerNetwork,
        generatorController,
        INDICATORS.map((i) => ({ id: i.id, position: i.position, circuitId: i.circuitId })),
      );
      removePowerDebugListener = context.input.onAction((action) => {
        if (action === InputAction.TogglePowerDebug) {
          powerDebugOverlay?.toggle();
        }
      });
    }

    // ----- Power/generator event wiring → facilityState mirror + progression -
    const unsubGeneratorEvents = generatorController.subscribe((event) => {
      const snap = generatorController.snapshot;
      facilityState.recordGeneratorState(snap.state);
      facilityState.recordFuelValve(snap.fuelValve);
      facilityState.recordStarterBattery(snap.starterBattery);
      facilityState.recordEmergencyStop(snap.emergencyStop);
      facilityState.recordControlSelector(snap.selector);
      facilityState.recordMainBreaker(snap.mainBreaker);

      if (event.kind === 'GeneratorStarted') {
        facilityState.tryAdvancePhase('GeneratorStarted');
      } else if (event.kind === 'MainBreakerClosed') {
        emergencyPower.onGeneratorMainBreakerClosed();
        facilityState.tryAdvancePhase('MainPowerAvailable');
      } else if (
        event.kind === 'MainBreakerOpened' ||
        event.kind === 'GeneratorFaulted' ||
        (event.kind === 'GeneratorStopped' && snap.state === 'Offline')
      ) {
        emergencyPower.onGeneratorOffline();
      }
    });

    const unsubPowerEvents = powerNetwork.subscribe((event) => {
      if (event.circuitId !== undefined) {
        const state = powerNetwork.getCircuitState(event.circuitId);
        if (state !== undefined) {
          facilityState.recordCircuitState(event.circuitId, state.requested, state.effective);
        }
      }
      if (event.kind === 'source-state-changed' && event.sourceId !== undefined) {
        const state = powerNetwork.getSourceState(event.sourceId);
        if (state !== undefined) {
          facilityState.recordSourceAvailability(event.sourceId, state.availability);
        }
      }
    });

    // ----- Test bridge ------------------------------------------------------
    const removeBridge = installTestBridge(controller, context.environment, context.settings);
    const removeInteractionBridge = installInteractionBridge(
      interaction,
      inspection,
      readerView,
      scene,
      context.environment,
    );
    const removeAccessBridge = installAccessBridge(
      inventory,
      pickupRegistry,
      doorRegistry,
      context.environment,
    );

    // Extend the test bridge with facility-specific surface.
    if (context.environment.isDevelopment) {
      const bridge = window.__TLS_TEST__;
      if (bridge !== undefined) {
        const b = bridge as unknown as Record<string, unknown>;
        b['getFacilityState'] = () => facilityState.getSnapshot();
        b['teleportTo'] = (id: string) => {
          const tp = teleportRegistry.get(id);
          if (tp === undefined) return false;
          controller.teleportTo(new Vector3(tp.position.x, tp.position.y, tp.position.z), tp.yaw);
          return true;
        };

        // ----- Milestone 0.6: power-network test surface -------------------
        b['getPowerSnapshot'] = () => powerNetwork.getSnapshot();
        b['getGeneratorSnapshot'] = () => generatorController.snapshot;
        b['getGeneratorReadiness'] = () => generatorController.readiness;
        b['generatorAction'] = (action: string) => {
          switch (action) {
            case 'openFuelValve':
              generatorController.openFuelValve();
              return true;
            case 'closeFuelValve':
              generatorController.closeFuelValve();
              return true;
            case 'connectBattery':
              generatorController.connectBattery();
              return true;
            case 'disconnectBattery':
              generatorController.disconnectBattery();
              return true;
            case 'releaseEmergencyStop':
              generatorController.releaseEmergencyStop();
              return true;
            case 'engageEmergencyStop':
              generatorController.engageEmergencyStop();
              return true;
            case 'setSelectorManual':
              generatorController.setSelectorManual();
              return true;
            case 'inspect':
              generatorController.inspect();
              return true;
            case 'closeMainBreaker':
              return generatorController.closeMainBreaker() === null;
            case 'stop':
              generatorController.stop();
              return true;
            default:
              return false;
          }
        };
        b['requestCircuit'] = (circuitId: string, sourceId: string, desired: 'on' | 'off') =>
          powerNetwork.requestCircuit(
            circuitId as PowerCircuitId,
            sourceId as PowerSourceId,
            desired,
          );
        b['toggleCircuit'] = (circuitId: string) =>
          distributionPanel.toggleCircuit(circuitId as PowerCircuitId);
        b['openDistributionPanel'] = () => interaction.devActivate('fg-distribution-panel');
        b['closeDistributionPanel'] = () => {
          powerPanelSession.close();
        };
        b['isDistributionPanelOpen'] = () => distributionPanelView.isOpen;
        b['activateReceiver'] = () => interaction.devActivate('fg-receiver');
        b['resetFacility'] = () => {
          facilityState.reset();
          powerNetwork.reset();
          generatorController.reset();
          for (const breaker of breakers.values()) {
            breaker.reset();
          }
          // Close via the session (not distributionPanel.closePanel()
          // directly) so the DOM view and input lock are torn down too —
          // the domain controller's closePanel() alone only clears its own
          // isOpen flag.
          powerPanelSession.close();
          emergencyPower.initializeEmergencyPower();
          controller.teleportTo(SPAWN_POSITION, SPAWN_YAW);
        };
      }
    }

    // ----- AABB polling — zone + trigger per-frame update ------------------
    // Position caching avoids redundant AABB checks on stationary frames.
    const lastCheckedPosition = new Vector3(NaN, NaN, NaN);

    const zoneObserver = scene.onBeforeRenderObservable.add(() => {
      // Tick the facility debug overlay (rate-limited internally).
      facilityDebugOverlay?.tick();
      powerDebugOverlay?.tick();

      // Read motor's foot position without allocating.
      const motorState = (
        controller as unknown as { motor: { motorState: { footPosition: Vector3 } } }
      ).motor?.motorState;
      if (motorState === undefined) return;
      const fp = motorState.footPosition;

      const dx = fp.x - lastCheckedPosition.x;
      const dz = fp.z - lastCheckedPosition.z;
      const dy = fp.y - lastCheckedPosition.y;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (
        distSq < POSITION_CHANGE_THRESHOLD * POSITION_CHANGE_THRESHOLD &&
        !isNaN(lastCheckedPosition.x)
      ) {
        return;
      }
      lastCheckedPosition.copyFrom(fp);

      const pos = { x: fp.x, y: fp.y, z: fp.z };
      zoneRegistry.update(pos);
      triggerVolumes.update(pos);

      // Power/generator status widgets: sticky facility board once the
      // generator hall has been discovered; generator readout only while
      // actually inside the generator hall/electrical annex.
      if (
        !powerStatusView.isVisible &&
        (zoneRegistry.isDiscovered('fg-zone-generator-hall') ||
          zoneRegistry.isDiscovered('fg-zone-control-room'))
      ) {
        powerStatusView.show(powerNetwork);
      }
      const insideGeneratorArea =
        zoneRegistry.isCurrentlyInside('fg-zone-generator-hall') ||
        zoneRegistry.isCurrentlyInside('fg-zone-generator-electrical');
      if (insideGeneratorArea && !generatorStatusView.isVisible) {
        generatorStatusView.show();
      } else if (!insideGeneratorArea && generatorStatusView.isVisible) {
        generatorStatusView.hide();
      }

      // Checkpoint respawn: if the player falls out of bounds, warp to latest.
      if (fp.y < -10) {
        const cp = checkpointRegistry.latestCheckpoint;
        if (cp !== null) {
          controller.teleportTo(
            new Vector3(cp.spawnPosition.x, cp.spawnPosition.y, cp.spawnPosition.z),
            cp.spawnYaw,
          );
        } else {
          controller.teleportTo(SPAWN_POSITION, SPAWN_YAW);
        }
      }
    });

    return {
      scene,
      markerText: 'Milestone 0.6 — Power Network',
      getDebugFields: () => {
        const snap = facilityState.getSnapshot();
        const genSnap = generatorController.snapshot;
        const powerSnap = powerNetwork.getSnapshot();
        const generatorSource = powerSnap.sources.find((s) => s.id === GENERATOR_SOURCE_ID);
        const batterySource = powerSnap.sources.find((s) => s.id === BATTERY_SOURCE_ID);
        const activeCircuits = powerSnap.circuits.filter((c) => c.effective === 'energized').length;
        const requestedCircuits = powerSnap.circuits.filter((c) => c.requested === 'on').length;
        return [
          ...controller.getDebugFields(),
          ...interaction.getDebugFields(),
          ['Inventory', `${inventory.getSnapshot().itemTypeCount} type(s)`],
          ['Phase', snap.progressionPhase],
          ['Complete', snap.isComplete ? 'yes' : 'no'],
          ['Zones', `${zoneRegistry.discoveredCount}/${zoneRegistry.totalCount}`],
          ['Checkpoints', `${checkpointRegistry.activatedCount}/${checkpointRegistry.totalCount}`],
          ['Triggers', `${triggerVolumes.count} registered`],
          ['Gen state', genSnap.state],
          [
            'Fuel/Battery/E-stop',
            `${genSnap.fuelValve}/${genSnap.starterBattery}/${genSnap.emergencyStop}`,
          ],
          ['Selector/Breaker', `${genSnap.selector}/${genSnap.mainBreaker}`],
          [
            'Gen capacity',
            generatorSource !== undefined
              ? `${generatorSource.allocatedCapacity}/${generatorSource.maxCapacity} (${generatorSource.availability})`
              : '—',
          ],
          [
            'Batt capacity',
            batterySource !== undefined
              ? `${batterySource.allocatedCapacity}/${batterySource.maxCapacity} (${batterySource.availability})`
              : '—',
          ],
          [
            'Circuits',
            `${activeCircuits} energized / ${requestedCircuits} requested / ${powerSnap.circuits.length} total`,
          ],
          ['Panel', distributionPanel.isOpen ? 'open' : 'closed'],
          ['Receiver activated', snap.power.receiverActivated ? 'yes' : 'no'],
          ['Power milestone', snap.power.powerNetworkOperational ? 'OPERATIONAL' : 'pending'],
        ];
      },
      dispose(): void {
        // Remove extended bridge fields.
        if (context.environment.isDevelopment) {
          const bridge = window.__TLS_TEST__;
          if (bridge !== undefined) {
            const b = bridge as unknown as Record<string, unknown>;
            delete b['getFacilityState'];
            delete b['teleportTo'];
            delete b['getPowerSnapshot'];
            delete b['getGeneratorSnapshot'];
            delete b['getGeneratorReadiness'];
            delete b['generatorAction'];
            delete b['requestCircuit'];
            delete b['toggleCircuit'];
            delete b['openDistributionPanel'];
            delete b['closeDistributionPanel'];
            delete b['isDistributionPanelOpen'];
            delete b['activateReceiver'];
            delete b['resetFacility'];
          }
        }

        removeAccessBridge();
        removeInteractionBridge();
        removeBridge();
        removeDoorDebugListener?.();
        removeTeleportListener?.();
        removeFacilityDebugListener?.();
        removePowerDebugListener?.();

        if (zoneObserver !== null) {
          scene.onBeforeRenderObservable.remove(zoneObserver);
        }

        unsubInventory();
        unsubGeneratorEvents();
        unsubPowerEvents();
        for (const binding of powerIndicatorBindings) {
          binding.dispose();
        }

        facilityDebugOverlay?.dispose();
        powerDebugOverlay?.dispose();
        teleportMenu?.dispose();
        powerPanelSession.dispose();
        distributionPanelView.dispose();
        powerStatusView.dispose();
        generatorStatusView.dispose();
        interaction.dispose();
        debugView?.dispose();
        doorDebugView?.dispose();
        documentController.dispose();
        inspection.dispose();
        readerView.dispose();
        inventoryViewer.dispose();
        notificationView.dispose();
        inspectionOverlay.dispose();
        promptView.dispose();
        controller.dispose();

        interactionRegistry.dispose();
        documentRegistry.clear();
        doorRegistry.clear();
        pickupRegistry.clear();
        zoneRegistry.clear();
        triggerVolumes.clear();
        checkpointRegistry.clear();
        teleportRegistry.clear();
        itemRegistry.clear();
        generatorController.dispose();
        powerNetwork.dispose();

        geo.dispose();
        materials.dispose();

        scene.dispose();
        physicsPlugin.dispose();
      },
    };
  },
};

// ---- helpers ---------------------------------------------------------------

/**
 * Recursively collect all item ids referenced in an AccessRequirement tree.
 * Supports ItemRequirement, AnyOfRequirement, AllOfRequirement.
 */
function collectRequiredItemIds(req: AccessRequirement, out: string[]): void {
  if (req.kind === 'item') {
    out.push(req.itemId);
  } else if (req.kind === 'any-of' || req.kind === 'all-of') {
    for (const child of req.children) {
      collectRequiredItemIds(child, out);
    }
  }
}
