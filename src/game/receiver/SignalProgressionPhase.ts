/**
 * Dedicated signal-puzzle progression model (Milestone 0.7).
 *
 * ARCHITECTURE DECISION (spec §32/§7): rather than further extending the
 * shared facility ProgressionPhase chain (which M0.6 already grew to 15
 * phases by appending GeneratorStarted…PowerNetworkOperational), the deeper
 * receiver/decode puzzle gets its OWN small monotonic phase chain here,
 * tracked by ReceiverRuntimeState as a sibling to FacilityRuntimeState — not
 * merged into it. Reasoning:
 *
 *   1. ProgressionPhase already conflates "world exploration" (Approach…
 *      RooftopAccessed) with "power-network setup" (GeneratorStarted…
 *      PowerNetworkOperational); adding five more phases for the signal
 *      puzzle would stretch one enum across three unrelated concerns.
 *   2. The existing 'ReceiverActivated' → 'PowerNetworkOperational' pair
 *      already marks "the receiver hardware is powered and reachable" —
 *      that milestone is preserved as-is (see facilityReceiverBindings.ts)
 *      and continues to mean exactly what it meant in M0.6. The NEW signal
 *      puzzle (tune → detect → lock → decode) is conceptually downstream of
 *      that milestone, not a replacement for it.
 *   3. Keeping this separate means every M0.5/M0.6 ProgressionPhase unit
 *      test keeps passing completely unmodified (verified by running
 *      `pnpm test` after this change) — there is no shared table to
 *      accidentally perturb.
 *
 * Transitions are monotonic and strictly linear (no branches), mirroring
 * ProgressionPhase.ts's canAdvance/tryAdvance/compare shape for consistency.
 */
export type SignalProgressionPhase =
  | 'ReceiverOffline'
  | 'ReceiverOnline'
  | 'SignalDetected'
  | 'SignalLocked'
  | 'TransmissionDecoded'
  | 'SignalPuzzleComplete';

const TRANSITIONS: Readonly<Record<SignalProgressionPhase, readonly SignalProgressionPhase[]>> = {
  ReceiverOffline: ['ReceiverOnline'],
  ReceiverOnline: ['SignalDetected'],
  SignalDetected: ['SignalLocked'],
  SignalLocked: ['TransmissionDecoded'],
  TransmissionDecoded: ['SignalPuzzleComplete'],
  SignalPuzzleComplete: [],
};

export function canAdvanceSignalPhase(
  from: SignalProgressionPhase,
  to: SignalProgressionPhase,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function tryAdvanceSignalPhase(
  current: SignalProgressionPhase,
  target: SignalProgressionPhase,
): SignalProgressionPhase | null {
  if (current === target) return null;
  if (!canAdvanceSignalPhase(current, target)) return null;
  return target;
}

const PHASE_ORDER: readonly SignalProgressionPhase[] = [
  'ReceiverOffline',
  'ReceiverOnline',
  'SignalDetected',
  'SignalLocked',
  'TransmissionDecoded',
  'SignalPuzzleComplete',
];

export function compareSignalPhase(a: SignalProgressionPhase, b: SignalProgressionPhase): number {
  return PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b);
}

export function isSignalPuzzleComplete(phase: SignalProgressionPhase): boolean {
  return phase === 'SignalPuzzleComplete';
}
