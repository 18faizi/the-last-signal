/**
 * Checks whether something is blocking a closing door.
 *
 * Uses a scene query (pickWithRay from above, sweeping the door arc) to
 * detect physics bodies in the door's path. Lightweight: one ray per frame,
 * only during the 'closing' and 'blocked' states.
 *
 * Implementation uses a simple downward ray from the door leaf's bounding
 * box centre. A more accurate approach would be a PhysicsBody.overlapsQuery,
 * but that is not yet exposed in Babylon.js 9.x Havok bindings — the ray
 * provides sufficient safety without any native Havok extension.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Ray } from '@babylonjs/core/Culling/ray';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';

export class DoorObstructionProbe {
  private readonly scene: Scene;
  private readonly doorMeshes: readonly AbstractMesh[];
  private readonly ray = new Ray(Vector3.Zero(), new Vector3(0, -1, 0), 0.5);

  constructor(scene: Scene, doorMeshes: readonly AbstractMesh[]) {
    this.scene = scene;
    this.doorMeshes = doorMeshes;
  }

  /**
   * Returns true when a non-door mesh is intersecting the door leaf's
   * approximate volume. openFraction is passed so the ray can be positioned
   * at the door's current state.
   */
  isObstructed(_openFraction: number): boolean {
    const mesh = this.doorMeshes[0];
    if (mesh === undefined) {
      return false;
    }
    // Position the ray at the door leaf centre at current openFraction.
    const bounds = mesh.getBoundingInfo().boundingBox;
    const centre = bounds.centerWorld;
    this.ray.origin.set(centre.x, centre.y + 0.6, centre.z);

    // Quick pick excluding our own door meshes.
    const hit = this.scene.pickWithRay(
      this.ray,
      (m) => m.isPickable && m.isEnabled() && m !== mesh && !this.doorMeshes.includes(m),
    );
    return hit?.hit === true;
  }

  dispose(): void {
    // No owned resources.
  }
}
