/**
 * Door runtime state (Physical × Access decomposition).
 *
 * Physical state: what the door mesh is doing right now.
 * Access state:   what the lock is currently doing.
 *
 * Together they produce the interaction prompt and control animation.
 * Mutable; owned exclusively by DoorController.
 */

/** What the door panel is doing. */
export type PhysicalDoorState = 'closed' | 'opening' | 'open' | 'closing' | 'blocked';

/** What the lock mechanism is doing. */
export type AccessDoorState = 'unlocked' | 'locked' | 'unlocking' | 'disabled';

export interface DoorState {
  physical: PhysicalDoorState;
  access: AccessDoorState;
  /** 0 = fully closed; 1 = fully open. Used by motion implementations. */
  openFraction: number;
  /** Seconds remaining until auto-close triggers; NaN when not scheduled. */
  autoCloseCountdown: number;
}

export function createDoorState(initialAccess: AccessDoorState = 'locked'): DoorState {
  return {
    physical: 'closed',
    access: initialAccess,
    openFraction: 0,
    autoCloseCountdown: Number.NaN,
  };
}

/** Returns true when the door is fully closed and locked (interaction blocks player). */
export function isDoorBlocking(state: DoorState): boolean {
  return state.physical === 'closed' || state.physical === 'blocked';
}
