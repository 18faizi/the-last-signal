/**
 * Per-event runtime lifecycle (Milestone 0.9).
 *
 *  Idle ── conditions+deps hold ──▶ PendingDelay ── delay elapses ──▶ Fired
 *   ▲                                   │ cancel()
 *   └── repeatable re-arm (conditions   ▼
 *       observed false after a fire)  Cancelled (terminal until reset)
 *
 * One-shot events stay Fired forever (dev reset only). Repeatable events
 * return to Idle only after an evaluation observes their conditions false —
 * preventing continuous re-fires while conditions simply keep holding.
 */
export type EventRuntimeState = 'Idle' | 'PendingDelay' | 'Fired' | 'Cancelled';

const TRANSITIONS: Readonly<Record<EventRuntimeState, readonly EventRuntimeState[]>> = {
  Idle: ['PendingDelay', 'Cancelled'],
  PendingDelay: ['Fired', 'Idle', 'Cancelled'],
  Fired: ['Idle', 'Cancelled'], // Idle only for repeatable re-arm.
  Cancelled: [],
};

export function canTransitionEventState(from: EventRuntimeState, to: EventRuntimeState): boolean {
  return TRANSITIONS[from].includes(to);
}
