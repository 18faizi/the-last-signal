import { describe, expect, it } from 'vitest';
import { selectStatusMessage } from '../../ui/signal/DecodeProgressView';
import type { ReceiverControllerSnapshot } from '../../game/receiver/ReceiverController';

function snapshot(overrides: Partial<ReceiverControllerSnapshot>): ReceiverControllerSnapshot {
  return {
    mode: 'Tuning',
    controls: { channel: 1, frequencyMHz: 80, gain: 0.5, filter: 0.5, phaseDeg: 0 },
    bootProgress: 1,
    isPanelOpen: true,
    scanning: false,
    activeSignalId: null,
    metrics: null,
    lockState: 'Searching',
    acquisitionProgress: 0,
    holdQuality: 0,
    decodeState: 'Idle',
    decodeProgress: 0,
    decodedSignalIds: [],
    ...overrides,
  };
}

describe('selectStatusMessage — chosen from actual mode + metrics, not guessed', () => {
  it('NO SIGNAL while Tuning and Searching', () => {
    expect(selectStatusMessage(snapshot({ mode: 'Tuning', lockState: 'Searching' }))).toBe(
      'NO SIGNAL',
    );
  });

  it('CARRIER DETECTED while Tuning and Candidate', () => {
    expect(selectStatusMessage(snapshot({ mode: 'Tuning', lockState: 'Candidate' }))).toBe(
      'CARRIER DETECTED',
    );
  });

  it('ACQUIRING LOCK while Tuning and Acquiring', () => {
    expect(selectStatusMessage(snapshot({ mode: 'Tuning', lockState: 'Acquiring' }))).toBe(
      'ACQUIRING LOCK',
    );
  });

  it('SCANNING while mode is Scanning', () => {
    expect(selectStatusMessage(snapshot({ mode: 'Scanning' }))).toBe('SCANNING');
  });

  it('LOCKED while mode is Locked', () => {
    expect(selectStatusMessage(snapshot({ mode: 'Locked', lockState: 'Locked' }))).toBe('LOCKED');
  });

  it('DECODING while mode is Decoding and decodeState is InProgress', () => {
    expect(
      selectStatusMessage(
        snapshot({ mode: 'Decoding', lockState: 'Locked', decodeState: 'InProgress' }),
      ),
    ).toBe('DECODING');
  });

  it('SIGNAL UNSTABLE while mode is Decoding but decodeState is Paused', () => {
    expect(
      selectStatusMessage(
        snapshot({ mode: 'Decoding', lockState: 'Locked', decodeState: 'Paused' }),
      ),
    ).toBe('SIGNAL UNSTABLE');
  });

  it('SIGNAL LOST while mode is SignalLost', () => {
    expect(selectStatusMessage(snapshot({ mode: 'SignalLost', lockState: 'Lost' }))).toBe(
      'SIGNAL LOST',
    );
  });

  it('TRANSMISSION DECODED while mode is Decoded', () => {
    expect(
      selectStatusMessage(
        snapshot({ mode: 'Decoded', lockState: 'Locked', decodeState: 'Completed' }),
      ),
    ).toBe('TRANSMISSION DECODED');
  });

  it('falls back to NO SIGNAL for Offline/Booting/Idle', () => {
    expect(selectStatusMessage(snapshot({ mode: 'Offline' }))).toBe('NO SIGNAL');
    expect(selectStatusMessage(snapshot({ mode: 'Booting' }))).toBe('NO SIGNAL');
    expect(selectStatusMessage(snapshot({ mode: 'Idle' }))).toBe('NO SIGNAL');
  });
});
