import { describe, expect, it } from 'vitest';
import {
  ReceiverRuntimeState,
  type ReceiverRuntimeEvent,
} from '../../game/receiver/ReceiverRuntimeState';
import { asSignalId } from '../../game/signal/SignalId';

describe('ReceiverRuntimeState', () => {
  it('starts at ReceiverOffline, no decoded signals, not complete', () => {
    const state = new ReceiverRuntimeState();
    const snap = state.getSnapshot();
    expect(snap.signalPhase).toBe('ReceiverOffline');
    expect(snap.decodedSignalIds).toEqual([]);
    expect(snap.transcriptAvailable).toBe(false);
    expect(snap.puzzleComplete).toBe(false);
  });

  it('tryAdvancePhase advances the phase and emits phase-changed', () => {
    const state = new ReceiverRuntimeState();
    const events: ReceiverRuntimeEvent[] = [];
    state.subscribe((e) => events.push(e));
    expect(state.tryAdvancePhase('ReceiverOnline')).toBe(true);
    expect(state.signalPhase).toBe('ReceiverOnline');
    expect(events.some((e) => e.kind === 'phase-changed' && e.phase === 'ReceiverOnline')).toBe(
      true,
    );
  });

  it('rejects illegal/duplicate phase advances', () => {
    const state = new ReceiverRuntimeState();
    state.tryAdvancePhase('ReceiverOnline');
    expect(state.tryAdvancePhase('ReceiverOnline')).toBe(false);
    expect(state.tryAdvancePhase('SignalPuzzleComplete')).toBe(false);
    expect(state.signalPhase).toBe('ReceiverOnline');
  });

  it('reaching SignalPuzzleComplete sets puzzleComplete and fires completed', () => {
    const state = new ReceiverRuntimeState();
    const events: ReceiverRuntimeEvent[] = [];
    state.subscribe((e) => events.push(e));
    state.tryAdvancePhase('ReceiverOnline');
    state.tryAdvancePhase('SignalDetected');
    state.tryAdvancePhase('SignalLocked');
    state.tryAdvancePhase('TransmissionDecoded');
    state.tryAdvancePhase('SignalPuzzleComplete');
    expect(state.isPuzzleComplete).toBe(true);
    expect(events.filter((e) => e.kind === 'completed')).toHaveLength(1);
  });

  it('recordDecoded is idempotent and makes the transcript available', () => {
    const state = new ReceiverRuntimeState();
    const id = asSignalId('sig-1');
    state.recordDecoded(id);
    state.recordDecoded(id);
    const snap = state.getSnapshot();
    expect(snap.decodedSignalIds).toEqual([id]);
    expect(snap.transcriptAvailable).toBe(true);
  });

  it('reset() clears phase, decoded ids and completion, and fires reset', () => {
    const state = new ReceiverRuntimeState();
    const events: ReceiverRuntimeEvent[] = [];
    state.recordDecoded(asSignalId('sig-1'));
    state.tryAdvancePhase('ReceiverOnline');
    state.subscribe((e) => events.push(e));
    state.reset();
    const snap = state.getSnapshot();
    expect(snap.signalPhase).toBe('ReceiverOffline');
    expect(snap.decodedSignalIds).toEqual([]);
    expect(snap.puzzleComplete).toBe(false);
    expect(events.some((e) => e.kind === 'reset')).toBe(true);
  });

  it('unsubscribe stops further delivery and listener errors are swallowed', () => {
    const state = new ReceiverRuntimeState();
    const events: ReceiverRuntimeEvent[] = [];
    const unsub = state.subscribe((e) => events.push(e));
    unsub();
    state.tryAdvancePhase('ReceiverOnline');
    expect(events).toHaveLength(0);

    state.subscribe(() => {
      throw new Error('boom');
    });
    expect(() => state.tryAdvancePhase('SignalDetected')).not.toThrow();
  });
});
