/**
 * Abstract motion contract shared by hinged and sliding door implementations.
 *
 * A DoorMotion knows how to position the door mesh for a given openFraction
 * [0, 1]. The door controller calls applyFraction() every frame during
 * animation, and the Havok ANIMATED physics body tracks the mesh transform
 * automatically (disablePreStep = false).
 */
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';

export interface DoorMotion {
  /** The mesh(es) belonging to this door. Used for raycasting + physics. */
  readonly meshes: readonly AbstractMesh[];
  /**
   * Set the door visual and physics transform for openFraction ∈ [0, 1].
   * Called every frame during animation.
   */
  applyFraction(fraction: number): void;
  /**
   * Dispose Babylon resources owned by this motion (aggregates, materials).
   * Meshes die with the scene — do not dispose them here.
   */
  dispose(): void;
}
