import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Node } from '@babylonjs/core/node';
import type { Disposable } from '../../app/lifecycle/Disposable';
import type { InteractionTarget, InteractionTargetId } from './InteractionTarget';

/** Controlled metadata key: meshes carry only an identifier, never systems. */
const METADATA_KEY = 'interactionTargetId';

interface InteractionMeshMetadata {
  [METADATA_KEY]?: InteractionTargetId;
  [key: string]: unknown;
}

/**
 * Maps meshes to interaction targets.
 *
 * Registration stamps each of the target's meshes (and their mesh
 * descendants) with the target id in `mesh.metadata` — an identifier only;
 * the target object itself lives in this registry's typed map. Resolution
 * from a raycast hit walks up the parent chain, so decorative child meshes
 * resolve to their owning target instead of stealing focus.
 */
export class InteractionRegistry implements Disposable {
  private readonly targets = new Map<InteractionTargetId, InteractionTarget>();

  register(target: InteractionTarget): void {
    if (this.targets.has(target.id)) {
      throw new Error(`Interaction target '${target.id}' is already registered`);
    }
    this.targets.set(target.id, target);
    for (const mesh of target.meshes) {
      this.stamp(mesh, target.id);
      for (const child of mesh.getChildMeshes(false)) {
        this.stamp(child, target.id);
      }
    }
  }

  unregister(targetId: InteractionTargetId): void {
    const target = this.targets.get(targetId);
    if (target === undefined) {
      return;
    }
    this.targets.delete(targetId);
    for (const mesh of target.meshes) {
      this.unstamp(mesh);
      for (const child of mesh.getChildMeshes(false)) {
        this.unstamp(child);
      }
    }
    target.dispose?.();
  }

  get(targetId: InteractionTargetId): InteractionTarget | undefined {
    return this.targets.get(targetId);
  }

  get size(): number {
    return this.targets.size;
  }

  /** Resolves a picked mesh (or any of its ancestors) to its target. */
  resolveFromMesh(mesh: AbstractMesh): InteractionTarget | undefined {
    let node: Node | null = mesh;
    while (node !== null) {
      const metadata = node.metadata as InteractionMeshMetadata | null | undefined;
      const id = metadata?.[METADATA_KEY];
      if (typeof id === 'string') {
        return this.targets.get(id);
      }
      node = node.parent;
    }
    return undefined;
  }

  dispose(): void {
    for (const id of [...this.targets.keys()]) {
      this.unregister(id);
    }
  }

  private stamp(mesh: AbstractMesh, id: InteractionTargetId): void {
    const metadata = (mesh.metadata ?? {}) as InteractionMeshMetadata;
    metadata[METADATA_KEY] = id;
    mesh.metadata = metadata;
  }

  private unstamp(mesh: AbstractMesh): void {
    const metadata = mesh.metadata as InteractionMeshMetadata | null | undefined;
    if (metadata !== null && metadata !== undefined) {
      delete metadata[METADATA_KEY];
    }
  }
}
