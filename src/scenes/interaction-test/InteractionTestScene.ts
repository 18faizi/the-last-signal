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
import { installInteractionBridge, installTestBridge } from '../../game/dev/TestBridge';
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
import { FirstPersonController } from '../../game/player/FirstPersonController';
import { DEFAULT_PLAYER_CONFIG, validatePlayerConfig } from '../../game/player/PlayerConfig';
import { DocumentReaderView } from '../../ui/interaction/DocumentReaderView';
import { InspectionOverlay } from '../../ui/interaction/InspectionOverlay';
import { InteractionPromptView } from '../../ui/interaction/InteractionPromptView';
import { createInteractionTestArea } from './createInteractionTestArea';

const SPAWN_POSITION = new Vector3(0, 0.05, -5.5);
const SPAWN_YAW = 0; // facing the console wall

/**
 * Milestone 0.3 interaction test scene: a compact grey-box room containing
 * every interaction fixture (switches, breaker, inspectables, documents,
 * LOS/priority/range tests), wired to the reusable interaction framework.
 */
export const interactionTestSceneDefinition: SceneDefinition = {
  id: 'interaction-test',

  async create(context: SceneCreationContext): Promise<SceneHandle> {
    const playerProblems = validatePlayerConfig(DEFAULT_PLAYER_CONFIG);
    const interactionProblems = validateInteractionConfig(DEFAULT_INTERACTION_CONFIG);
    if (playerProblems.length > 0 || interactionProblems.length > 0) {
      throw new Error(`Invalid config: ${[...playerProblems, ...interactionProblems].join('; ')}`);
    }

    const scene = new Scene(context.engine);
    scene.clearColor = new Color4(0.05, 0.06, 0.08, 1);

    const hemisphere = new HemisphericLight('room-hemi', new Vector3(0.2, 1, 0.1), scene);
    hemisphere.intensity = 0.8;
    hemisphere.groundColor = new Color3(0.12, 0.12, 0.16);
    const sun = new DirectionalLight('room-sun', new Vector3(-0.3, -1, 0.4), scene);
    sun.intensity = 0.3;

    const physicsPlugin = await context.physics.enableForScene(scene);

    const registry = new InteractionRegistry();
    const documents = new DocumentRegistry();
    const builder = createInteractionTestArea(
      scene,
      registry,
      documents,
      DEFAULT_INTERACTION_CONFIG,
      context.environment,
    );
    context.onPhysicsReady();

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
        pointerLockPromptLabel: 'Click to enter interaction test',
      },
    );

    // UI views (DOM) — one instance each, reused across sessions.
    const promptView = new InteractionPromptView(context.overlayParent);
    const inspectionOverlay = new InspectionOverlay(context.overlayParent);
    const readerView = new DocumentReaderView(context.overlayParent);

    const inspection = new InspectionController(scene, controller, inspectionOverlay);
    const documentController = new DocumentController(
      documents,
      readerView,
      controller,
      context.canvas,
      context.errorReporter,
    );
    const debugView = context.environment.isDevelopment
      ? new InteractionDebugView(scene, DEFAULT_INTERACTION_CONFIG.probeDistance)
      : null;

    const interaction = new InteractionSystem({
      scene,
      player: controller,
      input: context.input,
      registry,
      environment: context.environment,
      errorReporter: context.errorReporter,
      promptView,
      inspection,
      documents: documentController,
      config: DEFAULT_INTERACTION_CONFIG,
      debugView,
    });

    const removeBridge = installTestBridge(controller, context.environment, context.settings);
    const removeInteractionBridge = installInteractionBridge(
      interaction,
      inspection,
      readerView,
      scene,
      context.environment,
    );

    return {
      scene,
      markerText: 'Milestone 0.3 — Interaction Framework',
      getDebugFields: () => [...controller.getDebugFields(), ...interaction.getDebugFields()],
      dispose(): void {
        removeInteractionBridge();
        removeBridge();
        interaction.dispose();
        debugView?.dispose();
        documentController.dispose();
        inspection.dispose();
        readerView.dispose();
        inspectionOverlay.dispose();
        promptView.dispose();
        controller.dispose();
        registry.dispose();
        documents.clear();
        builder.dispose();
        scene.dispose();
        physicsPlugin.dispose();
      },
    };
  },
};
