import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import type { Disposable } from '../../app/lifecycle/Disposable';
import { DisposableBag } from '../../app/lifecycle/Disposable';
import type { EnvironmentInfo } from '../../config/environment';
import { GameError } from '../../core/errors/GameError';
import type { ErrorReporter } from '../../core/errors/ErrorReporter';
import {
  DEFAULT_BINDINGS,
  InputAction,
  isActionPressed,
  keyLabelForAction,
} from '../../core/input/InputAction';
import type { InputManager } from '../../core/input/InputManager';
import type { FirstPersonController } from '../player/FirstPersonController';
import type { InteractionPromptView } from '../../ui/interaction/InteractionPromptView';
import { NO_FOCUS, updateFocus, type FocusState } from './FocusStability';
import { IDLE_HOLD, updateHold, type HoldState } from './HoldInteraction';
import type { InteractionConfig } from './InteractionConfig';
import { InteractionHighlight } from './InteractionHighlight';
import { assertModeTransition, type InteractionMode } from './InteractionMode';
import { formatPrompt } from './InteractionPromptFormat';
import type { InteractionRegistry } from './InteractionRegistry';
import { InteractionRaycaster, type FocusCandidateKind } from './InteractionRaycaster';
import type { InteractionAvailability, InteractionTarget } from './InteractionTarget';
import { isInspectableTarget, isReadableTarget, AVAILABLE } from './InteractionTarget';
import type { InspectionController } from './inspection/InspectionController';
import type { DocumentController } from './documents/DocumentController';
import type { InteractionDebugView } from './InteractionDebugView';

export interface InventoryViewControls {
  open(onClose?: () => void): void;
  close(): void;
}

export interface InteractionSystemDeps {
  readonly scene: Scene;
  readonly player: FirstPersonController;
  readonly input: InputManager;
  readonly registry: InteractionRegistry;
  readonly environment: EnvironmentInfo;
  readonly errorReporter: ErrorReporter;
  readonly promptView: InteractionPromptView;
  readonly inspection: InspectionController;
  readonly documents: DocumentController;
  readonly config: InteractionConfig;
  /** Development-only ray visualization (F6); null in production. */
  readonly debugView: InteractionDebugView | null;
  /** Inventory viewer (Tab key); null when not provided. */
  readonly inventoryViewer?: InventoryViewControls | null;
}

/** Plain-data snapshot for the debug overlay and test bridge. */
export interface InteractionDebugSnapshot {
  readonly mode: InteractionMode;
  readonly focusedId: string | null;
  readonly focusedLabel: string | null;
  readonly distance: number;
  readonly availability: string;
  readonly targetKind: string;
  readonly holdProgress: number;
  readonly inputSuspended: boolean;
  readonly suspensionReasons: readonly string[];
  readonly inspecting: boolean;
  readonly reading: boolean;
  readonly busyTargetId: string | null;
}

/**
 * Orchestrates focus detection, prompts, immediate/hold interactions and
 * the inspection/reading overlay modes. Registered as one scene observer
 * (added after the player controller's, so the frame's input snapshot is
 * already taken); the mode state machine rejects invalid transitions and
 * every error path restores gameplay input.
 */
export class InteractionSystem implements Disposable {
  private readonly deps: InteractionSystemDeps;
  private readonly raycaster: InteractionRaycaster;
  private readonly highlight = new InteractionHighlight();
  private readonly cleanup = new DisposableBag();
  private updateObserver: Observer<Scene> | null = null;

  private mode: InteractionMode = 'gameplay';
  private focus: FocusState = NO_FOCUS;
  private hold: HoldState = IDLE_HOLD;
  private interactQueued = false;
  private busyTargetId: string | null = null;
  private lastCandidateKind: FocusCandidateKind = 'none';
  private lastDistance = Number.POSITIVE_INFINITY;
  private lastAvailability: InteractionAvailability = AVAILABLE;
  private readonly keyLabel: string;

  private readonly rayOrigin = new Vector3();
  private readonly rayDirection = new Vector3();
  private readonly contextPosition = new Vector3();
  /** Reused mutable context object (structurally satisfies InteractionContext). */
  private readonly context: { playerPosition: Vector3; distance: number };

  constructor(deps: InteractionSystemDeps) {
    this.deps = deps;
    this.raycaster = new InteractionRaycaster(deps.scene, deps.registry, {
      defaultDistance: deps.config.interactionDistance,
      probeDistance: deps.config.probeDistance,
    });
    this.keyLabel = keyLabelForAction(DEFAULT_BINDINGS, InputAction.Interact);
    this.context = { playerPosition: this.contextPosition, distance: 0 };

    const unsubscribe = deps.input.onAction((action) => {
      if (action === InputAction.Interact) {
        this.interactQueued = true;
      } else if (action === InputAction.ResetPlayer && this.mode === 'inspecting') {
        // Mode routing for the R conflict: during inspection R resets the
        // inspected object; the player controller discards its dev-respawn
        // R while input is locked, so both can never fire together.
        this.deps.inspection.resetView();
      } else if (action === InputAction.ToggleInteractionRayDebug && this.deps.debugView !== null) {
        this.deps.debugView.toggle();
      } else if (action === InputAction.ToggleInventory) {
        if (this.mode === 'gameplay') {
          this.openInventory();
        } else if (this.mode === 'inventory') {
          this.closeInventory();
        }
      }
    });
    this.cleanup.add(unsubscribe);

    this.updateObserver = deps.scene.onBeforeRenderObservable.add(() => this.update());
    this.cleanup.add(() => {
      if (this.updateObserver !== null) {
        deps.scene.onBeforeRenderObservable.remove(this.updateObserver);
        this.updateObserver = null;
      }
    });
  }

  get currentMode(): InteractionMode {
    return this.mode;
  }

  getDebugSnapshot(): InteractionDebugSnapshot {
    const focused = this.focus.focused;
    return {
      mode: this.mode,
      focusedId: focused?.id ?? null,
      focusedLabel: focused !== null ? focused.getPrompt(this.context).label : null,
      distance: this.lastDistance,
      availability: this.lastAvailability.status,
      targetKind: focused?.kind ?? 'none',
      holdProgress: this.hold.progress,
      inputSuspended: this.deps.player.isGameplayInputSuspended,
      suspensionReasons: this.deps.player.inputSuspensionReasons,
      inspecting: this.deps.inspection.isOpen,
      reading: this.deps.documents.isOpen,
      busyTargetId: this.busyTargetId,
    };
  }

  getDebugFields(): ReadonlyArray<readonly [string, string]> {
    const snapshot = this.getDebugSnapshot();
    return [
      ['Int mode', snapshot.mode],
      ['Focus', snapshot.focusedId ?? 'none'],
      ['Focus label', snapshot.focusedLabel ?? '—'],
      [
        'Focus dist',
        Number.isFinite(snapshot.distance) ? `${snapshot.distance.toFixed(2)} m` : '—',
      ],
      ['Availability', snapshot.availability],
      ['Target kind', snapshot.targetKind],
      ['Ray', this.lastCandidateKind],
      ['Hold', `${Math.round(snapshot.holdProgress * 100)}%`],
      ['Input locks', snapshot.suspensionReasons.join(',') || 'none'],
      ['Inspecting', snapshot.inspecting ? 'yes' : 'no'],
      ['Reading', snapshot.reading ? 'yes' : 'no'],
    ];
  }

  /**
   * Development/test only: activates a registered, available target as if
   * it were focused and pressed. Used by the browser test bridge so
   * inspection/document flows don't require pixel-precise navigation in
   * headless CI. No-op in production and outside gameplay mode.
   */
  devActivate(targetId: string): boolean {
    if (!this.deps.environment.isDevelopment || this.mode !== 'gameplay') {
      return false;
    }
    const target = this.deps.registry.get(targetId);
    if (target === undefined) {
      return false;
    }
    if (this.safeAvailability(target).status !== 'available') {
      return false;
    }
    this.activate(target);
    return true;
  }

  private openInventory(): void {
    const viewer = this.deps.inventoryViewer;
    if (viewer === undefined || viewer === null) {
      return;
    }
    this.transition('inventory');
    this.cancelHoldIfActive();
    this.clearFocus();
    this.deps.promptView.hide();
    viewer.open(() => {
      if (this.mode === 'inventory') {
        this.transition('gameplay');
      }
    });
  }

  private closeInventory(): void {
    this.deps.inventoryViewer?.close();
    if (this.mode === 'inventory') {
      this.transition('gameplay');
    }
  }

  /** Development/test only: closes any open overlay mode. */
  devCloseOverlays(): void {
    if (!this.deps.environment.isDevelopment) {
      return;
    }
    this.deps.inspection.close();
    this.deps.documents.close();
  }

  dispose(): void {
    this.clearFocus();
    this.highlight.dispose();
    this.cleanup.dispose();
  }

  // ----- per-frame ------------------------------------------------------

  private update(): void {
    const deltaSeconds = Math.min(this.deps.scene.getEngine().getDeltaTime() / 1000, 0.05);
    const snapshot = this.deps.player.currentSnapshot;

    if (this.mode === 'inventory') {
      const viewer = this.deps.inventoryViewer;
      if (viewer === undefined || viewer === null) {
        this.transition('gameplay');
      }
      this.interactQueued = false;
      return;
    }

    if (this.mode === 'inspecting') {
      const pointerActive = this.deps.player.isPointerLocked || this.deps.environment.isDevelopment;
      const stillOpen = this.deps.inspection.update(snapshot, pointerActive);
      if (!stillOpen) {
        this.transition('gameplay');
      }
      this.interactQueued = false;
      return;
    }

    if (this.mode === 'reading') {
      if (!this.deps.documents.isOpen) {
        this.transition('gameplay');
      }
      this.interactQueued = false;
      return;
    }

    if (this.mode === 'transitioning') {
      // An async overlay setup is in flight; ignore inputs until it settles.
      this.interactQueued = false;
      return;
    }

    // ----- gameplay / holding ------------------------------------------
    const gameplayActive =
      this.deps.player.isGameplayViewActive && (snapshot?.windowFocused ?? false);

    if (!gameplayActive) {
      // Pointer lock lost, window blurred or input suspended: cancel any
      // hold, clear focus and hide UI. This also covers Escape-cancelling a
      // hold (Escape exits pointer lock).
      this.cancelHoldIfActive();
      this.clearFocus();
      this.deps.promptView.hide();
      this.deps.debugView?.update(null);
      this.interactQueued = false;
      return;
    }

    // One narrow raycast per frame from the camera center.
    this.deps.player.getViewRay(this.rayOrigin, this.rayDirection);
    const candidate = this.raycaster.cast(this.rayOrigin, this.rayDirection);
    this.lastCandidateKind = candidate.kind;
    this.deps.debugView?.update(candidate, this.rayOrigin, this.rayDirection);

    // Safety: a target unregistered while focused must not linger.
    if (
      this.focus.focused !== null &&
      this.deps.registry.get(this.focus.focused.id) === undefined
    ) {
      this.focus = NO_FOCUS;
      this.highlight.clear();
    }

    const eligible = candidate.kind === 'target' ? candidate.target : null;
    if (eligible !== null) {
      this.lastDistance = candidate.distance;
      this.context.distance = candidate.distance;
    }
    const focusUpdate = updateFocus(
      this.focus,
      eligible,
      deltaSeconds,
      this.deps.config.focusGraceSeconds,
    );
    this.focus = focusUpdate.state;
    this.contextPosition.copyFrom(this.rayOrigin);

    if (focusUpdate.exited !== null) {
      this.safeFocusCallback(() => focusUpdate.exited?.onFocusExit?.());
      this.highlight.clear();
    }
    if (focusUpdate.entered !== null) {
      this.safeFocusCallback(() => focusUpdate.entered?.onFocusEnter?.(this.context));
    }

    const focused = this.focus.focused;
    if (focused === null) {
      this.cancelHoldIfActive();
      this.deps.promptView.hide();
      this.lastDistance = Number.POSITIVE_INFINITY;
      this.interactQueued = false;
      return;
    }

    // Availability + prompt (out-of-range candidates never reach focus, so
    // the prompt is simply hidden when too far — the documented choice).
    const availability =
      this.busyTargetId === focused.id
        ? ({ status: 'busy' } as InteractionAvailability)
        : this.safeAvailability(focused);
    this.lastAvailability = availability;
    const disabled = availability.status !== 'available';
    this.highlight.apply(focused, disabled);
    this.deps.promptView.show(
      formatPrompt(focused.getPrompt(this.context), availability, focused.kind, this.keyLabel),
    );

    // Hold interactions.
    const holdEligible =
      focused.kind === 'hold' && availability.status === 'available' && eligible !== null
        ? focused.id
        : null;
    const held =
      snapshot !== null &&
      isActionPressed(DEFAULT_BINDINGS, snapshot.pressedKeys, InputAction.Interact);
    const holdUpdate = updateHold(this.hold, deltaSeconds, {
      held,
      eligibleTargetId: holdEligible,
      holdDurationSeconds: focused.holdDurationSeconds ?? 1.5,
    });
    this.hold = holdUpdate.state;
    if (holdUpdate.event === 'started') {
      this.transition('holding');
    } else if (holdUpdate.event === 'cancelled') {
      if (this.mode === 'holding') {
        this.transition('gameplay');
      }
      this.deps.promptView.setHoldProgress(null);
    } else if (holdUpdate.event === 'completed') {
      if (this.mode === 'holding') {
        this.transition('gameplay');
      }
      this.deps.promptView.setHoldProgress(null);
      this.execute(focused);
    }
    if (this.hold.targetId !== null && !this.hold.awaitingRelease) {
      this.deps.promptView.setHoldProgress(this.hold.progress);
    }

    // Press interactions (edge-queued from keydown events).
    if (this.interactQueued) {
      this.interactQueued = false;
      if (availability.status === 'available' && focused.kind !== 'hold') {
        this.activate(focused);
      }
    }
  }

  // ----- activation -----------------------------------------------------

  private activate(target: InteractionTarget): void {
    if (isInspectableTarget(target)) {
      this.transition('transitioning');
      try {
        this.deps.inspection.open(target);
        this.enterOverlayMode('inspecting');
      } catch (error) {
        this.deps.errorReporter.reportRecoverable(
          GameError.wrap('unexpected', error, `Inspection setup failed for '${target.id}'`),
        );
        this.transition('gameplay');
      }
      return;
    }
    if (isReadableTarget(target)) {
      this.transition('transitioning');
      const opened = this.deps.documents.open(target.documentId, () => {
        // Closed via the reader's own controls; per-frame update returns us
        // to gameplay mode.
      });
      if (opened) {
        this.enterOverlayMode('reading');
      } else {
        this.transition('gameplay');
      }
      return;
    }
    this.execute(target);
  }

  /** Runs a target's interact(), handling sync errors and async busy state. */
  private execute(target: InteractionTarget): void {
    if (this.busyTargetId !== null) {
      return;
    }
    let result;
    try {
      result = target.interact(this.context);
    } catch (error) {
      this.reportInteractionFailure(target, error);
      return;
    }
    if (result instanceof Promise) {
      this.busyTargetId = target.id;
      result
        .then(() => {
          this.busyTargetId = null;
        })
        .catch((error: unknown) => {
          this.busyTargetId = null;
          this.reportInteractionFailure(target, error);
        });
    }
  }

  private enterOverlayMode(mode: 'inspecting' | 'reading'): void {
    this.transition(mode);
    this.cancelHoldIfActive();
    this.clearFocus();
    this.deps.promptView.hide();
    this.deps.debugView?.update(null);
  }

  private transition(next: InteractionMode): void {
    if (this.mode === next) {
      return;
    }
    assertModeTransition(this.mode, next);
    this.mode = next;
  }

  private cancelHoldIfActive(): void {
    if (this.hold.targetId !== null || this.hold.awaitingRelease) {
      this.hold = IDLE_HOLD;
      this.deps.promptView.setHoldProgress(null);
      if (this.mode === 'holding') {
        this.transition('gameplay');
      }
    }
  }

  private clearFocus(): void {
    const focused = this.focus.focused;
    if (focused !== null) {
      this.safeFocusCallback(() => focused.onFocusExit?.());
    }
    this.focus = NO_FOCUS;
    this.highlight.clear();
    this.lastDistance = Number.POSITIVE_INFINITY;
  }

  private safeAvailability(target: InteractionTarget): InteractionAvailability {
    try {
      return target.getAvailability(this.context);
    } catch (error) {
      this.reportInteractionFailure(target, error);
      return { status: 'disabled', reason: 'UNAVAILABLE' };
    }
  }

  private safeFocusCallback(callback: () => void): void {
    try {
      callback();
    } catch (error) {
      this.deps.errorReporter.reportRecoverable(
        GameError.wrap('unexpected', error, 'Interaction focus callback failed'),
      );
    }
  }

  private reportInteractionFailure(target: InteractionTarget, error: unknown): void {
    this.deps.errorReporter.reportRecoverable(
      GameError.wrap('unexpected', error, `Interaction failed for target '${target.id}'`),
    );
  }
}
