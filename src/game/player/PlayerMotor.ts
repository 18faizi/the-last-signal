import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import {
  CharacterSupportedState,
  PhysicsCharacterController,
  type CharacterSurfaceInfo,
} from '@babylonjs/core/Physics/v2/characterController';
import { PhysicsShapeCapsule } from '@babylonjs/core/Physics/v2/physicsShape';
import { PhysicsRaycastResult } from '@babylonjs/core/Physics/physicsRaycastResult';
import type { PhysicsEngine } from '@babylonjs/core/Physics/v2/physicsEngine';
import type { Scene } from '@babylonjs/core/scene';
import type { Disposable } from '../../app/lifecycle/Disposable';
import { FILTER_GROUP_PLAYER, FILTER_GROUP_WORLD } from '../physics/PhysicsFilters';
import { isCrouchedState, updateCrouchState, type CrouchState } from './CrouchState';
import {
  advanceJumpTiming,
  consumeJump,
  INITIAL_JUMP_TIMING,
  shouldJump,
  type JumpTimingState,
} from './JumpTiming';
import type { PlayerConfig } from './PlayerConfig';

/** Per-frame command computed by the controller from player intent. */
export interface MotorCommand {
  /** Desired horizontal velocity in world space (magnitude = target speed). */
  readonly targetVelocity: Vector3;
  readonly jumpPressed: boolean;
  readonly crouchHeld: boolean;
}

/** Read-only view of the motor for debug/bridge consumers. Vectors are reused. */
export interface MotorState {
  readonly footPosition: Vector3;
  readonly velocity: Vector3;
  readonly horizontalSpeed: number;
  readonly verticalVelocity: number;
  readonly grounded: boolean;
  readonly sliding: boolean;
  readonly groundDistance: number;
  readonly groundNormal: Vector3;
  readonly slopeAngleDeg: number;
  readonly walkableSurface: boolean;
  readonly justLanded: boolean;
  readonly justLeftGround: boolean;
  readonly crouchState: CrouchState;
  readonly colliderHeight: number;
  readonly standingBlocked: boolean;
}

const UP = new Vector3(0, 1, 0);
const DOWN = new Vector3(0, -1, 0);

/**
 * Kinematic character motor built on Babylon's Havok-backed
 * PhysicsCharacterController.
 *
 * Motor strategy (documented in docs/architecture/player-controller.md):
 * the controller shape-casts through the world and resolves velocity against
 * contact planes via Havok's simplex solver — it is not a dynamic rigid body,
 * never rotates, and cannot tip over. This class owns the velocity model
 * (acceleration, gravity, jumping), stance (capsule swap for crouch) and the
 * ground/head probes; per-frame intent arrives as a MotorCommand.
 */
export class PlayerMotor implements Disposable {
  private readonly scene: Scene;
  private readonly config: PlayerConfig;
  private readonly controller: PhysicsCharacterController;
  private readonly standingShape: PhysicsShapeCapsule;
  private readonly crouchedShape: PhysicsShapeCapsule;

  private readonly velocity = new Vector3(0, 0, 0);
  private readonly footPosition = new Vector3(0, 0, 0);
  private readonly groundNormal = new Vector3(0, 1, 0);
  private crouchState: CrouchState = 'standing';
  private grounded = false;
  private sliding = false;
  private wasGrounded = false;
  private justLanded = false;
  private justLeftGround = false;
  private groundDistance = Number.POSITIVE_INFINITY;
  private slopeAngleDeg = 0;
  private walkableSurface = false;
  private standingBlocked = false;
  private jumpTiming: JumpTimingState = INITIAL_JUMP_TIMING;
  private jumpedThisFrame = false;

  // Reused temporaries — never allocated per frame.
  private readonly tmpHorizontal = new Vector3();
  private readonly tmpTarget = new Vector3();
  private readonly tmpDelta = new Vector3();
  private readonly tmpCenter = new Vector3();
  private readonly tmpFrom = new Vector3();
  private readonly tmpTo = new Vector3();
  private readonly raycastResult = new PhysicsRaycastResult();

  private readonly state: MotorState;

  constructor(scene: Scene, config: PlayerConfig, spawnFootPosition: Vector3) {
    this.scene = scene;
    this.config = config;

    this.standingShape = this.buildCapsule(config.standingHeight);
    this.crouchedShape = this.buildCapsule(config.crouchedHeight);

    const spawnCenter = spawnFootPosition.clone();
    spawnCenter.y += config.standingHeight / 2;
    this.controller = new PhysicsCharacterController(
      spawnCenter,
      { shape: this.standingShape },
      scene,
    );
    this.controller.up.copyFrom(UP);
    this.controller.maxSlopeCosine = Math.cos((config.maxSlopeAngleDeg * Math.PI) / 180);
    this.controller.maxStepHeight = config.maxStepHeight;
    this.controller.footOffset = config.standingHeight / 2;
    this.controller.maxCharacterSpeedForSolver = Math.max(10, config.sprintSpeed * 2);
    this.controller.keepDistance = 0.03;

    this.footPosition.copyFrom(spawnFootPosition);

    // Stable object identity: consumers hold this reference; fields update
    // in place each frame with zero allocation. Arrow getters capture the
    // motor's `this` lexically.
    const base = {
      footPosition: this.footPosition,
      velocity: this.velocity,
      groundNormal: this.groundNormal,
    };
    const dynamicGetters: Record<string, () => unknown> = {
      horizontalSpeed: () => Math.hypot(this.velocity.x, this.velocity.z),
      verticalVelocity: () => this.velocity.y,
      grounded: () => this.grounded,
      sliding: () => this.sliding,
      groundDistance: () => this.groundDistance,
      slopeAngleDeg: () => this.slopeAngleDeg,
      walkableSurface: () => this.walkableSurface,
      justLanded: () => this.justLanded,
      justLeftGround: () => this.justLeftGround,
      crouchState: () => this.crouchState,
      colliderHeight: () => this.currentHeight,
      standingBlocked: () => this.standingBlocked,
    };
    for (const [name, get] of Object.entries(dynamicGetters)) {
      Object.defineProperty(base, name, { get, enumerable: true });
    }
    this.state = base as MotorState;
  }

  get motorState(): MotorState {
    return this.state;
  }

  get isCrouched(): boolean {
    return isCrouchedState(this.crouchState);
  }

  private get currentHeight(): number {
    return this.isCrouched ? this.config.crouchedHeight : this.config.standingHeight;
  }

  /** Advances the motor one frame. deltaSeconds must already be clamped. */
  update(deltaSeconds: number, command: MotorCommand): void {
    const support = this.controller.checkSupport(deltaSeconds, DOWN);
    this.updateGroundState(support);
    this.updateCrouch(command.crouchHeld);
    this.updateJump(deltaSeconds, command.jumpPressed);
    this.updateVelocity(deltaSeconds, command, support);

    this.controller.setVelocity(this.velocity);
    this.controller.integrate(
      deltaSeconds,
      support,
      this.scene.getPhysicsEngine()?.gravity ?? DOWN,
    );

    // The solver clips velocity against contact planes (walls, ceilings);
    // adopt its result as authoritative so we never carry impossible
    // velocity (e.g. upward motion into a ceiling) into the next frame.
    this.velocity.copyFrom(this.controller.getVelocity());
    this.syncFootPosition();
    this.probeGround();
  }

  /** Teleports the player and clears motion state. */
  respawn(spawnFootPosition: Vector3): void {
    // Respawn points are authored with standing room, so restore the
    // standing stance unconditionally.
    if (this.isCrouched) {
      this.applyStance('standing');
    }
    this.crouchState = 'standing';
    this.standingBlocked = false;
    this.velocity.setAll(0);
    this.controller.setVelocity(this.velocity);
    this.tmpCenter.copyFrom(spawnFootPosition);
    this.tmpCenter.y += this.config.standingHeight / 2;
    this.controller.setPosition(this.tmpCenter);
    this.footPosition.copyFrom(spawnFootPosition);
    this.grounded = false;
    this.wasGrounded = false;
    this.jumpTiming = INITIAL_JUMP_TIMING;
  }

  dispose(): void {
    this.controller.dispose();
    this.standingShape.dispose();
    this.crouchedShape.dispose();
  }

  // ----- internals -------------------------------------------------------

  private buildCapsule(height: number): PhysicsShapeCapsule {
    const radius = this.config.colliderRadius;
    const half = height / 2 - radius;
    const shape = new PhysicsShapeCapsule(
      new Vector3(0, -half, 0),
      new Vector3(0, half, 0),
      radius,
      this.scene,
    );
    shape.filterMembershipMask = FILTER_GROUP_PLAYER;
    shape.filterCollideMask = FILTER_GROUP_WORLD;
    return shape;
  }

  private updateGroundState(support: CharacterSurfaceInfo): void {
    const supported = support.supportedState === CharacterSupportedState.SUPPORTED;
    this.sliding = support.supportedState === CharacterSupportedState.SLIDING;
    this.justLanded = supported && !this.wasGrounded;
    this.justLeftGround = !supported && this.wasGrounded;
    this.wasGrounded = supported;
    this.grounded = supported;
    if (this.justLanded) {
      // Kill residual downward velocity so landings never bounce.
      if (this.velocity.y < 0) {
        this.velocity.y = 0;
      }
    }
  }

  private updateCrouch(crouchHeld: boolean): void {
    const clearanceAvailable = this.hasStandingClearance();
    const next = updateCrouchState(this.crouchState, { crouchHeld, clearanceAvailable });
    this.standingBlocked = next === 'stand-blocked';
    if (next !== this.crouchState) {
      const wasCrouched = isCrouchedState(this.crouchState);
      const willBeCrouched = isCrouchedState(next);
      if (wasCrouched !== willBeCrouched) {
        this.applyStance(willBeCrouched ? 'crouched' : 'standing');
      }
      this.crouchState = next;
    }
  }

  /**
   * Swaps the capsule while keeping the foot planted, so resizing never
   * pushes the player into the floor or the ceiling.
   */
  private applyStance(stance: 'standing' | 'crouched'): void {
    const height = stance === 'crouched' ? this.config.crouchedHeight : this.config.standingHeight;
    const shape = stance === 'crouched' ? this.crouchedShape : this.standingShape;
    this.controller.shape = shape;
    this.controller.footOffset = height / 2;
    this.tmpCenter.copyFrom(this.footPosition);
    this.tmpCenter.y += height / 2;
    this.controller.setPosition(this.tmpCenter);
  }

  private updateJump(deltaSeconds: number, jumpPressed: boolean): void {
    this.jumpedThisFrame = false;
    this.jumpTiming = advanceJumpTiming(this.jumpTiming, deltaSeconds, {
      grounded: this.grounded,
      jumpPressed,
    });
    if (
      shouldJump(this.jumpTiming, {
        coyoteTimeSeconds: this.config.coyoteTimeSeconds,
        jumpBufferSeconds: this.config.jumpBufferSeconds,
      })
    ) {
      this.jumpTiming = consumeJump(this.jumpTiming);
      this.velocity.y = this.config.jumpVelocity;
      this.grounded = false;
      this.jumpedThisFrame = true;
    }
  }

  private updateVelocity(
    deltaSeconds: number,
    command: MotorCommand,
    support: CharacterSurfaceInfo,
  ): void {
    // Horizontal component moves toward the commanded target at a rate that
    // depends on ground contact and whether the player is driving or
    // stopping.
    this.tmpHorizontal.set(this.velocity.x, 0, this.velocity.z);
    this.tmpTarget.copyFrom(command.targetVelocity);
    this.tmpTarget.y = 0;

    let rate: number;
    if (this.grounded) {
      rate =
        this.tmpTarget.lengthSquared() > 1e-4
          ? this.config.groundAcceleration
          : this.config.groundDeceleration;
    } else {
      rate = this.config.airAcceleration;
      // Airborne control is capped: intent cannot exceed the configured
      // air-control speed, so sprint-jump momentum decays rather than grows.
      const maxAir = this.config.maxAirControlSpeed;
      if (this.tmpTarget.lengthSquared() > maxAir * maxAir) {
        this.tmpTarget.normalize().scaleInPlace(maxAir);
      }
    }
    moveVectorToward(this.tmpHorizontal, this.tmpTarget, rate * deltaSeconds, this.tmpDelta);

    if (this.grounded && !this.jumpedThisFrame) {
      const normal = support.averageSurfaceNormal;
      const flatSpeedSquared = this.tmpHorizontal.lengthSquared();
      if (flatSpeedSquared < 1e-6) {
        // Idle on a supported surface: hold position exactly; no gravity
        // means no slow creep down walkable slopes.
        this.velocity.setAll(0);
      } else {
        // Project the horizontal intent onto the surface plane, preserving
        // speed, so ascending/descending slopes tracks the surface instead
        // of stuttering airborne.
        const speed = Math.sqrt(flatSpeedSquared);
        this.tmpHorizontal.subtractToRef(
          normal.scale(Vector3.Dot(this.tmpHorizontal, normal)),
          this.tmpDelta,
        );
        if (this.tmpDelta.lengthSquared() > 1e-8) {
          this.tmpDelta.normalize().scaleInPlace(speed);
        }
        this.velocity.copyFrom(this.tmpDelta);
      }
    } else {
      // Airborne (or sliding on an unwalkable slope): keep the vertical
      // component and integrate gravity explicitly. `integrate` does not
      // apply gravity to the character's velocity — its gravity parameter
      // only shapes impulses on dynamic bodies.
      const vy = this.velocity.y + this.config.gravityY * deltaSeconds;
      this.velocity.set(this.tmpHorizontal.x, vy, this.tmpHorizontal.z);
    }
  }

  private syncFootPosition(): void {
    const center = this.controller.getPosition();
    this.footPosition.set(center.x, center.y - this.currentHeight / 2, center.z);
  }

  /** Narrow downward raycast for debug distance/normal/slope readouts. */
  private probeGround(): void {
    const engine = this.scene.getPhysicsEngine() as PhysicsEngine | null;
    if (engine === null) {
      return;
    }
    this.tmpFrom.copyFrom(this.footPosition);
    this.tmpFrom.y += 0.05;
    this.tmpTo.copyFrom(this.footPosition);
    this.tmpTo.y -= this.config.groundProbeDistance;
    engine.raycastToRef(this.tmpFrom, this.tmpTo, this.raycastResult, {
      membership: FILTER_GROUP_PLAYER,
      collideWith: FILTER_GROUP_WORLD,
    });
    if (this.raycastResult.hasHit) {
      this.groundDistance = Math.max(0, this.tmpFrom.y - this.raycastResult.hitPointWorld.y - 0.05);
      this.groundNormal.copyFrom(this.raycastResult.hitNormalWorld);
      const cosine = Math.min(1, Math.max(-1, Vector3.Dot(this.groundNormal, UP)));
      this.slopeAngleDeg = (Math.acos(cosine) * 180) / Math.PI;
      this.walkableSurface = this.slopeAngleDeg <= this.config.maxSlopeAngleDeg + 0.5;
    } else {
      this.groundDistance = Number.POSITIVE_INFINITY;
      this.groundNormal.set(0, 1, 0);
      this.slopeAngleDeg = 0;
      this.walkableSurface = false;
    }
  }

  /**
   * Head-clearance probe using the actual collider dimensions: upward rays
   * from the top of the current capsule spanning the extra height the
   * standing capsule would occupy (plus a safety margin). A center ray plus
   * four rim rays approximate the capsule's top disc without a full shape
   * cast.
   */
  private hasStandingClearance(): boolean {
    if (!this.isCrouched) {
      return true;
    }
    const engine = this.scene.getPhysicsEngine() as PhysicsEngine | null;
    if (engine === null) {
      return true;
    }
    const extraHeight =
      this.config.standingHeight - this.config.crouchedHeight + this.config.headClearanceMargin;
    const topY = this.footPosition.y + this.config.crouchedHeight - 0.02;
    const rim = this.config.colliderRadius * 0.7;
    const offsets: ReadonlyArray<readonly [number, number]> = [
      [0, 0],
      [rim, 0],
      [-rim, 0],
      [0, rim],
      [0, -rim],
    ];
    for (const [dx, dz] of offsets) {
      this.tmpFrom.set(this.footPosition.x + dx, topY, this.footPosition.z + dz);
      this.tmpTo.set(this.tmpFrom.x, topY + extraHeight, this.tmpFrom.z);
      engine.raycastToRef(this.tmpFrom, this.tmpTo, this.raycastResult, {
        membership: FILTER_GROUP_PLAYER,
        collideWith: FILTER_GROUP_WORLD,
      });
      if (this.raycastResult.hasHit) {
        return false;
      }
    }
    return true;
  }
}

/** In-place move-toward for vectors: shifts `current` toward `target` by maxDelta. */
function moveVectorToward(current: Vector3, target: Vector3, maxDelta: number, tmp: Vector3): void {
  target.subtractToRef(current, tmp);
  const distance = tmp.length();
  if (distance <= maxDelta || distance < 1e-9) {
    current.copyFrom(target);
    return;
  }
  tmp.scaleInPlace(maxDelta / distance);
  current.addInPlace(tmp);
}
