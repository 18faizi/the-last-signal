/**
 * Enumeration of milestone 0.5 progression phases and the state machine
 * governing valid forward transitions.
 *
 * Phases advance monotonically: once a phase is left it cannot be re-entered.
 * Multiple branches (e.g. generator before control, or control before generator)
 * converge on TunnelAccessed before continuing linearly to completion.
 *
 * Babylon-free; used by FacilityRuntimeState and unit tests.
 */

export type ProgressionPhase =
  | 'Approach'
  | 'SecurityCheckpoint'
  | 'CompoundEntered'
  | 'ControlBuildingReached'
  | 'GeneratorAccessed'
  | 'TunnelAccessed'
  | 'StaffQuartersReached'
  | 'SupervisorOfficeReached'
  | 'RooftopAccessed'
  | 'GreyboxComplete';

/**
 * Valid forward transitions.  The state machine permits some branches:
 * the player may reach the control building or the generator first, so
 * ControlBuildingReached ↔ GeneratorAccessed are mutually reachable from
 * CompoundEntered.  After TunnelAccessed the path is strictly linear.
 */
const TRANSITIONS: Readonly<Record<ProgressionPhase, readonly ProgressionPhase[]>> = {
  Approach: ['SecurityCheckpoint'],
  SecurityCheckpoint: ['CompoundEntered'],
  CompoundEntered: ['ControlBuildingReached', 'GeneratorAccessed'],
  ControlBuildingReached: ['GeneratorAccessed'],
  GeneratorAccessed: ['ControlBuildingReached', 'TunnelAccessed'],
  TunnelAccessed: ['StaffQuartersReached'],
  StaffQuartersReached: ['SupervisorOfficeReached'],
  SupervisorOfficeReached: ['RooftopAccessed'],
  RooftopAccessed: ['GreyboxComplete'],
  GreyboxComplete: [],
};

export function canAdvancePhase(from: ProgressionPhase, to: ProgressionPhase): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Attempt to advance the progression phase.  Returns the new phase on success,
 * or null when the transition is invalid (already at target or illegal).
 */
export function tryAdvancePhase(
  current: ProgressionPhase,
  target: ProgressionPhase,
): ProgressionPhase | null {
  if (current === target) {
    return null; // no-op, not an error
  }
  if (!canAdvancePhase(current, target)) {
    return null;
  }
  return target;
}

/** Numeric ordering — higher = further in the progression. */
const PHASE_ORDER: readonly ProgressionPhase[] = [
  'Approach',
  'SecurityCheckpoint',
  'CompoundEntered',
  'ControlBuildingReached',
  'GeneratorAccessed',
  'TunnelAccessed',
  'StaffQuartersReached',
  'SupervisorOfficeReached',
  'RooftopAccessed',
  'GreyboxComplete',
];

/** Returns a positive number when a > b, negative when a < b, 0 when equal. */
export function comparePhase(a: ProgressionPhase, b: ProgressionPhase): number {
  return PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b);
}

export function isPhaseComplete(phase: ProgressionPhase): boolean {
  return phase === 'GreyboxComplete';
}
