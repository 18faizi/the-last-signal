/**
 * Application lifecycle states and the legal transitions between them.
 *
 * The transition table is the single source of truth: GameApplication asks
 * `canTransition` before every state change, so an illegal jump (for example
 * RUNNING -> INITIALIZING) is impossible rather than merely discouraged.
 */
export type LifecycleState =
  'created' | 'initializing' | 'ready' | 'running' | 'stopping' | 'stopped' | 'failed';

const TRANSITIONS: Readonly<Record<LifecycleState, readonly LifecycleState[]>> = {
  created: ['initializing', 'failed'],
  initializing: ['ready', 'failed'],
  ready: ['running', 'stopping', 'failed'],
  running: ['stopping', 'failed'],
  stopping: ['stopped', 'failed'],
  stopped: [],
  failed: ['stopping'],
};

export function canTransition(from: LifecycleState, to: LifecycleState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: LifecycleState, to: LifecycleState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal lifecycle transition: ${from} -> ${to}`);
  }
}
