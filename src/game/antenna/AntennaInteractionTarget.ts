/**
 * Babylon-facing adapter: builds the 'antenna'-kind InteractionTarget for
 * the rooftop antenna control cabinet, and owns the one
 * onBeforeRenderObservable hook that drives AntennaController.update(dt)
 * (mechanical motion) — mirrors ReceiverInteractionTarget.ts's pattern
 * exactly. Disposing this target removes that observer, so the mechanism is
 * fully scoped and leak-free.
 */
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import {
  type InteractionAvailability,
  type InteractionContext,
  type InteractionPromptSpec,
  type InteractionResult,
  type AntennaTarget,
} from '../interaction/InteractionTarget';
import type { AntennaController } from './AntennaController';

export function createAntennaInteractionTarget(
  id: string,
  mesh: AbstractMesh,
  controller: AntennaController,
  scene: Scene,
  isPowered: () => boolean,
): AntennaTarget {
  let observer: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);
    controller.update(dt);
  });

  return {
    id,
    kind: 'antenna',
    meshes: [mesh],
    getPrompt: (): InteractionPromptSpec => ({
      verb: isPowered() ? 'OPERATE' : 'NO POWER',
      label: 'ANTENNA CONTROLS',
    }),
    getAvailability: (): InteractionAvailability => {
      if (!isPowered()) return { status: 'disabled', reason: 'NO POWER' };
      return { status: 'available' };
    },
    interact: (_context: InteractionContext): InteractionResult => {
      if (!isPowered()) return { status: 'failed', message: 'NO POWER' };
      // Opening is performed by AntennaPanelSession (invoked by
      // InteractionSystem's 'antenna'-kind handling), not here — mirrors
      // ReceiverInteractionTarget's own documented fallback convention.
      return { status: 'completed' };
    },
    dispose: () => {
      if (observer !== null) {
        scene.onBeforeRenderObservable.remove(observer);
        observer = null;
      }
    },
  };
}
