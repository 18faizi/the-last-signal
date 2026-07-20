/**
 * Threat actor state machine (Milestone 0.9).
 *
 * One central transition table (mirrors GeneratorState/AntennaControlState/
 * InteractionMode): every state change goes through tryTransitionThreatState,
 * so illegal jumps are unrepresentable. Key authored guarantees:
 *
 *  - Dormant can never jump straight to Pursuing (or any perception-driven
 *    state past Unaware) — activation always passes through Manifesting or
 *    Unaware first.
 *  - Manifesting resolves only to Observing or Inactive.
 *  - Pursuing is reachable only from states in which active perception is
 *    running (Suspicious/Investigating/Searching); the CONTROLLER additionally
 *    requires a confirmed full-detection event before commanding it — the
 *    table encodes reachability, the controller encodes the detection gate.
 *  - LostTarget is reachable only from Pursuing/Searching.
 *  - Withdrawing ends at Dormant or Inactive, nothing else.
 *  - Fault has no successors: a faulted threat never silently resumes; only
 *    a full dev reset (which bypasses the table by construction) clears it.
 */
export type ThreatState =
  | 'Dormant'
  | 'Manifesting'
  | 'Observing'
  | 'Unaware'
  | 'Suspicious'
  | 'Investigating'
  | 'Searching'
  | 'Pursuing'
  | 'LostTarget'
  | 'Withdrawing'
  | 'Inactive'
  | 'Fault';

const TRANSITIONS: Readonly<Record<ThreatState, readonly ThreatState[]>> = {
  Dormant: ['Manifesting', 'Unaware', 'Fault'],
  Manifesting: ['Observing', 'Inactive', 'Fault'],
  Observing: ['Unaware', 'Investigating', 'Withdrawing', 'Fault'],
  Unaware: ['Suspicious', 'Withdrawing', 'Fault'],
  Suspicious: ['Unaware', 'Investigating', 'Pursuing', 'Withdrawing', 'Fault'],
  Investigating: ['Unaware', 'Suspicious', 'Searching', 'Pursuing', 'Withdrawing', 'Fault'],
  Searching: ['Investigating', 'Pursuing', 'LostTarget', 'Withdrawing', 'Fault'],
  Pursuing: ['LostTarget', 'Withdrawing', 'Fault'],
  LostTarget: ['Searching', 'Withdrawing', 'Fault'],
  Withdrawing: ['Dormant', 'Inactive', 'Fault'],
  Inactive: [],
  Fault: [],
};

export function canTransitionThreatState(from: ThreatState, to: ThreatState): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Returns the new state, or null when the transition is not allowed (or a no-op). */
export function tryTransitionThreatState(from: ThreatState, to: ThreatState): ThreatState | null {
  if (from === to) return null;
  return canTransitionThreatState(from, to) ? to : null;
}

/**
 * States in which the threat actor exists in the world and must be ticked.
 * Dormant/Inactive/Fault threats consume zero per-frame work (no raycasts,
 * no perception, no movement) — the scene adapter removes its observer.
 */
export function isThreatActive(state: ThreatState): boolean {
  return state !== 'Dormant' && state !== 'Inactive' && state !== 'Fault';
}

/**
 * States in which active perception (vision/suspicion accumulation) runs.
 * Manifesting/Withdrawing actors are staged presences and never perceive.
 */
export function isThreatPerceiving(state: ThreatState): boolean {
  return (
    state === 'Observing' ||
    state === 'Unaware' ||
    state === 'Suspicious' ||
    state === 'Investigating' ||
    state === 'Searching' ||
    state === 'Pursuing' ||
    state === 'LostTarget'
  );
}

export const ALL_THREAT_STATES: readonly ThreatState[] = [
  'Dormant',
  'Manifesting',
  'Observing',
  'Unaware',
  'Suspicious',
  'Investigating',
  'Searching',
  'Pursuing',
  'LostTarget',
  'Withdrawing',
  'Inactive',
  'Fault',
];
