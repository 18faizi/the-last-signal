import { InputAction, isActionPressed, type InputBindings } from '../../core/input/InputAction';

/**
 * Gameplay-facing movement intent for one frame, derived from raw input.
 *
 * Pure data + pure functions: no Babylon, no DOM, no controller state.
 * The controller converts intent into motion; tests exercise this layer
 * directly.
 */
export interface MovementIntent {
  /** Strafe axis: -1 left … +1 right (already normalized with moveZ). */
  readonly moveX: number;
  /** Forward axis: -1 backward … +1 forward (already normalized with moveX). */
  readonly moveZ: number;
  readonly sprintHeld: boolean;
  readonly crouchHeld: boolean;
  /** True only on the frame the jump key transitioned to pressed. */
  readonly jumpPressed: boolean;
  /** True only on the frame the reset key transitioned to pressed. */
  readonly resetPressed: boolean;
}

export const IDLE_INTENT: MovementIntent = {
  moveX: 0,
  moveZ: 0,
  sprintHeld: false,
  crouchHeld: false,
  jumpPressed: false,
  resetPressed: false,
};

/**
 * Computes normalized movement axes from pressed keys.
 * Opposing keys cancel exactly; diagonals are normalized so diagonal
 * movement is never faster than straight movement.
 */
export function computeMoveAxes(
  pressed: ReadonlySet<string>,
  bindings: InputBindings,
): { x: number; z: number } {
  let x = 0;
  let z = 0;
  if (isActionPressed(bindings, pressed, InputAction.MoveForward)) {
    z += 1;
  }
  if (isActionPressed(bindings, pressed, InputAction.MoveBackward)) {
    z -= 1;
  }
  if (isActionPressed(bindings, pressed, InputAction.MoveRight)) {
    x += 1;
  }
  if (isActionPressed(bindings, pressed, InputAction.MoveLeft)) {
    x -= 1;
  }
  const lengthSquared = x * x + z * z;
  if (lengthSquared > 1) {
    const inverseLength = 1 / Math.sqrt(lengthSquared);
    x *= inverseLength;
    z *= inverseLength;
  }
  return { x, z };
}

/**
 * Derives the frame's intent from the current and previous pressed-key sets.
 * Edge actions (jump, reset) fire only on the press transition, so a held
 * Space key does not retrigger jumps every frame.
 */
export function computeMovementIntent(
  pressed: ReadonlySet<string>,
  previousPressed: ReadonlySet<string>,
  bindings: InputBindings,
): MovementIntent {
  const axes = computeMoveAxes(pressed, bindings);
  const jumpNow = isActionPressed(bindings, pressed, InputAction.Jump);
  const jumpBefore = isActionPressed(bindings, previousPressed, InputAction.Jump);
  const resetNow = isActionPressed(bindings, pressed, InputAction.ResetPlayer);
  const resetBefore = isActionPressed(bindings, previousPressed, InputAction.ResetPlayer);
  return {
    moveX: axes.x,
    moveZ: axes.z,
    sprintHeld: isActionPressed(bindings, pressed, InputAction.Sprint),
    crouchHeld: isActionPressed(bindings, pressed, InputAction.Crouch),
    jumpPressed: jumpNow && !jumpBefore,
    resetPressed: resetNow && !resetBefore,
  };
}

/**
 * Whether sprint applies this frame. Sprint requires standing (not
 * crouched), meaningful directional input, and a forward-dominant direction —
 * backward sprint is disabled by design for this game's pacing (documented
 * in docs/architecture/player-controller.md).
 */
export function isSprintAllowed(intent: MovementIntent, crouched: boolean): boolean {
  if (!intent.sprintHeld || crouched) {
    return false;
  }
  const magnitude = Math.hypot(intent.moveX, intent.moveZ);
  if (magnitude < 0.1) {
    return false;
  }
  return intent.moveZ > 0.1;
}
