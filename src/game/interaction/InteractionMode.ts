/**
 * Interaction-mode state machine.
 *
 * One central transition table instead of scattered booleans: the
 * InteractionSystem asks `canTransitionMode` before every change, so states
 * like "reading while inspecting" are unrepresentable. `transitioning`
 * covers async setup (e.g. inspection construction) so duplicate entries
 * are rejected while a transition is in flight.
 */
export type InteractionMode =
  'gameplay' | 'holding' | 'inspecting' | 'reading' | 'transitioning' | 'inventory' | 'power-panel';

const TRANSITIONS: Readonly<Record<InteractionMode, readonly InteractionMode[]>> = {
  gameplay: ['holding', 'transitioning', 'inventory'],
  holding: ['gameplay'],
  transitioning: ['inspecting', 'reading', 'power-panel', 'gameplay'],
  inspecting: ['gameplay'],
  reading: ['gameplay'],
  inventory: ['gameplay'],
  'power-panel': ['gameplay'],
};

export function canTransitionMode(from: InteractionMode, to: InteractionMode): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertModeTransition(from: InteractionMode, to: InteractionMode): void {
  if (!canTransitionMode(from, to)) {
    throw new Error(`Illegal interaction-mode transition: ${from} -> ${to}`);
  }
}

/** Gameplay-blocking modes suspend locomotion/look via input locks. */
export function isOverlayMode(mode: InteractionMode): boolean {
  return (
    mode === 'inspecting' ||
    mode === 'reading' ||
    mode === 'transitioning' ||
    mode === 'inventory' ||
    mode === 'power-panel'
  );
}
