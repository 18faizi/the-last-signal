/**
 * Source-analysis state machine (mirrors SignalLockController's
 * transient-state pattern for InsufficientData).
 *
 * Unavailable          – prerequisites (decode + waveguide correction) not
 *                        yet met; sample collection is disabled.
 * Collecting           – accepting samples; 0-2 of the 3 required samples
 *                        (Array A, Array B, diagnostic loop C) collected.
 * InsufficientData     – transient: entered for exactly one
 *                        runComparison() call when fewer than 3 samples
 *                        exist, then resolves back to Collecting on the
 *                        next collectSample()/query.
 * Comparing            – cross-array comparison is running (synchronous in
 *                        this implementation, but kept as an observable
 *                        state for UI/tests to assert against, exactly like
 *                        SignalLockController's transient states).
 * ContradictionDetected – the comparison found no array whose bearing
 *                        satisfies externalSourceValid.
 * LocalLoopCandidate    – the diagnostic loop's near-zero path delay +
 *                        high localCouplingLikelihood confirms local
 *                        coupling.
 * Resolved             – final classification complete; fires
 *                        AnalysisResolved exactly once on entry.
 */
export type SourceAnalysisState =
  | 'Unavailable'
  | 'Collecting'
  | 'InsufficientData'
  | 'Comparing'
  | 'ContradictionDetected'
  | 'LocalLoopCandidate'
  | 'Resolved';

const TRANSITIONS: Readonly<Record<SourceAnalysisState, readonly SourceAnalysisState[]>> = {
  Unavailable: ['Collecting'],
  Collecting: ['InsufficientData', 'Comparing'],
  InsufficientData: ['Collecting'],
  Comparing: ['ContradictionDetected'],
  ContradictionDetected: ['LocalLoopCandidate'],
  LocalLoopCandidate: ['Resolved'],
  Resolved: [],
};

export function canTransitionSourceAnalysisState(
  from: SourceAnalysisState,
  to: SourceAnalysisState,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function tryTransitionSourceAnalysisState(
  current: SourceAnalysisState,
  target: SourceAnalysisState,
): SourceAnalysisState | null {
  if (current === target) return null;
  if (!canTransitionSourceAnalysisState(current, target)) return null;
  return target;
}
