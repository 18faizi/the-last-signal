/**
 * Dedicated threat-foundation progression model (Milestone 0.9).
 *
 * ARCHITECTURE DECISION (mirrors AntennaProgressionPhase.ts's precedent
 * exactly): the threat/encounter puzzle gets its OWN small monotonic phase
 * chain, tracked by ThreatRuntimeState as a FOURTH sibling — never merged
 * into the facility ProgressionPhase, SignalProgressionPhase or
 * AntennaProgressionPhase enums. Integration between the chains is via
 * explicit prerequisite checks (buildThreatEventBindings.ts) and typed event
 * subscriptions, never a merged enum, keeping every M0.5–M0.8 progression
 * test passing completely unmodified.
 *
 * Prerequisite for entry (enforced by the scene bindings, NOT this pure
 * table): the M0.8 antenna reveal must be complete — the event director's
 * first authored event is conditioned on `AntennaRevealComplete`, so nothing
 * threat-related can begin before the local-loop reveal.
 *
 * Transitions are monotonic and strictly linear (no branches), mirroring
 * SignalProgressionPhase/AntennaProgressionPhase's canAdvance/tryAdvance/
 * compare shape.
 */
export type ThreatProgressionPhase =
  | 'Inactive'
  | 'AntennaAftermathPending'
  | 'FirstManifestation'
  | 'DisturbanceSequence'
  | 'InvestigationActive'
  | 'StealthRequired'
  | 'PlayerDetected'
  | 'PursuitActive'
  | 'SafeZoneReached'
  | 'EncounterResolved'
  | 'ThreatFoundationComplete';

const TRANSITIONS: Readonly<Record<ThreatProgressionPhase, readonly ThreatProgressionPhase[]>> = {
  Inactive: ['AntennaAftermathPending'],
  AntennaAftermathPending: ['FirstManifestation'],
  FirstManifestation: ['DisturbanceSequence'],
  DisturbanceSequence: ['InvestigationActive'],
  InvestigationActive: ['StealthRequired'],
  StealthRequired: ['PlayerDetected'],
  PlayerDetected: ['PursuitActive'],
  PursuitActive: ['SafeZoneReached'],
  SafeZoneReached: ['EncounterResolved'],
  EncounterResolved: ['ThreatFoundationComplete'],
  ThreatFoundationComplete: [],
};

export function canAdvanceThreatPhase(
  from: ThreatProgressionPhase,
  to: ThreatProgressionPhase,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function tryAdvanceThreatPhase(
  current: ThreatProgressionPhase,
  target: ThreatProgressionPhase,
): ThreatProgressionPhase | null {
  if (current === target) return null;
  if (!canAdvanceThreatPhase(current, target)) return null;
  return target;
}

const PHASE_ORDER: readonly ThreatProgressionPhase[] = [
  'Inactive',
  'AntennaAftermathPending',
  'FirstManifestation',
  'DisturbanceSequence',
  'InvestigationActive',
  'StealthRequired',
  'PlayerDetected',
  'PursuitActive',
  'SafeZoneReached',
  'EncounterResolved',
  'ThreatFoundationComplete',
];

export function compareThreatPhase(a: ThreatProgressionPhase, b: ThreatProgressionPhase): number {
  return PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b);
}

export function isThreatFoundationComplete(phase: ThreatProgressionPhase): boolean {
  return phase === 'ThreatFoundationComplete';
}
