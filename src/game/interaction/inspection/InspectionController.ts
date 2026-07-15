import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Scene } from '@babylonjs/core/scene';
import type { Disposable } from '../../../app/lifecycle/Disposable';
import type { InputSnapshot } from '../../../core/input/InputSnapshot';
import type { FirstPersonController } from '../../player/FirstPersonController';
import type { InputLockToken } from '../../player/InputLock';
import type { InspectionOverlay } from '../../../ui/interaction/InspectionOverlay';
import type { InspectableTarget } from '../InteractionTarget';
import {
  DEFAULT_INSPECTION_VIEW_CONFIG,
  initialInspectionView,
  rotateInspectionView,
  zoomInspectionView,
  type InspectionViewState,
} from './InspectionOrientation';

/**
 * Object-inspection mode.
 *
 * Representation strategy (documented per spec): the inspected object is a
 * **fresh primitive assembly built by the target** (`buildInspectionModel`)
 * parked at a rig position far above the playable area, viewed by a
 * dedicated `TargetCamera`. The world mesh is never touched, the model has
 * no physics, and a dedicated hemispheric light with `includedOnlyMeshes`
 * guarantees visibility against the dark clear color. Camera and light are
 * created once and reused across sessions, so repeated open/close cycles
 * add no cameras, lights or observers.
 *
 * Pointer-lock strategy: inspection **keeps pointer lock** and reroutes the
 * frame's mouse deltas from camera look to model rotation. Pressing Escape
 * exits pointer lock natively — the controller treats that lock loss as
 * "close inspection". In dev bypass mode (no real lock), an explicit Escape
 * keydown listener closes it instead.
 */
const RIG_CENTER = new Vector3(0, 500, 0);

export class InspectionController implements Disposable {
  private readonly scene: Scene;
  private readonly player: FirstPersonController;
  private readonly overlay: InspectionOverlay;

  private camera: TargetCamera | null = null;
  private light: HemisphericLight | null = null;
  private model: TransformNode | null = null;
  private previousCamera: Camera | null = null;
  private lockToken: InputLockToken | null = null;
  private view: InspectionViewState = initialInspectionView(DEFAULT_INSPECTION_VIEW_CONFIG);
  private closeRequested = false;
  private readonly escListener = (event: KeyboardEvent): void => {
    if (event.code === 'Escape') {
      this.closeRequested = true;
    }
  };

  constructor(scene: Scene, player: FirstPersonController, overlay: InspectionOverlay) {
    this.scene = scene;
    this.player = player;
    this.overlay = overlay;
  }

  get isOpen(): boolean {
    return this.model !== null;
  }

  /** Test/debug visibility into the current view state. */
  get viewState(): InspectionViewState {
    return this.view;
  }

  /** Throws on setup failure; the caller restores gameplay state. */
  open(target: InspectableTarget): void {
    if (this.isOpen) {
      throw new Error('Inspection is already open');
    }
    this.lockToken = this.player.acquireInputLock('inspection');
    try {
      const model = target.buildInspectionModel(this.scene);
      model.position.copyFrom(RIG_CENTER);
      this.model = model;

      this.ensureRig();
      if (this.light !== null) {
        this.light.includedOnlyMeshes = model.getChildMeshes(false);
      }

      this.view = initialInspectionView(DEFAULT_INSPECTION_VIEW_CONFIG);
      this.applyView();

      this.previousCamera = this.scene.activeCamera;
      this.scene.activeCamera = this.camera;

      this.overlay.show(target.inspectionTitle, target.inspectionDescription);

      // Inspect-before-collect pickups: wire the TAKE ITEM button.
      const collectAfterInspect =
        'collectAfterInspect' in target &&
        (target as { collectAfterInspect: boolean }).collectAfterInspect === true;
      if (collectAfterInspect) {
        const collectTarget = target as unknown as {
          collect: () => void;
          onCollect: (() => void) | null;
        };
        collectTarget.onCollect = () => {
          this.closeRequested = true;
        };
        this.overlay.showTakeButton(() => {
          collectTarget.collect();
        });
      }

      this.closeRequested = false;
      document.addEventListener('keydown', this.escListener);
    } catch (error) {
      // Failed setup must never leave input suspended or a half-built rig.
      this.teardownSession();
      throw error;
    }
  }

  /**
   * Per-frame drive from the interaction system. Returns false when the
   * session ended this frame (Escape, pointer-lock loss).
   */
  update(snapshot: InputSnapshot | null, pointerActive: boolean): boolean {
    if (!this.isOpen) {
      return false;
    }
    if (this.closeRequested || !pointerActive) {
      this.close();
      return false;
    }
    if (snapshot !== null) {
      const { deltaX, deltaY } = snapshot.pointer;
      if (deltaX !== 0 || deltaY !== 0) {
        this.view = rotateInspectionView(this.view, deltaX, deltaY, DEFAULT_INSPECTION_VIEW_CONFIG);
      }
      if (snapshot.wheelDelta !== 0) {
        this.view = zoomInspectionView(
          this.view,
          snapshot.wheelDelta,
          DEFAULT_INSPECTION_VIEW_CONFIG,
        );
      }
      this.applyView();
    }
    return true;
  }

  resetView(): void {
    if (this.isOpen) {
      this.view = initialInspectionView(DEFAULT_INSPECTION_VIEW_CONFIG);
      this.applyView();
    }
  }

  close(): void {
    if (!this.isOpen) {
      return;
    }
    this.teardownSession();
  }

  dispose(): void {
    this.teardownSession();
    this.camera?.dispose();
    this.camera = null;
    this.light?.dispose();
    this.light = null;
  }

  private teardownSession(): void {
    document.removeEventListener('keydown', this.escListener);
    if (this.previousCamera !== null) {
      this.scene.activeCamera = this.previousCamera;
      this.previousCamera = null;
    }
    if (this.light !== null) {
      this.light.includedOnlyMeshes = [];
    }
    this.model?.dispose(false, true);
    this.model = null;
    this.overlay.hide();
    if (this.lockToken !== null) {
      this.player.releaseInputLock(this.lockToken);
      this.lockToken = null;
    }
  }

  /** Camera and light are lazily created once and reused across sessions. */
  private ensureRig(): void {
    if (this.camera === null) {
      this.camera = new TargetCamera('inspection-camera', RIG_CENTER.clone(), this.scene);
      this.camera.minZ = 0.05;
    }
    if (this.light === null) {
      this.light = new HemisphericLight('inspection-light', new Vector3(0.3, 1, -0.5), this.scene);
      this.light.intensity = 1.1;
      this.light.groundColor = new Color3(0.25, 0.25, 0.3);
    }
  }

  private applyView(): void {
    if (this.model === null || this.camera === null) {
      return;
    }
    this.model.rotation.set(this.view.pitch, this.view.yaw, 0);
    this.camera.position.set(RIG_CENTER.x, RIG_CENTER.y, RIG_CENTER.z - this.view.radius);
    this.camera.setTarget(RIG_CENTER);
  }
}
