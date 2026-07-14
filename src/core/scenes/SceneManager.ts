import type { Disposable } from '../../app/lifecycle/Disposable';
import { GameError } from '../errors/GameError';
import type { ErrorReporter } from '../errors/ErrorReporter';
import type { ManagedSceneDefinition } from './SceneDefinition';
import type { SceneId } from './SceneId';

export interface SceneManagerEvents {
  /** Fired whenever the active scene or transition state changes. */
  onStateChange?(activeSceneId: SceneId | null, transitioning: boolean): void;
}

/**
 * Owns which scene is alive.
 *
 * Guarantees: at most one active scene, no overlapping transitions, the
 * previous scene is disposed before the next one is created, and failures
 * are surfaced through the error-reporting layer instead of leaving a
 * half-transitioned state. Generic over the handle/context types so it can
 * be unit-tested without Babylon.
 */
export class SceneManager<THandle extends Disposable, TContext> implements Disposable {
  private readonly definitions = new Map<SceneId, ManagedSceneDefinition<THandle, TContext>>();
  private readonly errorReporter: ErrorReporter;
  private readonly events: SceneManagerEvents;

  private activeHandle: THandle | null = null;
  private activeSceneId: SceneId | null = null;
  private transitioning = false;

  constructor(errorReporter: ErrorReporter, events: SceneManagerEvents = {}) {
    this.errorReporter = errorReporter;
    this.events = events;
  }

  register(definition: ManagedSceneDefinition<THandle, TContext>): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Scene '${definition.id}' is already registered`);
    }
    this.definitions.set(definition.id, definition);
  }

  get currentSceneId(): SceneId | null {
    return this.activeSceneId;
  }

  get currentHandle(): THandle | null {
    return this.activeHandle;
  }

  get isTransitioning(): boolean {
    return this.transitioning;
  }

  /**
   * Transitions to the given scene: disposes the previous scene, creates the
   * new one, and activates it. Rejects unknown ids and overlapping calls.
   */
  async load(sceneId: SceneId, context: TContext): Promise<THandle> {
    const definition = this.definitions.get(sceneId);
    if (definition === undefined) {
      const error = new GameError('scene-create', `Unknown scene id: '${sceneId}'`);
      this.errorReporter.reportRecoverable(error);
      throw error;
    }
    if (this.transitioning) {
      const error = new GameError(
        'scene-create',
        `Cannot load scene '${sceneId}': another scene transition is in progress`,
      );
      this.errorReporter.reportRecoverable(error);
      throw error;
    }

    this.transitioning = true;
    this.notify();
    try {
      // Dispose the outgoing scene first so two full scenes never coexist.
      this.disposeActive();
      const handle = await definition.create(context);
      this.activeHandle = handle;
      this.activeSceneId = sceneId;
      return handle;
    } catch (thrown) {
      const error = GameError.wrap('scene-create', thrown, `Failed to create scene '${sceneId}'`);
      this.errorReporter.reportRecoverable(error);
      throw error;
    } finally {
      this.transitioning = false;
      this.notify();
    }
  }

  dispose(): void {
    this.disposeActive();
    this.notify();
  }

  private disposeActive(): void {
    if (this.activeHandle !== null) {
      this.activeHandle.dispose();
      this.activeHandle = null;
      this.activeSceneId = null;
    }
  }

  private notify(): void {
    this.events.onStateChange?.(this.activeSceneId, this.transitioning);
  }
}
