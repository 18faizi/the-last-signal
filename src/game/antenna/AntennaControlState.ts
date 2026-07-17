/**
 * Per-array high-level control state machine (mirrors ReceiverMode.ts /
 * GeneratorState.ts's explicit-transition-table pattern).
 *
 * Offline           – array unpowered (rooftop/antenna circuit de-energized).
 * Unavailable       – powered, but not selectable this session (e.g. a
 *                     non-selectable diagnostic array before its waveguide
 *                     route/prerequisite is satisfied). Distinct from
 *                     Offline: hardware has power, just isn't usable yet.
 * Idle              – powered, selectable, not the currently-selected array.
 * Moving            – the currently-selected array, motion in progress
 *                     toward a commanded target (requires power).
 * AlignedCandidate  – the currently-selected array, motion settled, quality
 *                     is within a "close, worth sampling" band but not yet
 *                     at the array's own tolerance-derived Aligned band.
 * Aligned           – DERIVED, never set directly: AntennaController
 *                     recomputes this every evaluation from AntennaMetrics
 *                     (overallQuality at/above a threshold). No external
 *                     caller may force Aligned.
 * Fault             – dev-only injected fault, never reached in normal play.
 *
 * Power loss ALWAYS routes to Offline (matching ReceiverController.powerOff's
 * documented reasoning) and freezes AntennaMechanicalState mid-transit
 * without discarding the commanded target; restored power returns to
 * Idle/Unavailable but deliberately does NOT auto-resume motion — the
 * player must explicitly re-command movement (spec constraint).
 */
export type AntennaControlState =
  'Offline' | 'Unavailable' | 'Idle' | 'Moving' | 'AlignedCandidate' | 'Aligned' | 'Fault';

const TRANSITIONS: Readonly<Record<AntennaControlState, readonly AntennaControlState[]>> = {
  // Offline can't move — only a powerOn() transition (Idle/Unavailable) or Fault injection is legal.
  Offline: ['Idle', 'Unavailable', 'Fault'],
  // Unavailable can't become Aligned directly — it must first become selectable (Idle) then move.
  Unavailable: ['Idle', 'Offline', 'Fault'],
  Idle: ['Moving', 'Unavailable', 'Offline', 'Fault'],
  Moving: ['Idle', 'AlignedCandidate', 'Aligned', 'Offline', 'Fault'],
  AlignedCandidate: ['Moving', 'Idle', 'Aligned', 'Offline', 'Fault'],
  Aligned: ['Moving', 'Idle', 'AlignedCandidate', 'Offline', 'Fault'],
  Fault: ['Offline'],
};

export function canTransitionAntennaControlState(
  from: AntennaControlState,
  to: AntennaControlState,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function tryTransitionAntennaControlState(
  current: AntennaControlState,
  target: AntennaControlState,
): AntennaControlState | null {
  if (current === target) return null;
  if (!canTransitionAntennaControlState(current, target)) return null;
  return target;
}

export function isAntennaArrayPowered(state: AntennaControlState): boolean {
  return state !== 'Offline' && state !== 'Fault';
}
