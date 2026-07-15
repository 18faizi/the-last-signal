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
import { DocumentReaderView } from '../../ui/interaction/DocumentReaderView';
import { InspectionOverlay } from '../../ui/interaction/InspectionOverlay';
import { InteractionPromptView } from '../../ui/interaction/InteractionPromptView';
import { InventoryNotificationView } from '../../ui/inventory/InventoryNotificationView';
import { InventoryViewer } from '../../ui/inventory/InventoryViewer';
import { createAccessTestArea } from './createAccessTestArea';

const SPAWN_POSITION = new Vector3(-8, 0.1, 0);
const SPAWN_YAW = Math.PI / 2; // facing east (toward doors)

/**
 * Milestone 0.4 access and inventory test scene.
 *
 * Five corridors (Areas A–E) prove the full unlock loop:
 *   A: direct pickup + ItemRequirement (retain)
 *   B: inspect-before-collect + ItemRequirement (retain)
 *   C: hold pickup + ItemRequirement (consume-one)
 *   D: AnyOf (key-A or card-B)
 *   E: AllOf (key-A and card-B)
 */
export const accessTestSceneDefinition: SceneDefinition = {
  id: 'access-test',

  async create(context: SceneCreationContext): Promise<SceneHandle> {
    const playerProblems = validatePlayerConfig(DEFAULT_PLAYER_CONFIG);
    const interactionProblems = validateInteractionConfig(DEFAULT_INTERACTION_CONFIG);
    if (playerProblems.length > 0 || interactionProblems.length > 0) {
      throw new Error(`Invalid config: ${[...playerProblems, ...interactionProblems].join('; ')}`);
    }

    const scene = new Scene(context.engine);
    scene.clearColor = new Color4(0.04, 0.05, 0.07, 1);

    const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), scene);
    hemi.intensity = 0.85;
    hemi.groundColor = new Color3(0.1, 0.1, 0.14);
    const sun = new DirectionalLight('sun', new Vector3(-0.3, -1, 0.4), scene);
    sun.intensity = 0.35;

    const physicsPlugin = await context.physics.enableForScene(scene);

    // Registries.
    const interactionRegistry = new InteractionRegistry();
    const documentRegistry = new DocumentRegistry();
    const itemRegistry = new InventoryRegistry();
    const doorRegistry = new DoorRegistry();
    const pickupRegistry = new PickupRegistry();

    // Domain services.
    const inventory = new InventoryService(itemRegistry);

    // Build scene geometry + targets.
    const { builder } = createAccessTestArea(
      scene,
      interactionRegistry,
      inventory,
      itemRegistry,
      doorRegistry,
      pickupRegistry,
    );

    context.onPhysicsReady();

    // Player.
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
        pointerLockPromptLabel: 'Click to enter access test',
      },
    );

    // UI views.
    const promptView = new InteractionPromptView(context.overlayParent);
    const inspectionOverlay = new InspectionOverlay(context.overlayParent);
    const readerView = new DocumentReaderView(context.overlayParent);
    const notificationView = new InventoryNotificationView(context.overlayParent);
    const inventoryViewer = new InventoryViewer(context.overlayParent, inventory, itemRegistry);

    // Subscribe to inventory events for notifications.
    const unsubInventory = inventory.subscribe((event) => {
      if (event.kind === 'item-added') {
        const def = itemRegistry.get(event.itemId);
        notificationView.notify(def?.displayName ?? event.itemId);
      }
    });

    // Controllers.
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

    // F7 door debug toggle.
    let removeDoorDebugListener: (() => void) | null = null;
    if (doorDebugView !== null) {
      removeDoorDebugListener = context.input.onAction((action) => {
        if (action === InputAction.ToggleDoorDebug) {
          doorDebugView.toggle();
        }
      });
    }

    // Test bridge.
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

    return {
      scene,
      markerText: 'Milestone 0.4 — Access and Inventory',
      getDebugFields: () => [
        ...controller.getDebugFields(),
        ...interaction.getDebugFields(),
        ['Inventory', `${inventory.getSnapshot().itemTypeCount} item type(s)`],
      ],
      dispose(): void {
        removeAccessBridge();
        removeInteractionBridge();
        removeBridge();
        removeDoorDebugListener?.();
        unsubInventory();
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
        builder.dispose();
        scene.dispose();
        physicsPlugin.dispose();
      },
    };
  },
};
