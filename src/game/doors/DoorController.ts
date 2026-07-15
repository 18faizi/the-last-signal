/**
 * Per-door runtime controller: owns the state machine, animation, obstruction
 * probing, and access evaluation for one door.
 *
 * The controller is updated via update(deltaSeconds) once per frame from the
 * DoorInteractionTarget's onBeforeRender hook. It does NOT subclass or extend
 * InteractionTarget; instead DoorInteractionTarget wraps it.
 *
 * Lifecycle:
 *  scene setup → new DoorController → register DoorInteractionTarget → game loop
 *  scene teardown → dispose()
 */
import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { InventoryService } from '../inventory/InventoryService';
import type { InventoryRegistry } from '../inventory/InventoryRegistry';
import { AccessEvaluator } from '../access/AccessEvaluator';
import type { LockDefinition } from '../access/LockDefinition';
import { createLock } from '../access/LockState';
import type { LockState } from '../access/LockState';
import type { DoorDefinition } from './DoorDefinition';
import { createDoorState } from './DoorState';
import type { DoorState } from './DoorState';
import type { DoorMotion } from './DoorMotion';
import {
  HingedDoorMotion,
  DOOR_COLOR,
  DOOR_COLOR_LOCKED,
  DOOR_COLOR_UNLOCKED,
} from './HingedDoorMotion';
import { SlidingDoorMotion } from './SlidingDoorMotion';
import { DoorObstructionProbe } from './DoorObstructionProbe';

export type DoorEventKind =
  | 'door-opening'
  | 'door-opened'
  | 'door-closing'
  | 'door-closed'
  | 'door-blocked'
  | 'door-unlocked';

export interface DoorEvent {
  readonly kind: DoorEventKind;
  readonly doorId: string;
}

type DoorListener = (event: DoorEvent) => void;

/** Radians per second for animation at speed multiplier = 1. */
const BASE_ANGULAR_SPEED = Math.PI / 1.5; // 90° in ~1.5 s

export class DoorController {
  readonly id: string;
  readonly definition: DoorDefinition;
  readonly motion: DoorMotion;

  private readonly state: DoorState;
  private readonly lockState: LockState | null;
  private readonly lockDef: LockDefinition | null;
  private readonly evaluator: AccessEvaluator | null;
  private readonly probe: DoorObstructionProbe;
  private readonly speed: number;
  private readonly listeners = new Set<DoorListener>();

  constructor(
    definition: DoorDefinition,
    worldPosition: Vector3,
    scene: Scene,
    inventory: InventoryService | null,
    itemRegistry: InventoryRegistry,
  ) {
    this.id = definition.id;
    this.definition = definition;
    this.speed = definition.speedMultiplier ?? 1;

    const hasDef = definition.lock !== undefined;
    const initialAccess = hasDef ? 'locked' : 'unlocked';
    this.state = createDoorState(initialAccess);

    if (hasDef && inventory !== null) {
      this.lockDef = definition.lock ?? null;
      this.lockState = createLock(this.lockDef.id, 'locked');
      this.evaluator = new AccessEvaluator(inventory, itemRegistry);
    } else {
      this.lockDef = null;
      this.lockState = null;
      this.evaluator = null;
    }

    if (definition.motionConfig.motionType === 'hinged') {
      this.motion = new HingedDoorMotion(
        definition.id,
        definition.motionConfig,
        worldPosition,
        scene,
      );
    } else {
      this.motion = new SlidingDoorMotion(
        definition.id,
        definition.motionConfig,
        worldPosition,
        scene,
      );
    }

    this.probe = new DoorObstructionProbe(scene, this.motion.meshes);
    this.updateColor();
  }

  // ----- public API ------------------------------------------------------

  get doorState(): Readonly<DoorState> {
    return this.state;
  }

  get isLocked(): boolean {
    return this.state.access === 'locked';
  }

  get isOpen(): boolean {
    return this.state.physical === 'open';
  }

  /** Subscribe to door lifecycle events. Returns unsubscribe fn. */
  onEvent(listener: DoorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Attempt to interact with the door (called by DoorInteractionTarget.interact).
   * Returns the user-facing reason string when access is denied, null otherwise.
   */
  interact(): string | null {
    if (this.state.physical === 'opening' || this.state.physical === 'open') {
      this.startClose();
      return null;
    }

    if (
      this.state.access === 'locked' &&
      this.evaluator !== null &&
      this.lockDef !== null &&
      this.lockState !== null
    ) {
      const result = this.evaluator.evaluate(this.lockDef, this.lockState);
      if (result.status === 'denied') {
        return result.userFacingReason;
      }
      // Apply atomically.
      const applied = this.evaluator.applyPlan(result.consumptionPlan, this.lockState);
      if (!applied) {
        return 'ACCESS DENIED';
      }
      this.state.access = 'unlocked';
      this.emit({ kind: 'door-unlocked', doorId: this.id });
      this.updateColor();
    }

    if (this.state.physical === 'closed' || this.state.physical === 'blocked') {
      this.startOpen();
    }
    return null;
  }

  /**
   * Per-frame update. Call from the scene's onBeforeRender observer.
   * deltaSeconds: time since last frame, capped externally.
   */
  update(deltaSeconds: number): void {
    if (this.state.physical === 'opening') {
      const increment = (BASE_ANGULAR_SPEED * this.speed * deltaSeconds) / (Math.PI / 2);
      this.state.openFraction = Math.min(1, this.state.openFraction + increment);
      this.motion.applyFraction(this.state.openFraction);

      if (this.state.openFraction >= 1) {
        this.state.physical = 'open';
        const autoClose = this.definition.autoCloseSeconds ?? 0;
        if (autoClose > 0) {
          this.state.autoCloseCountdown = autoClose;
        }
        this.emit({ kind: 'door-opened', doorId: this.id });
      }
      return;
    }

    if (this.state.physical === 'closing') {
      const increment = (BASE_ANGULAR_SPEED * this.speed * deltaSeconds) / (Math.PI / 2);
      this.state.openFraction = Math.max(0, this.state.openFraction - increment);
      this.motion.applyFraction(this.state.openFraction);

      if (this.state.openFraction <= 0) {
        // Check obstruction before declaring closed.
        if (this.probe.isObstructed(this.state.openFraction)) {
          this.state.physical = 'blocked';
          this.emit({ kind: 'door-blocked', doorId: this.id });
        } else {
          this.state.physical = 'closed';
          this.emit({ kind: 'door-closed', doorId: this.id });
        }
      }
      return;
    }

    if (this.state.physical === 'open') {
      if (!Number.isNaN(this.state.autoCloseCountdown)) {
        this.state.autoCloseCountdown -= deltaSeconds;
        if (this.state.autoCloseCountdown <= 0) {
          this.state.autoCloseCountdown = Number.NaN;
          this.startClose();
        }
      }
    }

    if (this.state.physical === 'blocked') {
      // Retry opening every frame; once clear, switch back to closing.
      if (!this.probe.isObstructed(0)) {
        this.startClose();
      }
    }
  }

  dispose(): void {
    this.probe.dispose();
    this.motion.dispose();
    this.listeners.clear();
  }

  // ----- private ---------------------------------------------------------

  private startOpen(): void {
    this.state.physical = 'opening';
    this.state.autoCloseCountdown = Number.NaN;
    this.emit({ kind: 'door-opening', doorId: this.id });
  }

  private startClose(): void {
    this.state.physical = 'closing';
    this.state.autoCloseCountdown = Number.NaN;
    this.emit({ kind: 'door-closing', doorId: this.id });
  }

  private updateColor(): void {
    if (
      'setColor' in this.motion &&
      typeof (this.motion as { setColor?: unknown }).setColor === 'function'
    ) {
      const setColor = (this.motion as { setColor: (c: Color3) => void }).setColor.bind(
        this.motion,
      );
      if (this.state.access === 'locked') {
        setColor(DOOR_COLOR_LOCKED);
      } else if (this.state.access === 'unlocked' && this.lockDef !== null) {
        // Briefly show unlocked colour; fades to normal on next updateColor.
        setColor(DOOR_COLOR_UNLOCKED);
      } else {
        setColor(DOOR_COLOR);
      }
    }
  }

  private emit(event: DoorEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow.
      }
    }
  }
}
