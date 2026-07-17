import { describe, expect, it } from 'vitest';
import {
  canTransitionReceiverMode,
  tryTransitionReceiverMode,
  isReceiverPowered,
} from '../../game/receiver/ReceiverMode';

describe('ReceiverMode transitions', () => {
  it('allows the documented forward chain', () => {
    expect(canTransitionReceiverMode('Offline', 'Booting')).toBe(true);
    expect(canTransitionReceiverMode('Booting', 'Idle')).toBe(true);
    expect(canTransitionReceiverMode('Idle', 'Tuning')).toBe(true);
    expect(canTransitionReceiverMode('Tuning', 'Locked')).toBe(true);
    expect(canTransitionReceiverMode('Locked', 'Decoding')).toBe(true);
    expect(canTransitionReceiverMode('Decoding', 'Decoded')).toBe(true);
  });

  it('rejects Offline jumping straight to Tuning without power', () => {
    expect(canTransitionReceiverMode('Offline', 'Tuning')).toBe(false);
    expect(canTransitionReceiverMode('Offline', 'Idle')).toBe(false);
    expect(canTransitionReceiverMode('Offline', 'Locked')).toBe(false);
  });

  it('rejects Decoding requiring a Locked precursor being skipped', () => {
    expect(canTransitionReceiverMode('Tuning', 'Decoding')).toBe(false);
    expect(canTransitionReceiverMode('Idle', 'Decoding')).toBe(false);
  });

  it('Decoded does not regress to any prior state', () => {
    expect(canTransitionReceiverMode('Decoded', 'Tuning')).toBe(false);
    expect(canTransitionReceiverMode('Decoded', 'Locked')).toBe(false);
    expect(canTransitionReceiverMode('Decoded', 'Decoding')).toBe(false);
    expect(canTransitionReceiverMode('Decoded', 'Idle')).toBe(false);
  });

  it('Decoded only transitions via Offline (power cycle / dev reset)', () => {
    expect(canTransitionReceiverMode('Decoded', 'Offline')).toBe(true);
  });

  it('every powered state can drop to Offline (power loss always routes there)', () => {
    const poweredStates = [
      'Booting',
      'Idle',
      'Tuning',
      'Scanning',
      'Locked',
      'Decoding',
      'Decoded',
      'SignalLost',
    ] as const;
    for (const s of poweredStates) {
      expect(canTransitionReceiverMode(s, 'Offline')).toBe(true);
    }
  });

  it('SignalLost only resolves back to Tuning (not directly to Locked)', () => {
    expect(canTransitionReceiverMode('SignalLost', 'Tuning')).toBe(true);
    expect(canTransitionReceiverMode('SignalLost', 'Locked')).toBe(false);
  });

  it('Scanning only reachable from Tuning, and only resolves back to Tuning', () => {
    expect(canTransitionReceiverMode('Tuning', 'Scanning')).toBe(true);
    expect(canTransitionReceiverMode('Idle', 'Scanning')).toBe(false);
    expect(canTransitionReceiverMode('Scanning', 'Tuning')).toBe(true);
  });

  it('tryTransitionReceiverMode returns null for same-state and illegal transitions', () => {
    expect(tryTransitionReceiverMode('Offline', 'Offline')).toBeNull();
    expect(tryTransitionReceiverMode('Offline', 'Tuning')).toBeNull();
    expect(tryTransitionReceiverMode('Offline', 'Booting')).toBe('Booting');
  });

  it('isReceiverPowered is false only for Offline/Fault', () => {
    expect(isReceiverPowered('Offline')).toBe(false);
    expect(isReceiverPowered('Fault')).toBe(false);
    expect(isReceiverPowered('Booting')).toBe(true);
    expect(isReceiverPowered('Idle')).toBe(true);
    expect(isReceiverPowered('Decoded')).toBe(true);
  });

  it('Fault is reachable from any powered state and only resolves to Offline', () => {
    expect(canTransitionReceiverMode('Tuning', 'Fault')).toBe(true);
    expect(canTransitionReceiverMode('Locked', 'Fault')).toBe(true);
    expect(canTransitionReceiverMode('Fault', 'Offline')).toBe(true);
    expect(canTransitionReceiverMode('Fault', 'Tuning')).toBe(false);
  });
});
