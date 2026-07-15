import type { InteractionTarget, InteractionTargetId } from './InteractionTarget';

/**
 * Focus stabilization (pure logic).
 *
 * Strategy (documented per milestone spec): a short **loss grace period**.
 * When the raycast momentarily misses the focused target (mesh boundary,
 * tiny head movement), focus is retained for `graceSeconds`. A genuinely
 * different valid target replaces focus immediately — grace only bridges
 * gaps, it never delays switching. Enter/exit events fire exactly once per
 * transition.
 */
export interface FocusState {
  readonly focused: InteractionTarget | null;
  /** Seconds since the focused target was last confirmed by a raycast. */
  readonly secondsSinceSeen: number;
}

export const NO_FOCUS: FocusState = { focused: null, secondsSinceSeen: 0 };

export interface FocusUpdate {
  readonly state: FocusState;
  readonly entered: InteractionTarget | null;
  readonly exited: InteractionTarget | null;
}

export function updateFocus(
  state: FocusState,
  candidate: InteractionTarget | null,
  deltaSeconds: number,
  graceSeconds: number,
): FocusUpdate {
  const current = state.focused;

  if (candidate !== null) {
    if (current !== null && candidate.id === current.id) {
      return { state: { focused: current, secondsSinceSeen: 0 }, entered: null, exited: null };
    }
    // A different valid target replaces focus promptly.
    return {
      state: { focused: candidate, secondsSinceSeen: 0 },
      entered: candidate,
      exited: current,
    };
  }

  if (current === null) {
    return { state: NO_FOCUS, entered: null, exited: null };
  }

  const elapsed = state.secondsSinceSeen + deltaSeconds;
  if (elapsed < graceSeconds) {
    // Momentary loss: keep focus, keep counting.
    return { state: { focused: current, secondsSinceSeen: elapsed }, entered: null, exited: null };
  }
  return { state: NO_FOCUS, entered: null, exited: current };
}

/**
 * Deterministic selection between near-equivalent hits: higher explicit
 * priority wins when distances are within `epsilon`; otherwise nearest wins.
 * (The raycaster returns a single nearest hit; this helper exists for
 * targets whose meshes overlap at near-identical depth and is unit-tested
 * directly.)
 */
export function selectPreferredTarget(
  a: { target: InteractionTarget; distance: number },
  b: { target: InteractionTarget; distance: number },
  epsilon = 0.05,
): InteractionTargetId {
  if (Math.abs(a.distance - b.distance) <= epsilon) {
    const pa = a.target.priority ?? 0;
    const pb = b.target.priority ?? 0;
    if (pa !== pb) {
      return pa > pb ? a.target.id : b.target.id;
    }
  }
  return a.distance <= b.distance ? a.target.id : b.target.id;
}
