import HavokPhysics, { type HavokPhysicsWithBindings } from '@babylonjs/havok';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
// Side-effect import: installs Scene.prototype.enablePhysics.
import '@babylonjs/core/Physics/joinedPhysicsEngineComponent';
import type { GravityConfig } from '../../config/gameConfig';
import { GameError } from '../errors/GameError';

/**
 * Owns the Havok runtime.
 *
 * The WASM module is loaded once and cached as a promise, so concurrent or
 * repeated scene initializations share a single Havok instance instead of
 * re-downloading the runtime per scene or per object.
 */
export class PhysicsService {
  private readonly gravity: GravityConfig;
  private havokPromise: Promise<HavokPhysicsWithBindings> | null = null;

  constructor(gravity: GravityConfig) {
    this.gravity = gravity;
  }

  /** Loads the Havok WASM runtime (cached after the first call). */
  async loadRuntime(): Promise<HavokPhysicsWithBindings> {
    this.havokPromise ??= HavokPhysics().catch((error: unknown) => {
      // Reset so a later retry is possible; a rejected promise would
      // otherwise be cached forever.
      this.havokPromise = null;
      throw GameError.wrap('physics-init', error, 'Failed to load Havok runtime');
    });
    return this.havokPromise;
  }

  /**
   * Enables physics on the given scene using the shared Havok runtime.
   * Returns the plugin so callers can dispose it with the scene.
   */
  async enableForScene(scene: Scene): Promise<HavokPlugin> {
    const havok = await this.loadRuntime();
    try {
      const plugin = new HavokPlugin(true, havok);
      const gravityVector = new Vector3(this.gravity.x, this.gravity.y, this.gravity.z);
      const enabled = scene.enablePhysics(gravityVector, plugin);
      if (!enabled) {
        throw new Error('Scene.enablePhysics returned false');
      }
      return plugin;
    } catch (error) {
      throw GameError.wrap('physics-init', error, 'Failed to enable physics on scene');
    }
  }
}
