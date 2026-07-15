/**
 * InteractionTarget adapter for a door.
 *
 * Registers the door with the generic interaction framework so the existing
 * raycasting, focus, hold and prompt systems work without any door-specific
 * code in InteractionSystem. The DoorController owns the state machine;
 * this adapter translates it into the InteractionTarget contract.
 */
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import {
  AVAILABLE,
  type InteractionAvailability,
  type InteractionContext,
  type InteractionPromptSpec,
  type InteractionResult,
  type InteractionTarget,
} from '../interaction/InteractionTarget';
import type { DoorController } from './DoorController';

export class DoorInteractionTarget implements InteractionTarget {
  readonly kind = 'immediate' as const;

  private readonly controller: DoorController;
  private readonly scene: Scene;
  private observer: Observer<Scene> | null = null;
  private deniedReason: string | null = null;

  constructor(controller: DoorController, scene: Scene) {
    this.controller = controller;
    this.scene = scene;

    // Update the controller each frame from a scene observer.
    this.observer = scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);
      controller.update(dt);
    });
  }

  get id(): string {
    return this.controller.id;
  }

  get meshes(): readonly AbstractMesh[] {
    return this.controller.motion.meshes;
  }

  get maxDistance(): number {
    return 2.4;
  }

  getPrompt(_context: InteractionContext): InteractionPromptSpec {
    const state = this.controller.doorState;
    const label = this.controller.definition.label;

    if (state.physical === 'open' || state.physical === 'opening') {
      return { verb: 'CLOSE', label };
    }
    if (state.access === 'locked') {
      return { verb: 'UNLOCK', label };
    }
    return { verb: 'OPEN', label };
  }

  getAvailability(_context: InteractionContext): InteractionAvailability {
    const state = this.controller.doorState;
    if (state.physical === 'closing') {
      return { status: 'busy' };
    }
    if (state.access === 'locked') {
      const def = this.controller.definition.lock;
      return {
        status: 'disabled' as const,
        reason: def?.lockedReason ?? 'LOCKED',
      };
    }
    if (this.deniedReason !== null) {
      const reason = this.deniedReason;
      this.deniedReason = null;
      return { status: 'disabled', reason };
    }
    return AVAILABLE;
  }

  interact(_context: InteractionContext): InteractionResult {
    const denied = this.controller.interact();
    if (denied !== null) {
      this.deniedReason = denied;
      return { status: 'failed', message: denied };
    }
    return { status: 'completed' };
  }

  dispose(): void {
    if (this.observer !== null) {
      this.scene.onBeforeRenderObservable.remove(this.observer);
      this.observer = null;
    }
    this.controller.dispose();
  }
}
