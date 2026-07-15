import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Disposable } from '../../app/lifecycle/Disposable';
import type { FocusCandidate } from './InteractionRaycaster';

/**
 * Development-only interaction-ray visualization (F6).
 *
 * Shows the cast ray to its maximum probe distance, the hit point, the hit
 * normal and a marker whose color reflects classification: focused target
 * (green), out-of-range target (yellow), blocked world hit (red). All
 * meshes are non-pickable (so they never affect the interaction raycast
 * itself), non-colliding, and disposed with the scene. Production builds
 * never construct this class.
 */
export class InteractionDebugView implements Disposable {
  private readonly scene: Scene;
  private readonly probeDistance: number;
  private enabled = false;

  private rayLine: LinesMesh | null = null;
  private normalLine: LinesMesh | null = null;
  private hitMarker: Mesh | null = null;
  private markerMaterial: StandardMaterial | null = null;

  private readonly rayPoints = [new Vector3(), new Vector3()];
  private readonly normalPoints = [new Vector3(), new Vector3()];

  constructor(scene: Scene, probeDistance: number) {
    this.scene = scene;
    this.probeDistance = probeDistance;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  toggle(): void {
    this.enabled = !this.enabled;
    if (this.enabled && this.rayLine === null) {
      this.build();
    }
    this.setVisible(this.enabled);
  }

  /** Passing null hides the frame's visuals (e.g. overlay modes). */
  update(candidate: FocusCandidate | null, origin?: Vector3, direction?: Vector3): void {
    if (!this.enabled || this.rayLine === null) {
      return;
    }
    if (candidate === null || origin === undefined || direction === undefined) {
      this.setVisible(false);
      return;
    }
    this.setVisible(true);

    this.rayPoints[0]?.copyFrom(origin);
    this.rayPoints[1]?.set(
      origin.x + direction.x * this.probeDistance,
      origin.y + direction.y * this.probeDistance,
      origin.z + direction.z * this.probeDistance,
    );
    this.rayLine = CreateLines('interaction-ray', {
      points: this.rayPoints,
      instance: this.rayLine,
      updatable: true,
    });

    if (candidate.hit && this.hitMarker !== null && this.markerMaterial !== null) {
      this.hitMarker.isVisible = true;
      this.hitMarker.position.copyFrom(candidate.hitPoint);
      const color =
        candidate.kind === 'target'
          ? Color3.Green()
          : candidate.kind === 'target-out-of-range'
            ? Color3.Yellow()
            : Color3.Red();
      this.markerMaterial.emissiveColor = color;

      this.normalPoints[0]?.copyFrom(candidate.hitPoint);
      this.normalPoints[1]?.set(
        candidate.hitPoint.x + candidate.hitNormal.x * 0.4,
        candidate.hitPoint.y + candidate.hitNormal.y * 0.4,
        candidate.hitPoint.z + candidate.hitNormal.z * 0.4,
      );
      if (this.normalLine !== null) {
        this.normalLine.isVisible = true;
      }
      this.normalLine = CreateLines('interaction-ray-normal', {
        points: this.normalPoints,
        instance: this.normalLine,
        updatable: true,
      });
    } else {
      if (this.hitMarker !== null) {
        this.hitMarker.isVisible = false;
      }
      if (this.normalLine !== null) {
        this.normalLine.isVisible = false;
      }
    }
  }

  dispose(): void {
    this.rayLine?.dispose();
    this.normalLine?.dispose();
    this.hitMarker?.dispose();
    this.markerMaterial?.dispose();
    this.rayLine = null;
    this.normalLine = null;
    this.hitMarker = null;
    this.markerMaterial = null;
  }

  private build(): void {
    this.rayLine = CreateLines('interaction-ray', { points: this.rayPoints, updatable: true });
    this.rayLine.color = new Color3(0.4, 0.7, 1);
    this.normalLine = CreateLines('interaction-ray-normal', {
      points: this.normalPoints,
      updatable: true,
    });
    this.normalLine.color = Color3.Magenta();
    this.hitMarker = CreateSphere('interaction-hit-marker', { diameter: 0.08 }, this.scene);
    this.markerMaterial = new StandardMaterial('interaction-hit-marker-mat', this.scene);
    this.markerMaterial.disableLighting = true;
    this.hitMarker.material = this.markerMaterial;
    for (const mesh of [this.rayLine, this.normalLine, this.hitMarker]) {
      mesh.isPickable = false;
    }
  }

  private setVisible(visible: boolean): void {
    for (const mesh of [this.rayLine, this.normalLine, this.hitMarker]) {
      if (mesh !== null) {
        mesh.isVisible = visible;
      }
    }
  }
}
