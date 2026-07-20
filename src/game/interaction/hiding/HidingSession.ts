/**
 * Hiding session (Milestone 0.9): the Babylon/DOM-facing glue between the
 * pure HidingController (game/threat/stealth/, no Babylon/DOM) and the
 * player controller + hiding overlay. Mirrors AntennaPanelSession's split:
 * this class owns the input lock, the camera transition and the exact
 * transform save/restore; the domain controller owns occupancy/concealment.
 *
 * Transform contract:
 *  - On entry the player's EXACT transform (position, yaw, pitch) is saved,
 *    the collider is parked at the spot's authored safe interior position
 *    (never intersecting geometry — authored data, validated), and the view
 *    lerps smoothly from the pre-hide eye position to the spot's authored
 *    camera position via a scoped observer that runs AFTER the player
 *    controller's own update (added later, so its write wins the frame).
 *  - On exit the saved transform is restored EXACTLY (teleportTo with the
 *    saved pitch) and the input lock release clears stale pressed keys and
 *    edge queues (FirstPersonController.releaseInputLock's contract).
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import type { Disposable } from '../../../app/lifecycle/Disposable';
import type { HidingController } from '../../threat/stealth/HidingController';
import type { FirstPersonController } from '../../player/FirstPersonController';
import type { InputLockToken } from '../../player/InputLock';
import type { HidingOverlay } from '../../../ui/threat/HidingOverlay';
import type { HidingControls } from '../InteractionSystem';

/** Seconds the entry camera glide takes (authored, short and readable). */
export const HIDING_CAMERA_TRANSITION_SECONDS = 0.35;

export class HidingSession implements HidingControls, Disposable {
  private lockToken: InputLockToken | null = null;
  private onClosed: (() => void) | null = null;
  private cameraObserver: Observer<Scene> | null = null;

  private savedPosition = new Vector3();
  private savedYaw = 0;
  private savedPitch = 0;

  private readonly camStart = new Vector3();
  private readonly camTarget = new Vector3();
  private readonly camScratch = new Vector3();
  private transition = 0;

  constructor(
    private readonly scene: Scene,
    private readonly hiding: HidingController,
    private readonly player: FirstPersonController,
    private readonly overlay: HidingOverlay,
  ) {}

  get isOpen(): boolean {
    return this.hiding.isHiding;
  }

  open(hidingSpotId: string, onClosed: () => void): boolean {
    if (this.isOpen) return false;
    const snap = this.player.getDebugSnapshot();
    const def = this.hiding.enter(hidingSpotId);
    if (def === null) return false;

    this.onClosed = onClosed;
    this.savedPosition.set(snap.position.x, snap.position.y, snap.position.z);
    this.savedYaw = snap.yaw;
    this.savedPitch = snap.pitch;

    this.lockToken = this.player.acquireInputLock('hiding');

    // Camera glide source: the current rendered eye position.
    const camera = this.scene.activeCamera;
    if (camera !== null) {
      this.camStart.copyFrom(camera.position);
    } else {
      this.camStart.copyFrom(this.savedPosition);
    }
    this.camTarget.set(def.cameraPosition.x, def.cameraPosition.y, def.cameraPosition.z);
    this.transition = 0;

    // Park the collider at the authored safe interior position.
    this.player.teleportTo(
      new Vector3(def.colliderPosition.x, def.colliderPosition.y, def.colliderPosition.z),
      def.facingYaw,
      0,
    );

    // Scoped observer, exists only while hiding: overrides the camera
    // position after the player controller's own sync each frame.
    this.cameraObserver = this.scene.onBeforeRenderObservable.add(() => this.tickCamera());

    this.overlay.show(def.displayName, def.fullyHiding);
    return true;
  }

  close(): void {
    if (!this.isOpen) return;
    if (this.cameraObserver !== null) {
      this.scene.onBeforeRenderObservable.remove(this.cameraObserver);
      this.cameraObserver = null;
    }
    this.hiding.exit();
    this.overlay.hide();
    // Exact restore: position, yaw AND pitch; releaseInputLock clears stale
    // pressed keys / buffered jumps (controller contract).
    this.player.teleportTo(this.savedPosition, this.savedYaw, this.savedPitch);
    if (this.lockToken !== null) {
      this.player.releaseInputLock(this.lockToken);
      this.lockToken = null;
    }
    const callback = this.onClosed;
    this.onClosed = null;
    callback?.();
  }

  dispose(): void {
    if (this.isOpen) {
      this.close();
    }
  }

  private tickCamera(): void {
    const camera = this.scene.activeCamera;
    if (camera === null) return;
    const dt = Math.min(this.scene.getEngine().getDeltaTime() / 1000, 0.1);
    this.transition = Math.min(this.transition + dt / HIDING_CAMERA_TRANSITION_SECONDS, 1);
    // Smoothstep ease for a readable, non-linear glide.
    const t = this.transition * this.transition * (3 - 2 * this.transition);
    this.camScratch.copyFrom(this.camStart).scaleInPlace(1 - t);
    camera.position.copyFrom(this.camTarget).scaleInPlace(t).addInPlace(this.camScratch);
  }
}
