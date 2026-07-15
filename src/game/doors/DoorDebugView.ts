/**
 * F7 door/access debug visualization (development only).
 *
 * When enabled, renders a wireframe overlay on each door leaf with a colour
 * coding physical/access state, and emits a text label for the state at the
 * door's world position.
 *
 * Non-pickable (isPickable = false) so focus rays never hit debug meshes.
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import type { DoorRegistry } from './DoorRegistry';
import type { DoorState } from './DoorState';

const COLOR_LOCKED = new Color3(0.8, 0.2, 0.2);
const COLOR_OPEN = new Color3(0.2, 0.8, 0.2);
const COLOR_MOVING = new Color3(0.8, 0.7, 0.1);
const COLOR_BLOCKED = new Color3(0.9, 0.4, 0.1);

export class DoorDebugView {
  private readonly scene: Scene;
  private readonly registry: DoorRegistry;
  private visible = false;
  private readonly overlays = new Map<string, Mesh>();
  private observer: Observer<Scene> | null = null;

  constructor(scene: Scene, registry: DoorRegistry) {
    this.scene = scene;
    this.registry = registry;
  }

  toggle(): void {
    this.visible = !this.visible;
    if (this.visible) {
      this.startObserver();
    } else {
      this.stopObserver();
      this.clearOverlays();
    }
  }

  get isVisible(): boolean {
    return this.visible;
  }

  dispose(): void {
    this.stopObserver();
    this.clearOverlays();
  }

  // ----- private ---------------------------------------------------------

  private startObserver(): void {
    if (this.observer !== null) {
      return;
    }
    this.observer = this.scene.onBeforeRenderObservable.add(() => this.update());
  }

  private stopObserver(): void {
    if (this.observer !== null) {
      this.scene.onBeforeRenderObservable.remove(this.observer);
      this.observer = null;
    }
  }

  private update(): void {
    for (const door of this.registry.getAll()) {
      const leaf = door.motion.meshes[0];
      if (leaf === undefined) {
        continue;
      }
      let overlay = this.overlays.get(door.id);
      if (overlay === undefined) {
        const bounds = leaf.getBoundingInfo().boundingBox;
        const size = bounds.extendSize.scale(2);
        overlay = CreateBox(
          `door-dbg-${door.id}`,
          {
            width: size.x + 0.02,
            height: size.y + 0.02,
            depth: size.z + 0.02,
          },
          this.scene,
        );
        overlay.isPickable = false;
        const mat = new StandardMaterial(`door-dbg-mat-${door.id}`, this.scene);
        mat.wireframe = true;
        overlay.material = mat;
        this.overlays.set(door.id, overlay);
      }
      // Track leaf world transform.
      const worldMatrix = leaf.getWorldMatrix();
      worldMatrix.decompose(
        overlay.scaling,
        overlay.rotationQuaternion ??
          (overlay.rotationQuaternion = leaf.absoluteRotationQuaternion.clone()),
        overlay.position,
      );
      if (overlay.rotationQuaternion !== null) {
        overlay.rotationQuaternion.copyFrom(leaf.absoluteRotationQuaternion);
      }
      overlay.position.copyFrom(leaf.getAbsolutePosition());

      // Colour by state.
      const mat = overlay.material as StandardMaterial;
      mat.emissiveColor = this.stateColor(door.doorState);
    }
  }

  private stateColor(state: DoorState): Color3 {
    if (state.access === 'locked') {
      return COLOR_LOCKED;
    }
    if (state.physical === 'blocked') {
      return COLOR_BLOCKED;
    }
    if (state.physical === 'opening' || state.physical === 'closing') {
      return COLOR_MOVING;
    }
    return COLOR_OPEN;
  }

  private clearOverlays(): void {
    for (const mesh of this.overlays.values()) {
      mesh.dispose();
    }
    this.overlays.clear();
  }
}
