import type { InteractionTargetId } from './InteractionTarget';

/**
 * Hold-to-interact progress logic (pure).
 *
 * The caller advances it each frame with the current conditions; the state
 * machine guarantees: progress only while every condition holds, cancel on
 * any condition loss, completion fires exactly once, and — for repeatable
 * targets — a fresh key press is required before another attempt (holding
 * through completion never retriggers).
 */
export interface HoldState {
  readonly targetId: InteractionTargetId | null;
  readonly progress: number;
  /** Set after completion until the key is released (blocks retrigger). */
  readonly awaitingRelease: boolean;
}

export const IDLE_HOLD: HoldState = { targetId: null, progress: 0, awaitingRelease: false };

export interface HoldConditions {
  /** The interact key is currently held. */
  readonly held: boolean;
  /** Target currently focused, available, and in range; null otherwise. */
  readonly eligibleTargetId: InteractionTargetId | null;
  readonly holdDurationSeconds: number;
}

export type HoldEvent = 'none' | 'started' | 'progressing' | 'cancelled' | 'completed';

export interface HoldUpdate {
  readonly state: HoldState;
  readonly event: HoldEvent;
}

export function updateHold(
  state: HoldState,
  deltaSeconds: number,
  conditions: HoldConditions,
): HoldUpdate {
  // A completed hold latches until the key is released; only then can a new
  // press begin another attempt.
  if (state.awaitingRelease) {
    if (conditions.held) {
      return { state, event: 'none' };
    }
    return { state: IDLE_HOLD, event: 'none' };
  }

  const active = state.targetId !== null;

  if (!conditions.held || conditions.eligibleTargetId === null) {
    return active ? { state: IDLE_HOLD, event: 'cancelled' } : { state: IDLE_HOLD, event: 'none' };
  }

  if (active && state.targetId !== conditions.eligibleTargetId) {
    // Focus moved to a different target mid-hold: cancel; a new hold starts
    // only from a fresh evaluation next frame.
    return { state: IDLE_HOLD, event: 'cancelled' };
  }

  const duration = Math.max(conditions.holdDurationSeconds, 1e-3);
  const progress = Math.min(1, state.progress + deltaSeconds / duration);
  if (progress >= 1) {
    return {
      state: { targetId: conditions.eligibleTargetId, progress: 1, awaitingRelease: true },
      event: 'completed',
    };
  }
  return {
    state: { targetId: conditions.eligibleTargetId, progress, awaitingRelease: false },
    event: active ? 'progressing' : 'started',
  };
}
