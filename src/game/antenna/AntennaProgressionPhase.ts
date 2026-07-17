/**
 * Dedicated antenna-alignment / source-analysis progression model
 * (Milestone 0.8).
 *
 * ARCHITECTURE DECISION (mirrors SignalProgressionPhase.ts's precedent
 * exactly): rather than extending either the facility ProgressionPhase or
 * SignalProgressionPhase, the antenna/waveguide/bearing puzzle gets its OWN
 * small monotonic phase chain, tracked by AntennaRuntimeState as a THIRD
 * sibling — not merged into either existing enum. Three separate typed
 * enums stay separate; integration between them is via explicit prerequisite
 * checks (see facilityAntennaBindings.ts) and typed event subscriptions,
 * never a merged enum. This keeps every M0.5/M0.6/M0.7 progression test
 * passing completely unmodified.
 *
 * Prerequisites for entry (enforced by facilityAntennaBindings.ts, NOT by
 * this pure phase table): `first_anomalous_transmission` must already be
 * decoded (M0.7's ReceiverRuntimeState) AND the rooftop/antenna circuit must
 * be energized — reaching the rooftop alone does not advance this chain.
 *
 * Transitions are monotonic and strictly linear (no branches), mirroring
 * SignalProgressionPhase.ts's canAdvance/tryAdvance/compare shape.
 */
export type AntennaProgressionPhase =
  | 'Unavailable'
  | 'DecodedSignalRequired'
  | 'RooftopPowerRequired'
  | 'AntennaPanelOnline'
  | 'WaveguideCorrectionRequired'
  | 'ReadyForSamples'
  | 'FirstArraySampled'
  | 'SecondArraySampled'
  | 'DiagnosticLoopSampled'
  | 'BearingContradictionDetected'
  | 'LocalLoopCandidate'
  | 'AntennaRevealComplete';

const TRANSITIONS: Readonly<Record<AntennaProgressionPhase, readonly AntennaProgressionPhase[]>> = {
  Unavailable: ['DecodedSignalRequired'],
  DecodedSignalRequired: ['RooftopPowerRequired'],
  RooftopPowerRequired: ['AntennaPanelOnline'],
  AntennaPanelOnline: ['WaveguideCorrectionRequired'],
  WaveguideCorrectionRequired: ['ReadyForSamples'],
  ReadyForSamples: ['FirstArraySampled'],
  FirstArraySampled: ['SecondArraySampled'],
  SecondArraySampled: ['DiagnosticLoopSampled'],
  DiagnosticLoopSampled: ['BearingContradictionDetected'],
  BearingContradictionDetected: ['LocalLoopCandidate'],
  LocalLoopCandidate: ['AntennaRevealComplete'],
  AntennaRevealComplete: [],
};

export function canAdvanceAntennaPhase(
  from: AntennaProgressionPhase,
  to: AntennaProgressionPhase,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function tryAdvanceAntennaPhase(
  current: AntennaProgressionPhase,
  target: AntennaProgressionPhase,
): AntennaProgressionPhase | null {
  if (current === target) return null;
  if (!canAdvanceAntennaPhase(current, target)) return null;
  return target;
}

const PHASE_ORDER: readonly AntennaProgressionPhase[] = [
  'Unavailable',
  'DecodedSignalRequired',
  'RooftopPowerRequired',
  'AntennaPanelOnline',
  'WaveguideCorrectionRequired',
  'ReadyForSamples',
  'FirstArraySampled',
  'SecondArraySampled',
  'DiagnosticLoopSampled',
  'BearingContradictionDetected',
  'LocalLoopCandidate',
  'AntennaRevealComplete',
];

export function compareAntennaPhase(
  a: AntennaProgressionPhase,
  b: AntennaProgressionPhase,
): number {
  return PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b);
}

export function isAntennaRevealComplete(phase: AntennaProgressionPhase): boolean {
  return phase === 'AntennaRevealComplete';
}
