/**
 * Generator state machine.
 *
 * Offline            – never inspected this session (or freshly reset).
 * InspectionRequired – player must view the status panel before controls
 *                      are considered "known" (flavour gate; the panel
 *                      itself is always interactable, this just tracks
 *                      whether it has been read at least once).
 * NotReady            – inspected, but one or more start conditions unmet.
 * ReadyToStart         – every start condition met; starter control is live.
 * Cranking             – starter hold just completed; resolving pass/fail.
 * RunningUnstable       – engine caught; warm-up timer running.
 * Running               – warm-up complete; main breaker may be closed.
 * Stopping              – shutting down (manual stop or emergency stop).
 * Fault                 – crank failed or an emergency stop interrupted a run;
 *                         requires reset() to recover.
 *
 * Illegal transitions are rejected by tryTransition — callers must check the
 * boolean return rather than assume success.
 */
export type GeneratorState =
  | 'Offline'
  | 'InspectionRequired'
  | 'NotReady'
  | 'ReadyToStart'
  | 'Cranking'
  | 'RunningUnstable'
  | 'Running'
  | 'Stopping'
  | 'Fault';

const TRANSITIONS: Readonly<Record<GeneratorState, readonly GeneratorState[]>> = {
  Offline: ['InspectionRequired'],
  InspectionRequired: ['NotReady'],
  NotReady: ['ReadyToStart'],
  ReadyToStart: ['NotReady', 'Cranking'],
  Cranking: ['ReadyToStart', 'RunningUnstable', 'Fault'],
  RunningUnstable: ['Running', 'Stopping', 'Fault'],
  Running: ['Stopping', 'Fault'],
  Stopping: ['Offline'],
  Fault: ['Offline'],
};

export function canTransitionGeneratorState(from: GeneratorState, to: GeneratorState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function tryTransitionGeneratorState(
  current: GeneratorState,
  target: GeneratorState,
): GeneratorState | null {
  if (current === target) return null;
  if (!canTransitionGeneratorState(current, target)) return null;
  return target;
}

export function isGeneratorRunning(state: GeneratorState): boolean {
  return state === 'RunningUnstable' || state === 'Running';
}
