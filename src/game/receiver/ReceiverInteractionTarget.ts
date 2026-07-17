/**
 * Babylon-facing adapter: builds the single 'receiver'-kind InteractionTarget
 * for the control-room receiver console, and owns the one
 * onBeforeRenderObservable hook that drives ReceiverController.update(dt)
 * (boot timer, scan sweep, lock/decode accumulation) — mirrors
 * GeneratorInteractionTargets.ts's statusPanelTarget hook exactly. Disposing
 * this target removes that observer, so the timer mechanism is fully scoped
 * and leak-free.
 */
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import {
  type InteractionAvailability,
  type InteractionContext,
  type InteractionPromptSpec,
  type InteractionResult,
  type ReceiverTarget,
} from '../interaction/InteractionTarget';
import type { ReceiverController } from './ReceiverController';

export function createReceiverInteractionTarget(
  id: string,
  mesh: AbstractMesh,
  controller: ReceiverController,
  scene: Scene,
  isPowered: () => boolean,
): ReceiverTarget {
  let observer: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);
    controller.update(dt);
  });

  return {
    id,
    kind: 'receiver',
    meshes: [mesh],
    getPrompt: (): InteractionPromptSpec => ({
      verb:
        controller.receiverMode === 'Offline' || controller.receiverMode === 'Booting'
          ? 'NO POWER'
          : 'OPERATE',
      label: 'SIGNAL RECEIVER',
    }),
    getAvailability: (): InteractionAvailability => {
      if (!isPowered()) return { status: 'disabled', reason: 'NO POWER' };
      if (controller.receiverMode === 'Booting') return { status: 'disabled', reason: 'BOOTING…' };
      return { status: 'available' };
    },
    interact: (_context: InteractionContext): InteractionResult => {
      if (
        !isPowered() ||
        controller.receiverMode === 'Offline' ||
        controller.receiverMode === 'Booting'
      ) {
        return { status: 'failed', message: 'NO POWER' };
      }
      // Opening is performed by ReceiverPanelSession (invoked by
      // InteractionSystem's 'receiver'-kind handling), not here — this
      // interact() is only reached when no receiverPanel session is wired
      // (defensive fallback matching PanelTarget's own convention).
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
