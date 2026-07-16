/**
 * Runtime state of a distribution-panel circuit breaker.
 *
 * 'Open'         – off, may be closed by the player.
 * 'Closed'       – on, circuit is requested energized.
 * 'Tripped'      – forced open by a fault; requires reset() before closing again.
 * 'LockedOpen'   – cannot be closed (upstream condition unmet).
 * 'LockedClosed' – cannot be opened (reserved for future scripted sequences).
 */
export type BreakerState = 'Open' | 'Closed' | 'Tripped' | 'LockedOpen' | 'LockedClosed';

export function isBreakerOperable(state: BreakerState): boolean {
  return state === 'Open' || state === 'Closed';
}
