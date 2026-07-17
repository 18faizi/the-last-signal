import { describe, expect, it } from 'vitest';
import {
  canAdvanceSignalPhase,
  tryAdvanceSignalPhase,
  compareSignalPhase,
  isSignalPuzzleComplete,
} from '../../game/receiver/SignalProgressionPhase';

describe('SignalProgressionPhase', () => {
  it('allows the documented monotonic forward chain', () => {
    expect(canAdvanceSignalPhase('ReceiverOffline', 'ReceiverOnline')).toBe(true);
    expect(canAdvanceSignalPhase('ReceiverOnline', 'SignalDetected')).toBe(true);
    expect(canAdvanceSignalPhase('SignalDetected', 'SignalLocked')).toBe(true);
    expect(canAdvanceSignalPhase('SignalLocked', 'TransmissionDecoded')).toBe(true);
    expect(canAdvanceSignalPhase('TransmissionDecoded', 'SignalPuzzleComplete')).toBe(true);
  });

  it('rejects skipping phases', () => {
    expect(canAdvanceSignalPhase('ReceiverOffline', 'SignalDetected')).toBe(false);
    expect(canAdvanceSignalPhase('ReceiverOnline', 'SignalLocked')).toBe(false);
    expect(canAdvanceSignalPhase('ReceiverOffline', 'SignalPuzzleComplete')).toBe(false);
  });

  it('rejects moving backward', () => {
    expect(canAdvanceSignalPhase('SignalLocked', 'SignalDetected')).toBe(false);
    expect(canAdvanceSignalPhase('SignalPuzzleComplete', 'TransmissionDecoded')).toBe(false);
  });

  it('SignalPuzzleComplete is terminal', () => {
    expect(tryAdvanceSignalPhase('SignalPuzzleComplete', 'ReceiverOffline')).toBeNull();
  });

  it('tryAdvanceSignalPhase returns null on same-phase and illegal transitions', () => {
    expect(tryAdvanceSignalPhase('ReceiverOffline', 'ReceiverOffline')).toBeNull();
    expect(tryAdvanceSignalPhase('ReceiverOffline', 'SignalLocked')).toBeNull();
    expect(tryAdvanceSignalPhase('ReceiverOffline', 'ReceiverOnline')).toBe('ReceiverOnline');
  });

  it('compareSignalPhase orders phases monotonically', () => {
    expect(compareSignalPhase('SignalPuzzleComplete', 'ReceiverOffline')).toBeGreaterThan(0);
    expect(compareSignalPhase('ReceiverOffline', 'SignalPuzzleComplete')).toBeLessThan(0);
    expect(compareSignalPhase('SignalDetected', 'SignalDetected')).toBe(0);
  });

  it('isSignalPuzzleComplete is true only for the terminal phase', () => {
    expect(isSignalPuzzleComplete('SignalPuzzleComplete')).toBe(true);
    expect(isSignalPuzzleComplete('TransmissionDecoded')).toBe(false);
  });
});
