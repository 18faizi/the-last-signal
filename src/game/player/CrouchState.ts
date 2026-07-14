/**
 * Crouch state machine.
 *
 * Pure transition logic: the motor supplies `crouchHeld` (intent) and
 * `clearanceAvailable` (head-probe result) and applies collider changes when
 * the state actually changes. The four externally meaningful conditions the
 * milestone requires are all representable:
 *
 * - crouch requested → `crouchHeld` input
 * - crouched         → state 'crouched'
 * - blocked standing → state 'stand-blocked'
 * - standing         → state 'standing'
 */
export type CrouchState = 'standing' | 'crouched' | 'stand-blocked';

export interface CrouchInput {
  readonly crouchHeld: boolean;
  /** Whether the standing collider currently fits above the player. */
  readonly clearanceAvailable: boolean;
}

export function updateCrouchState(current: CrouchState, input: CrouchInput): CrouchState {
  if (input.crouchHeld) {
    // Holding crouch always crouches (or keeps crouching); a blocked stand
    // returns to plain crouched the moment the key is held again.
    return 'crouched';
  }
  if (current === 'standing') {
    return 'standing';
  }
  // Crouch released while crouched or stand-blocked: stand only when the
  // head probe reports room for the standing collider.
  return input.clearanceAvailable ? 'standing' : 'stand-blocked';
}

export function isCrouchedState(state: CrouchState): boolean {
  return state === 'crouched' || state === 'stand-blocked';
}
