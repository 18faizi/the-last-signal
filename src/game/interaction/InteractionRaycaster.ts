import { Ray } from '@babylonjs/core/Culling/ray';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { InteractionRegistry } from './InteractionRegistry';
import type { InteractionTarget } from './InteractionTarget';

export type FocusCandidateKind = 'none' | 'target' | 'target-out-of-range';

/** Result of one focus raycast. The instance is reused every frame. */
export interface FocusCandidate {
  kind: FocusCandidateKind;
  target: InteractionTarget | null;
  distance: number;
  /** World-space hit data for debug visualization; valid when hit is true. */
  hit: boolean;
  readonly hitPoint: Vector3;
  readonly hitNormal: Vector3;
}

/**
 * Center-camera interaction raycasting.
 *
 * One `scene.pickWithRay` per update with a reused Ray/result: the predicate
 * accepts only pickable meshes, which by construction excludes debug
 * visuals and development labels (`isPickable = false`). Because world
 * geometry is pickable, line-of-sight blocking falls out naturally — the
 * nearest hit wins, and a wall in front of a target simply produces a
 * non-target hit. Transparent-looking materials still block unless a mesh
 * is explicitly made non-pickable.
 */
export class InteractionRaycaster {
  private readonly scene: Scene;
  private readonly registry: InteractionRegistry;
  private readonly defaultDistance: number;
  private readonly probeDistance: number;

  private readonly ray = new Ray(Vector3.Zero(), Vector3.Forward(), 1);
  private readonly candidate: FocusCandidate = {
    kind: 'none',
    target: null,
    distance: Number.POSITIVE_INFINITY,
    hit: false,
    hitPoint: new Vector3(),
    hitNormal: new Vector3(),
  };

  constructor(
    scene: Scene,
    registry: InteractionRegistry,
    options: { defaultDistance: number; probeDistance: number },
  ) {
    this.scene = scene;
    this.registry = registry;
    this.defaultDistance = options.defaultDistance;
    this.probeDistance = options.probeDistance;
  }

  /**
   * Casts from the camera and classifies the nearest pickable hit.
   * The returned object is reused; consumers must not retain it.
   */
  cast(origin: Vector3, direction: Vector3): FocusCandidate {
    this.ray.origin.copyFrom(origin);
    this.ray.direction.copyFrom(direction);
    this.ray.length = this.probeDistance;

    const pick = this.scene.pickWithRay(this.ray, isRaycastRelevant, false);

    const result = this.candidate;
    result.kind = 'none';
    result.target = null;
    result.distance = Number.POSITIVE_INFINITY;
    result.hit = false;

    if (pick === null || !pick.hit || pick.pickedMesh === null) {
      return result;
    }

    result.hit = true;
    result.distance = pick.distance;
    if (pick.pickedPoint !== null) {
      result.hitPoint.copyFrom(pick.pickedPoint);
    }
    const normal = pick.getNormal(true);
    if (normal !== null) {
      result.hitNormal.copyFrom(normal);
    }

    const target = this.registry.resolveFromMesh(pick.pickedMesh);
    if (target === undefined) {
      // Plain world geometry: blocks anything behind it (line of sight).
      return result;
    }

    const limit = Math.min(this.defaultDistance, target.maxDistance ?? Number.POSITIVE_INFINITY);
    if (pick.distance <= limit) {
      result.kind = 'target';
      result.target = target;
    } else {
      result.kind = 'target-out-of-range';
      result.target = target;
    }
    return result;
  }
}

function isRaycastRelevant(mesh: AbstractMesh): boolean {
  // Debug meshes and development labels are created with isPickable=false,
  // so this single check keeps the pick loop narrow without name matching.
  return mesh.isPickable && mesh.isEnabled() && mesh.isVisible;
}
