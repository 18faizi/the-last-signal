import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { EnvironmentInfo } from '../../config/environment';
import type { InteractionConfig } from '../../game/interaction/InteractionConfig';
import type { InteractionRegistry } from '../../game/interaction/InteractionRegistry';
import { AVAILABLE, type InteractionTarget } from '../../game/interaction/InteractionTarget';
import type { DocumentRegistry } from '../../game/interaction/documents/DocumentRegistry';
import { CourseBuilder, COURSE_COLORS } from '../movement-test/CourseBuilder';
import {
  createAsyncTerminal,
  createBreaker,
  createDisabledPanel,
  createMultiStateControl,
  createToggleSwitch,
} from './testTargets/switchTargets';
import { createFieldRadio, createRelayComponent } from './testTargets/inspectableTargets';
import { createReadableDocument, DEV_DOCUMENTS } from './testTargets/documentTargets';

/**
 * Builds the compact interaction test room and registers every test target.
 *
 * Reuses the movement course's CourseBuilder for walls/floor/labels — the
 * builder is generic grey-box tooling, not movement-scene-specific (a
 * documented structure deviation). The center corridor (x ∈ [-1, 1]) stays
 * clear so the Milestone 0.2 movement browser tests keep passing in this
 * scene.
 */
export function createInteractionTestArea(
  scene: Scene,
  registry: InteractionRegistry,
  documents: DocumentRegistry,
  config: InteractionConfig,
  environment: EnvironmentInfo,
): CourseBuilder {
  const builder = new CourseBuilder(scene);

  // Room shell: floor 20×18, walls height 3, open ceiling.
  builder.box('room-floor', {
    width: 20,
    height: 1,
    depth: 18,
    position: new Vector3(0, -0.5, 1),
    color: COURSE_COLORS.ground,
  });
  const wallY = 1.5;
  builder.box('room-wall-north', {
    width: 20,
    height: 3,
    depth: 0.4,
    position: new Vector3(0, wallY, 9.8),
    color: COURSE_COLORS.wall,
  });
  builder.box('room-wall-south', {
    width: 20,
    height: 3,
    depth: 0.4,
    position: new Vector3(0, wallY, -7.8),
    color: COURSE_COLORS.wall,
  });
  builder.box('room-wall-west', {
    width: 0.4,
    height: 3,
    depth: 18,
    position: new Vector3(-9.8, wallY, 1),
    color: COURSE_COLORS.wall,
  });
  builder.box('room-wall-east', {
    width: 0.4,
    height: 3,
    depth: 18,
    position: new Vector3(9.8, wallY, 1),
    color: COURSE_COLORS.wall,
  });

  // Console along the north wall carrying the control targets.
  builder.box('console', {
    width: 16,
    height: 0.9,
    depth: 0.8,
    position: new Vector3(0, 0.45, 8.9),
    color: COURSE_COLORS.step,
  });
  // Tables for props.
  builder.box('table-west', {
    width: 1.6,
    height: 1,
    depth: 3.6,
    position: new Vector3(-6, 0.5, 1.5),
    color: COURSE_COLORS.step,
  });
  builder.box('table-east', {
    width: 1.6,
    height: 1,
    depth: 3.6,
    position: new Vector3(6, 0.5, 1.5),
    color: COURSE_COLORS.step,
  });

  // Range markers: floor strips at the default interaction distance from
  // the console face (non-pickable so they never affect the focus ray).
  const markerMat = new StandardMaterial('range-marker-mat', scene);
  markerMat.diffuseColor = new Color3(0.5, 0.55, 0.4);
  markerMat.specularColor = Color3.Black();
  for (const [name, z] of [
    ['range-marker-near', 8.5 - config.interactionDistance],
    ['range-marker-far', 8.5 - config.interactionDistance - 1.5],
  ] as const) {
    const strip = CreateBox(name, { width: 16, height: 0.02, depth: 0.08 }, scene);
    strip.position.set(0, 0.011, z);
    strip.material = markerMat;
    strip.isPickable = false;
  }

  // ----- targets --------------------------------------------------------
  // Console controls sit near standing eye height (1.66 m) so a level view
  // ray lands on them; the toggle switch faces the spawn point directly.
  registry.register(createToggleSwitch(scene, new Vector3(0, 1.6, 8.6)));
  registry.register(createMultiStateControl(scene, new Vector3(-3.5, 1.6, 8.6)));
  registry.register(createBreaker(scene, new Vector3(3.5, 1.6, 8.6)));
  registry.register(createDisabledPanel(scene, new Vector3(6, 1.6, 8.6)));
  registry.register(
    createAsyncTerminal(
      scene,
      new Vector3(-6, 1.2, 3),
      environment.isDevelopment ? config.devAsyncDelayMs : 0,
    ),
  );
  registry.register(createFieldRadio(scene, new Vector3(-6, 1.13, 0.3)));
  registry.register(createRelayComponent(scene, new Vector3(6, 1.03, 0.3)));

  for (const definition of DEV_DOCUMENTS) {
    documents.register(definition);
  }
  registry.register(
    createReadableDocument(scene, new Vector3(6, 1.01, 2.6), {
      id: 'test-maintenance-note',
      documentId: 'doc-maintenance-note',
      label: 'MAINTENANCE NOTE',
      rotationY: 0.3,
    }),
  );
  registry.register(
    createReadableDocument(scene, new Vector3(-6, 1.01, 2.6), {
      id: 'test-shift-log',
      documentId: 'doc-shift-log',
      label: 'SHIFT LOG',
      rotationY: -0.2,
    }),
  );

  // Line-of-sight test: a switch behind a visually transparent pane. The
  // pane stays pickable, so transparency does NOT imply raycast
  // transparency — the target cannot be used through the glass.
  const glassMat = new StandardMaterial('glass-mat', scene);
  glassMat.diffuseColor = new Color3(0.6, 0.75, 0.85);
  glassMat.alpha = 0.25;
  const glass = CreateBox('los-glass', { width: 1.4, height: 1.4, depth: 0.04 }, scene);
  glass.position.set(3.5, 1.2, 4.2);
  glass.material = glassMat;
  registry.register(
    createToggleSwitchVariant(scene, new Vector3(3.5, 1.2, 5.2), 'test-los-switch', 'CASED SWITCH'),
  );
  builder.label('LINE OF SIGHT', new Vector3(3.5, 2.3, 4.2), 2);

  // Priority pair: two small adjacent targets; the primary declares a
  // higher explicit priority for near-equal hits.
  registry.register({
    ...createToggleSwitchVariant(
      scene,
      new Vector3(-3.4, 1.2, 5.5),
      'test-priority-primary',
      'PRIMARY VALVE',
    ),
    priority: 5,
  });
  registry.register(
    createToggleSwitchVariant(
      scene,
      new Vector3(-2.95, 1.2, 5.5),
      'test-priority-secondary',
      'SECONDARY VALVE',
    ),
  );
  builder.label('PRIORITY PAIR', new Vector3(-3.2, 2.2, 5.5), 2);

  // Development area labels (small dev-only sign; not content/art direction).
  builder.label('DEV CONTROLS', new Vector3(0, 2.2, 8.6), 1.4);
  builder.label('INSPECT + READ', new Vector3(-6, 2.2, 1.5), 2.4);
  builder.label('INSPECT + READ', new Vector3(6, 2.2, 1.5), 2.4);

  return builder;
}

/** Small generic immediate target used by the LOS and priority fixtures. */
function createToggleSwitchVariant(
  scene: Scene,
  position: Vector3,
  id: string,
  label: string,
): InteractionTarget {
  const body = CreateBox(`${id}-body`, { width: 0.28, height: 0.36, depth: 0.14 }, scene);
  body.position.copyFrom(position);
  const material = new StandardMaterial(`${id}-mat`, scene);
  material.diffuseColor = new Color3(0.3, 0.36, 0.34);
  material.specularColor = Color3.Black();
  body.material = material;

  let on = false;
  return {
    id,
    kind: 'immediate',
    meshes: [body],
    getPrompt: () => ({ verb: 'USE', label }),
    getAvailability: () => AVAILABLE,
    interact: () => {
      on = !on;
      material.diffuseColor = on ? new Color3(0.2, 0.5, 0.3) : new Color3(0.3, 0.36, 0.34);
      return { status: 'completed' as const };
    },
  };
}
