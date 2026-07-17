/**
 * Receiver device mode state machine (mirrors GeneratorState.ts's pattern).
 *
 * Offline    – unpowered.
 * Booting    – power just applied; a scoped boot timer is running.
 * Idle       – booted, powered, panel not yet opened this power cycle.
 * Tuning     – panel open (or was opened this power cycle), no lock yet.
 * Scanning   – the scripted scan sweep is running (a sub-mode of Tuning).
 * Locked     – SignalLockController reports Locked; decode not yet started.
 * Decoding   – lock held and DecodeController is InProgress/Paused.
 * Decoded    – DecodeController completed. Terminal — does not regress
 *              except via a full power cycle (powerOff) or dev reset().
 * SignalLost – transient: the lock was lost while still powered (a tuning
 *              drift, not a power event). Resolves back to Tuning once the
 *              lock controller leaves its own transient 'Lost' state.
 * Fault      – reachable only via the dev-only simulateFault() hook, never
 *              through normal play (mirrors GeneratorController's
 *              simulateBatteryDepletion() precedent).
 *
 * Power loss ALWAYS routes to Offline regardless of current state — see
 * ReceiverController.powerOff()'s doc comment for the exact reasoning
 * (SignalLost is reserved for a quality-driven loss while still powered).
 */
export type ReceiverMode =
  | 'Offline'
  | 'Booting'
  | 'Idle'
  | 'Tuning'
  | 'Scanning'
  | 'Locked'
  | 'Decoding'
  | 'Decoded'
  | 'SignalLost'
  | 'Fault';

const TRANSITIONS: Readonly<Record<ReceiverMode, readonly ReceiverMode[]>> = {
  Offline: ['Booting'],
  Booting: ['Idle', 'Offline', 'Fault'],
  Idle: ['Tuning', 'Offline', 'Fault'],
  Tuning: ['Scanning', 'Locked', 'Offline', 'Fault'],
  Scanning: ['Tuning', 'Offline', 'Fault'],
  Locked: ['Decoding', 'SignalLost', 'Offline', 'Fault'],
  Decoding: ['Decoded', 'SignalLost', 'Offline', 'Fault'],
  Decoded: ['Offline'],
  SignalLost: ['Tuning', 'Offline', 'Fault'],
  Fault: ['Offline'],
};

export function canTransitionReceiverMode(from: ReceiverMode, to: ReceiverMode): boolean {
  return TRANSITIONS[from].includes(to);
}

export function tryTransitionReceiverMode(
  current: ReceiverMode,
  target: ReceiverMode,
): ReceiverMode | null {
  if (current === target) return null;
  if (!canTransitionReceiverMode(current, target)) return null;
  return target;
}

export function isReceiverPowered(mode: ReceiverMode): boolean {
  return mode !== 'Offline' && mode !== 'Fault';
}
