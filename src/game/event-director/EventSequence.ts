/**
 * Ordered action execution helper (Milestone 0.9).
 *
 * Runs an event's typed actions strictly in authored order with per-action
 * error isolation: a throwing executor never prevents the remaining actions
 * from running, and every failure is surfaced through onError (wired to the
 * ErrorReporter scene-side) rather than swallowed silently.
 */
import type { EventAction, EventActionExecutor } from './EventAction';

export function runEventActions(
  eventId: string,
  actions: readonly EventAction[],
  executor: EventActionExecutor,
  onError?: (eventId: string, action: EventAction, error: unknown) => void,
): void {
  for (const action of actions) {
    try {
      executor.execute(action);
    } catch (error) {
      onError?.(eventId, action, error);
    }
  }
}
