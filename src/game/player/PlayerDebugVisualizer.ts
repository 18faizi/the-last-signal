import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Disposable } from '../../app/lifecycle/Disposable';
import type { PlayerConfig } from './PlayerConfig';
import type { MotorState } from './PlayerMotor';

/**
 * Development-only wireframe visualization of the player collider and
 * probes (F4). Meshes never collide (no physics bodies are created for
 * them), are unpickable, and are fully disposed with the scene. Production
 * builds never construct this class.
 */
export class PlayerDebugVisualizer implements Disposable {
  private readonly scene: Scene;
  private readonly config: PlayerConfig;
  private standingCapsule: Mesh | null = null;
  private crouchedCapsule: Mesh | null = null;
  private groundLine: LinesMesh | null = null;
  private clearanceLine: LinesMesh | null = null;
  private moveLine: LinesMesh | null = null;
  private normalLine: LinesMesh | null = null;
  private enabled = false;

  // Reused endpoints for updatable line meshes.
  private readonly groundPoints = [new Vector3(), new Vector3()];
  private readonly clearancePoints = [new Vector3(), new Vector3()];
  private readonly movePoints = [new Vector3(), new Vector3()];
  private readonly normalPoints = [new Vector3(), new Vector3()];

  constructor(scene: Scene, config: PlayerConfig) {
    this.scene = scene;
    this.config = config;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  toggle(): void {
    this.setEnabled(!this.enabled);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled && this.standingCapsule === null) {
      this.build();
    }
    this.setVisibility(enabled);
  }

  /** Follows the motor each frame while enabled. */
  update(state: MotorState): void {
    if (!this.enabled || this.standingCapsule === null || this.crouchedCapsule === null) {
      return;
    }
    const crouched = state.colliderHeight === this.config.crouchedHeight;
    const active = crouched ? this.crouchedCapsule : this.standingCapsule;
    const inactive = crouched ? this.standingCapsule : this.crouchedCapsule;
    active.isVisible = true;
    inactive.isVisible = false;
    active.position.set(
      state.footPosition.x,
      state.footPosition.y + state.colliderHeight / 2,
      state.footPosition.z,
    );

    // Ground probe (yellow): foot to probe depth.
    this.groundPoints[0]?.copyFrom(state.footPosition);
    this.groundPoints[1]?.set(
      state.footPosition.x,
      state.footPosition.y - this.config.groundProbeDistance,
      state.footPosition.z,
    );
    this.groundLine = CreateLines('debug-ground-probe', {
      points: this.groundPoints,
      instance: this.groundLine,
      updatable: true,
    });

    // Head clearance probe (red when blocked, cyan otherwise).
    const topY = state.footPosition.y + state.colliderHeight;
    const standTop =
      state.footPosition.y + this.config.standingHeight + this.config.headClearanceMargin;
    this.clearancePoints[0]?.set(state.footPosition.x, topY, state.footPosition.z);
    this.clearancePoints[1]?.set(state.footPosition.x, standTop, state.footPosition.z);
    this.clearanceLine = CreateLines('debug-clearance-probe', {
      points: this.clearancePoints,
      instance: this.clearanceLine,
      updatable: true,
    });
    this.clearanceLine.color = state.standingBlocked ? Color3.Red() : Color3.Teal();

    // Movement direction (green), scaled by speed.
    const midY = state.footPosition.y + 0.9;
    this.movePoints[0]?.set(state.footPosition.x, midY, state.footPosition.z);
    this.movePoints[1]?.set(
      state.footPosition.x + state.velocity.x * 0.4,
      midY,
      state.footPosition.z + state.velocity.z * 0.4,
    );
    this.moveLine = CreateLines('debug-move-dir', {
      points: this.movePoints,
      instance: this.moveLine,
      updatable: true,
    });

    // Ground normal (magenta).
    this.normalPoints[0]?.copyFrom(state.footPosition);
    this.normalPoints[1]?.set(
      state.footPosition.x + state.groundNormal.x,
      state.footPosition.y + state.groundNormal.y,
      state.footPosition.z + state.groundNormal.z,
    );
    this.normalLine = CreateLines('debug-ground-normal', {
      points: this.normalPoints,
      instance: this.normalLine,
      updatable: true,
    });
  }

  dispose(): void {
    this.standingCapsule?.dispose();
    this.crouchedCapsule?.dispose();
    this.groundLine?.dispose();
    this.clearanceLine?.dispose();
    this.moveLine?.dispose();
    this.normalLine?.dispose();
    this.standingCapsule = null;
    this.crouchedCapsule = null;
    this.groundLine = null;
    this.clearanceLine = null;
    this.moveLine = null;
    this.normalLine = null;
  }

  private build(): void {
    const material = new StandardMaterial('debug-capsule-mat', this.scene);
    material.wireframe = true;
    material.emissiveColor = new Color3(0.2, 0.9, 0.4);
    material.disableLighting = true;

    this.standingCapsule = this.buildCapsule('debug-capsule-standing', this.config.standingHeight);
    this.crouchedCapsule = this.buildCapsule('debug-capsule-crouched', this.config.crouchedHeight);
    this.standingCapsule.material = material;
    this.crouchedCapsule.material = material;

    this.groundLine = CreateLines('debug-ground-probe', {
      points: this.groundPoints,
      updatable: true,
    });
    this.groundLine.color = Color3.Yellow();
    this.clearanceLine = CreateLines('debug-clearance-probe', {
      points: this.clearancePoints,
      updatable: true,
    });
    this.moveLine = CreateLines('debug-move-dir', { points: this.movePoints, updatable: true });
    this.moveLine.color = Color3.Green();
    this.normalLine = CreateLines('debug-ground-normal', {
      points: this.normalPoints,
      updatable: true,
    });
    this.normalLine.color = Color3.Magenta();

    for (const mesh of this.allMeshes()) {
      mesh.isPickable = false;
      mesh.receiveShadows = false;
    }
  }

  private buildCapsule(name: string, height: number): Mesh {
    const capsule = CreateCapsule(
      name,
      { height, radius: this.config.colliderRadius, tessellation: 12 },
      this.scene,
    );
    capsule.isVisible = false;
    return capsule;
  }

  private setVisibility(visible: boolean): void {
    if (!visible) {
      for (const mesh of this.allMeshes()) {
        mesh.isVisible = false;
      }
      return;
    }
    // Lines become visible immediately; the correct capsule (standing vs
    // crouched) is selected by the next update() call.
    for (const line of [this.groundLine, this.clearanceLine, this.moveLine, this.normalLine]) {
      if (line !== null) {
        line.isVisible = true;
      }
    }
  }

  private allMeshes(): Mesh[] {
    const meshes: Array<Mesh | null> = [
      this.standingCapsule,
      this.crouchedCapsule,
      this.groundLine,
      this.clearanceLine,
      this.moveLine,
      this.normalLine,
    ];
    return meshes.filter((mesh): mesh is Mesh => mesh !== null);
  }
}
