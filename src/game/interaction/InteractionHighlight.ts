import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Disposable } from '../../app/lifecycle/Disposable';
import type { InteractionTarget } from './InteractionTarget';

const FOCUS_COLOR = new Color3(0.75, 0.85, 0.95);
const DISABLED_COLOR = new Color3(0.55, 0.45, 0.4);

/**
 * Subtle development focus feedback via Babylon's per-mesh `renderOverlay` —
 * a translucent tint pass that never mutates shared materials. Only the
 * focused target is tinted; disabled targets get a distinct muted tone.
 */
export class InteractionHighlight implements Disposable {
  private highlighted: readonly Mesh[] = [];

  apply(target: InteractionTarget, disabled: boolean): void {
    this.clear();
    const meshes: Mesh[] = [];
    for (const mesh of target.meshes) {
      if (mesh instanceof Mesh) {
        meshes.push(mesh);
      }
      for (const child of mesh.getChildMeshes(false)) {
        if (child instanceof Mesh) {
          meshes.push(child);
        }
      }
    }
    for (const mesh of meshes) {
      mesh.renderOverlay = true;
      mesh.overlayColor = disabled ? DISABLED_COLOR : FOCUS_COLOR;
      mesh.overlayAlpha = 0.18;
    }
    this.highlighted = meshes;
  }

  clear(): void {
    for (const mesh of this.highlighted) {
      // Meshes may already be disposed if the target was removed mid-focus.
      if (!mesh.isDisposed()) {
        mesh.renderOverlay = false;
      }
    }
    this.highlighted = [];
  }

  dispose(): void {
    this.clear();
  }
}
