import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import type { Disposable } from '../../app/lifecycle/Disposable';
import { DisposableBag } from '../../app/lifecycle/Disposable';
import type { EnvironmentInfo } from '../../config/environment';
import { DEFAULT_BINDINGS, InputAction } from '../../core/input/InputAction';
import type { InputManager } from '../../core/input/InputManager';
import type { SettingsStore } from '../../state/settingsStore';
import { CameraRig } from './CameraRig';
import { isCrouchedState } from './CrouchState';
import {
  computeMovementIntent,
  IDLE_INTENT,
  isSprintAllowed,
  type MovementIntent,
} from './MovementIntent';
import { selectMovementMode, type MovementMode } from './MovementMode';
import { PlayerDebugVisualizer } from './PlayerDebugVisualizer';
import { PlayerMotor } from './PlayerMotor';
import { PointerLockController } from './PointerLockController';
import type { PlayerConfig } from './PlayerConfig';

export interface PlayerSpawn {
  readonly position: Vector3;
  readonly yaw: number;
  readonly pitch: number;
}

export interface FirstPersonControllerDeps {
  readonly input: InputManager;
  readonly settings: SettingsStore;
  readonly environment: EnvironmentInfo;
  readonly canvas: HTMLCanvasElement;
  /** Parent element for the pointer-lock prompt overlay. */
  readonly overlayParent: HTMLElement;
}

/** Plain-data snapshot for the debug overlay and the dev test bridge. */
export interface PlayerDebugSnapshot {
  readonly position: { x: number; y: number; z: number };
  readonly velocity: { x: number; y: number; z: number };
  readonly horizontalSpeed: number;
  readonly verticalVelocity: number;
  readonly grounded: boolean;
  readonly groundDistance: number;
  readonly slopeAngleDeg: number;
  readonly mode: MovementMode;
  readonly crouchRequested: boolean;
  readonly crouched: boolean;
  readonly standingBlocked: boolean;
  readonly pointerLocked: boolean;
  readonly yaw: number;
  readonly pitch: number;
}

/**
 * First-person controller: composes the camera rig, pointer lock, movement
 * intent and the physics motor into one per-scene unit.
 *
 * Registered on the scene's onBeforeRenderObservable — the application's
 * single engine render loop remains the only render loop; this is a scene
 * observer, removed on dispose. Designed to be reused by future gameplay
 * scenes: everything scene-specific (spawn, out-of-bounds Y) is parameterized.
 */
export class FirstPersonController implements Disposable {
  private readonly scene: Scene;
  private readonly config: PlayerConfig;
  private readonly deps: FirstPersonControllerDeps;
  private readonly spawn: PlayerSpawn;
  private readonly motor: PlayerMotor;
  private readonly cameraRig: CameraRig;
  private readonly pointerLock: PointerLockController;
  private readonly visualizer: PlayerDebugVisualizer | null;
  private readonly cleanup = new DisposableBag();
  private updateObserver: Observer<Scene> | null = null;

  private previousPressed: ReadonlySet<string> = new Set();
  private currentIntent: MovementIntent = IDLE_INTENT;
  private sprinting = false;
  private mode: MovementMode = 'idle';
  /** Dev/test escape hatch: lets CI drive movement without real pointer lock. */
  private pointerLockBypass = false;
  private jumpQueued = false;
  private resetQueued = false;

  private readonly tmpTarget = new Vector3();

  constructor(
    scene: Scene,
    config: PlayerConfig,
    spawn: PlayerSpawn,
    deps: FirstPersonControllerDeps,
  ) {
    this.scene = scene;
    this.config = config;
    this.spawn = spawn;
    this.deps = deps;

    this.motor = new PlayerMotor(scene, config, spawn.position);
    this.cleanup.add(this.motor);

    this.cameraRig = new CameraRig(scene, config, deps.settings);
    this.cameraRig.setLook(spawn.yaw, spawn.pitch);
    this.cleanup.add(this.cameraRig);

    this.pointerLock = new PointerLockController(deps.canvas, deps.overlayParent);
    this.cleanup.add(this.pointerLock);

    // Edge actions are queued from the InputManager's keydown events rather
    // than diffing pressed-key sets between frames: a press+release that
    // fits inside one frame (fast tap, low FPS) would otherwise be lost.
    const unsubscribeActions = deps.input.onAction((action) => {
      if (action === InputAction.Jump) {
        this.jumpQueued = true;
      } else if (action === InputAction.ResetPlayer) {
        this.resetQueued = true;
      }
    });
    this.cleanup.add(unsubscribeActions);

    this.visualizer = deps.environment.isDevelopment
      ? new PlayerDebugVisualizer(scene, config)
      : null;
    if (this.visualizer !== null) {
      this.cleanup.add(this.visualizer);
      const unsubscribe = deps.input.onAction((action) => {
        if (action === InputAction.ToggleDebugVisualization) {
          this.visualizer?.toggle();
        }
      });
      this.cleanup.add(unsubscribe);
    }

    this.updateObserver = scene.onBeforeRenderObservable.add(() => this.update());
    this.cleanup.add(() => {
      if (this.updateObserver !== null) {
        scene.onBeforeRenderObservable.remove(this.updateObserver);
        this.updateObserver = null;
      }
    });
  }

  get isPointerLocked(): boolean {
    return this.pointerLock.isLocked;
  }

  /** Development/test only: allows movement without a real pointer lock. */
  setPointerLockBypass(enabled: boolean): void {
    if (this.deps.environment.isDevelopment) {
      this.pointerLockBypass = enabled;
    }
  }

  respawn(): void {
    this.motor.respawn(this.spawn.position);
    if (this.config.resetCameraOnRespawn) {
      this.cameraRig.setLook(this.spawn.yaw, this.spawn.pitch);
    }
  }

  getDebugSnapshot(): PlayerDebugSnapshot {
    const state = this.motor.motorState;
    return {
      position: {
        x: state.footPosition.x,
        y: state.footPosition.y,
        z: state.footPosition.z,
      },
      velocity: { x: state.velocity.x, y: state.velocity.y, z: state.velocity.z },
      horizontalSpeed: state.horizontalSpeed,
      verticalVelocity: state.verticalVelocity,
      grounded: state.grounded,
      groundDistance: state.groundDistance,
      slopeAngleDeg: state.slopeAngleDeg,
      mode: this.mode,
      crouchRequested: this.currentIntent.crouchHeld,
      crouched: isCrouchedState(state.crouchState),
      standingBlocked: state.standingBlocked,
      pointerLocked: this.pointerLock.isLocked,
      yaw: this.cameraRig.yaw,
      pitch: this.cameraRig.pitch,
    };
  }

  /** Formatted rows merged into the development debug overlay. */
  getDebugFields(): ReadonlyArray<readonly [string, string]> {
    const snapshot = this.getDebugSnapshot();
    const position = `${snapshot.position.x.toFixed(2)} ${snapshot.position.y.toFixed(2)} ${snapshot.position.z.toFixed(2)}`;
    return [
      ['Player pos', position],
      ['H speed', `${snapshot.horizontalSpeed.toFixed(2)} m/s`],
      ['V vel', `${snapshot.verticalVelocity.toFixed(2)} m/s`],
      ['Mode', snapshot.mode],
      ['Grounded', snapshot.grounded ? 'yes' : 'no'],
      [
        'Ground dist',
        Number.isFinite(snapshot.groundDistance) ? snapshot.groundDistance.toFixed(3) : '∞',
      ],
      ['Slope', `${snapshot.slopeAngleDeg.toFixed(1)}°`],
      [
        'Crouch',
        `${snapshot.crouched ? 'crouched' : 'standing'}${snapshot.crouchRequested ? ' (held)' : ''}${snapshot.standingBlocked ? ' BLOCKED' : ''}`,
      ],
      ['Pointer lock', snapshot.pointerLocked ? 'locked' : 'released'],
      ['Yaw/Pitch', `${snapshot.yaw.toFixed(2)} / ${snapshot.pitch.toFixed(2)}`],
    ];
  }

  dispose(): void {
    this.cleanup.dispose();
  }

  private update(): void {
    const engine = this.scene.getEngine();
    // Clamp delta so a background-tab restoration cannot produce a huge
    // integration step that fires the player through geometry.
    const deltaSeconds = Math.min(
      Math.max(engine.getDeltaTime() / 1000, 1e-4),
      this.config.maxDeltaTimeSeconds,
    );

    const snapshot = this.deps.input.getSnapshot();
    const movementActive =
      (this.pointerLock.isLocked || this.pointerLockBypass) && snapshot.windowFocused;

    if (movementActive) {
      this.cameraRig.applyLook(snapshot.pointer.deltaX, snapshot.pointer.deltaY);
      this.currentIntent = computeMovementIntent(
        snapshot.pressedKeys,
        this.previousPressed,
        DEFAULT_BINDINGS,
      );
    } else {
      // Pointer lock lost or window blurred: movement intent goes idle;
      // gravity and deceleration continue so the player settles safely.
      // Queued edge actions from the inactive period are discarded.
      this.currentIntent = IDLE_INTENT;
      this.jumpQueued = false;
      this.resetQueued = false;
    }
    this.previousPressed = snapshot.pressedKeys;

    const jumpPressed = this.jumpQueued || this.currentIntent.jumpPressed;
    const resetPressed = this.resetQueued || this.currentIntent.resetPressed;
    this.jumpQueued = false;
    this.resetQueued = false;

    if (resetPressed && this.deps.environment.isDevelopment) {
      this.respawn();
      return;
    }

    this.sprinting = isSprintAllowed(this.currentIntent, this.motor.isCrouched);
    const speed = this.motor.isCrouched
      ? this.config.crouchSpeed
      : this.sprinting
        ? this.config.sprintSpeed
        : this.config.walkSpeed;

    // Camera-relative horizontal target velocity: forward = yaw direction
    // projected on the ground plane, right = perpendicular.
    const yaw = this.cameraRig.yaw;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const { moveX, moveZ } = this.currentIntent;
    this.tmpTarget.set((sin * moveZ + cos * moveX) * speed, 0, (cos * moveZ - sin * moveX) * speed);

    this.motor.update(deltaSeconds, {
      targetVelocity: this.tmpTarget,
      jumpPressed,
      crouchHeld: this.currentIntent.crouchHeld,
    });

    if (this.motor.motorState.footPosition.y < this.config.outOfBoundsY) {
      this.respawn();
    }

    const eyeTarget = this.motor.isCrouched
      ? this.config.crouchedEyeHeight
      : this.config.standingEyeHeight;
    this.cameraRig.updateEyeHeight(eyeTarget, deltaSeconds);
    this.cameraRig.syncToFootPosition(this.motor.motorState.footPosition);

    this.mode = selectMovementMode({
      grounded: this.motor.motorState.grounded,
      horizontalSpeed: this.motor.motorState.horizontalSpeed,
      sprinting: this.sprinting,
      crouched: this.motor.isCrouched,
    });

    this.visualizer?.update(this.motor.motorState);
  }
}
