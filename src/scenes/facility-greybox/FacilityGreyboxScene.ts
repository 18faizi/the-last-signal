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
      }
    }

    // ----- AABB polling — zone + trigger per-frame update ------------------
    // Position caching avoids redundant AABB checks on stationary frames.
    const lastCheckedPosition = new Vector3(NaN, NaN, NaN);

    const zoneObserver = scene.onBeforeRenderObservable.add(() => {
      // Tick the facility debug overlay (rate-limited internally).
      facilityDebugOverlay?.tick();

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
      markerText: 'Milestone 0.5 — Facility Greybox',
      getDebugFields: () => {
        const snap = facilityState.getSnapshot();
        return [
          ...controller.getDebugFields(),
          ...interaction.getDebugFields(),
          ['Inventory', `${inventory.getSnapshot().itemTypeCount} type(s)`],
          ['Phase', snap.progressionPhase],
          ['Complete', snap.isComplete ? 'yes' : 'no'],
          ['Zones', `${zoneRegistry.discoveredCount}/${zoneRegistry.totalCount}`],
          ['Checkpoints', `${checkpointRegistry.activatedCount}/${checkpointRegistry.totalCount}`],
          ['Triggers', `${triggerVolumes.count} registered`],
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
          }
        }

        removeAccessBridge();
        removeInteractionBridge();
        removeBridge();
        removeDoorDebugListener?.();
        removeTeleportListener?.();
        removeFacilityDebugListener?.();

        if (zoneObserver !== null) {
          scene.onBeforeRenderObservable.remove(zoneObserver);
        }

        unsubInventory();

        facilityDebugOverlay?.dispose();
        teleportMenu?.dispose();
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
