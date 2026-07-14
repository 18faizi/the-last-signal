import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Disposable } from '../../app/lifecycle/Disposable';
import type { SettingsStore } from '../../state/settingsStore';
import { applyLookDelta, type LookState } from './CameraLook';
import type { PlayerConfig } from './PlayerConfig';

/**
 * First-person camera rig.
 *
 * Owns yaw/pitch and the eye-height offset; it *follows* the motor's foot
 * position every frame but never defines collision. Roll is always zero.
 * Camera inputs are never attached — all rotation comes from pointer deltas
 * routed through `applyLook`.
 */
export class CameraRig implements Disposable {
  readonly camera: UniversalCamera;
  private readonly config: PlayerConfig;
  private readonly settings: SettingsStore;
  private look: LookState = { yaw: 0, pitch: 0 };
  /** Current smoothed eye height above the player's foot. */
  private eyeHeight: number;

  constructor(scene: Scene, config: PlayerConfig, settings: SettingsStore) {
    this.config = config;
    this.settings = settings;
    this.eyeHeight = config.standingEyeHeight;
    this.camera = new UniversalCamera('player-camera', Vector3.Zero(), scene);
    this.camera.minZ = 0.05;
    this.camera.fov = 1.1;
    // Deliberately no attachControl: Babylon's built-in camera movement is
    // not used; the rig is driven exclusively by the controller.
    scene.activeCamera = this.camera;
  }

  get yaw(): number {
    return this.look.yaw;
  }

  get pitch(): number {
    return this.look.pitch;
  }

  get currentEyeHeight(): number {
    return this.eyeHeight;
  }

  setLook(yaw: number, pitch: number): void {
    this.look = { yaw, pitch };
  }

  /** Applies a raw mouse delta (pixels) using the user's settings. */
  applyLook(deltaX: number, deltaY: number): void {
    const settings = this.settings.getState();
    this.look = applyLookDelta(this.look, deltaX, deltaY, {
      baseSensitivity: this.config.mouseSensitivityBase,
      userSensitivity: settings.mouseSensitivity,
      invertY: settings.invertYAxis,
      minPitch: this.config.minPitch,
      maxPitch: this.config.maxPitch,
    });
  }

  /**
   * Moves the smoothed eye height toward the target for the current stance.
   * Called once per frame with clamped delta time.
   */
  updateEyeHeight(targetEyeHeight: number, deltaSeconds: number): void {
    const transition = this.config.crouchTransitionSeconds;
    if (transition <= 0) {
      this.eyeHeight = targetEyeHeight;
      return;
    }
    const speed = (this.config.standingEyeHeight - this.config.crouchedEyeHeight) / transition;
    const difference = targetEyeHeight - this.eyeHeight;
    const maxStep = speed * deltaSeconds;
    if (Math.abs(difference) <= maxStep) {
      this.eyeHeight = targetEyeHeight;
    } else {
      this.eyeHeight += Math.sign(difference) * maxStep;
    }
  }

  /** Positions and orients the camera from the player's foot position. */
  syncToFootPosition(footPosition: Vector3): void {
    this.camera.position.copyFrom(footPosition);
    this.camera.position.y += this.eyeHeight;
    this.camera.rotation.set(-this.look.pitch, this.look.yaw, 0);
  }

  dispose(): void {
    this.camera.dispose();
  }
}
