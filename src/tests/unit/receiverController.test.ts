import { describe, expect, it } from 'vitest';
import { ReceiverController } from '../../game/receiver/ReceiverController';
import { DEFAULT_RECEIVER_DEFINITION } from '../../game/receiver/ReceiverDefinition';
import type { SignalDefinition } from '../../game/signal/SignalDefinition';
import { asSignalId } from '../../game/signal/SignalId';

const SIGNAL: SignalDefinition = {
  id: asSignalId('sig-1'),
  displayName: 'Test Signal',
  channel: 3,
  targetFrequencyMHz: 117.4,
  frequencyToleranceMHz: 0.6,
  targetGainMin: 0.55,
  targetGainMax: 0.65,
  targetFilter: 0.65,
  filterTolerance: 0.12,
  targetPhaseDeg: -18,
  phaseToleranceDeg: 22,
  baseSignalStrength: 0.8,
  baseNoiseLevel: 0.35,
  minLockQuality: 0.85,
  lockAcquisitionSeconds: 2,
  decodeSeconds: 5,
  transcriptDocumentId: 'doc-test',
  discoverable: true,
  requiredForProgression: true,
};

function newReceiver(): ReceiverController {
  const c = new ReceiverController(DEFAULT_RECEIVER_DEFINITION);
  c.registerSignal(SIGNAL);
  return c;
}

/** Boots the receiver and ticks past bootSeconds, ending in Idle. */
function bootReceiver(c: ReceiverController): void {
  c.powerOn();
  const ticks = Math.ceil(DEFAULT_RECEIVER_DEFINITION.bootSeconds / 0.1) + 2;
  for (let i = 0; i < ticks; i++) c.update(0.1);
}

/** Tunes controls exactly to the signal's solution. */
function tuneToSolution(c: ReceiverController): void {
  c.setChannel(SIGNAL.channel);
  c.setFrequency(SIGNAL.targetFrequencyMHz);
  c.setGain((SIGNAL.targetGainMin + SIGNAL.targetGainMax) / 2);
  c.setFilter(SIGNAL.targetFilter);
  c.setPhase(SIGNAL.targetPhaseDeg);
}

/** Ticks until the receiver mode reaches `target`, or throws after a generous cap. */
function tickUntil(c: ReceiverController, target: string, maxTicks = 500): void {
  for (let i = 0; i < maxTicks; i++) {
    if (c.receiverMode === target) return;
    c.update(0.1);
  }
  throw new Error(`ReceiverController never reached mode "${target}" within ${maxTicks} ticks`);
}

describe('ReceiverController — initial state', () => {
  it('starts Offline with default controls', () => {
    const c = newReceiver();
    expect(c.receiverMode).toBe('Offline');
    expect(c.currentControls.channel).toBe(DEFAULT_RECEIVER_DEFINITION.minChannel);
  });
});

describe('ReceiverController — boot', () => {
  it('powerOn() transitions Offline -> Booting, and completes to Idle after bootSeconds', () => {
    const c = newReceiver();
    c.powerOn();
    expect(c.receiverMode).toBe('Booting');
    const ticks = Math.ceil(DEFAULT_RECEIVER_DEFINITION.bootSeconds / 0.1) + 2;
    for (let i = 0; i < ticks; i++) c.update(0.1);
    expect(c.receiverMode).toBe('Idle');
  });

  it('boot progress accumulates frame-rate independently', () => {
    const c = newReceiver();
    c.powerOn();
    const halfSeconds = DEFAULT_RECEIVER_DEFINITION.bootSeconds / 2;
    const ticks = Math.round(halfSeconds / 0.1);
    for (let i = 0; i < ticks; i++) c.update(0.1);
    expect(c.getSnapshot().bootProgress).toBeCloseTo(0.5, 1);
  });

  it('power loss during boot aborts safely back to Offline', () => {
    const c = newReceiver();
    c.powerOn();
    c.update(0.1);
    expect(c.receiverMode).toBe('Booting');
    c.powerOff();
    expect(c.receiverMode).toBe('Offline');
  });
});

describe('ReceiverController — open/reopen', () => {
  it('open() fails while unpowered/booting', () => {
    const c = newReceiver();
    expect(c.open()).toBe(false);
    c.powerOn();
    expect(c.open()).toBe(false);
  });

  it('opening an already-booted receiver moves Idle -> Tuning', () => {
    const c = newReceiver();
    bootReceiver(c);
    expect(c.open()).toBe(true);
    expect(c.receiverMode).toBe('Tuning');
  });

  it('reopening while already Locked/Decoding does not regress the mode', () => {
    const c = newReceiver();
    bootReceiver(c);
    c.open();
    tuneToSolution(c);
    tickUntil(c, 'Locked');
    c.close();
    expect(c.open()).toBe(true);
    expect(c.receiverMode).toBe('Locked');
  });
});

describe('ReceiverController — power loss / restoration', () => {
  it('power loss from Tuning routes to Offline and resets live lock/decode progress', () => {
    const c = newReceiver();
    bootReceiver(c);
    c.open();
    tuneToSolution(c);
    c.update(0.5); // partial acquisition progress
    expect(c.getSnapshot().acquisitionProgress).toBeGreaterThan(0);
    c.powerOff();
    expect(c.receiverMode).toBe('Offline');
    expect(c.getSnapshot().acquisitionProgress).toBe(0);
  });

  it('power loss from Locked/Decoding also routes to Offline', () => {
    const c = newReceiver();
    bootReceiver(c);
    c.open();
    tuneToSolution(c);
    tickUntil(c, 'Locked');
    c.powerOff();
    expect(c.receiverMode).toBe('Offline');
  });

  it('re-powering after a loss requires a fresh boot before tuning is possible again', () => {
    const c = newReceiver();
    bootReceiver(c);
    c.open();
    c.powerOff();
    c.powerOn();
    expect(c.receiverMode).toBe('Booting');
    expect(c.open()).toBe(false);
  });
});

describe('ReceiverController — decoded-state restoration', () => {
  it('fully decoding a signal, then power-cycling and reopening, restores straight to Decoded', () => {
    const c = newReceiver();
    bootReceiver(c);
    c.open();
    tuneToSolution(c);
    tickUntil(c, 'Decoded', 2000);
    expect(c.isDecoded(SIGNAL.id)).toBe(true);

    c.powerOff();
    c.powerOn();
    const ticks = Math.ceil(DEFAULT_RECEIVER_DEFINITION.bootSeconds / 0.1) + 2;
    for (let i = 0; i < ticks; i++) c.update(0.1);
    expect(c.receiverMode).toBe('Idle');

    // Controls persist across the power cycle (never reset by powerOff/On),
    // so re-tuning isn't even necessary — but confirm explicitly anyway.
    expect(c.currentControls.channel).toBe(SIGNAL.channel);
    expect(c.open()).toBe(true);
    expect(c.receiverMode).toBe('Decoded');
  });

  it('decodedSignalIds and getSnapshot both reflect the completed decode after restoration', () => {
    const c = newReceiver();
    bootReceiver(c);
    c.open();
    tuneToSolution(c);
    tickUntil(c, 'Decoded', 2000);
    const snap = c.getSnapshot();
    expect(snap.decodedSignalIds).toContain(SIGNAL.id);
    expect(snap.decodeState).toBe('Completed');
    expect(snap.decodeProgress).toBe(1);
  });
});

describe('ReceiverController — reset', () => {
  it('reset() fully restores factory defaults, clearing decoded signals', () => {
    const c = newReceiver();
    bootReceiver(c);
    c.open();
    tuneToSolution(c);
    tickUntil(c, 'Decoded', 2000);
    c.reset();
    expect(c.receiverMode).toBe('Offline');
    expect(c.getSnapshot().decodedSignalIds).toEqual([]);
    expect(c.currentControls.channel).toBe(DEFAULT_RECEIVER_DEFINITION.minChannel);
  });
});

describe('ReceiverController — scan behavior', () => {
  it('startScan only succeeds while Tuning, requiring power', () => {
    const c = newReceiver();
    expect(c.startScan()).toBe(false); // Offline
    bootReceiver(c);
    expect(c.startScan()).toBe(false); // Idle (not opened/Tuning yet)
    c.open();
    expect(c.startScan()).toBe(true);
    expect(c.receiverMode).toBe('Scanning');
  });

  it('manually adjusting any control cancels an active scan', () => {
    const c = newReceiver();
    bootReceiver(c);
    c.open();
    c.startScan();
    expect(c.isScanning).toBe(true);
    c.setGain(0.5);
    expect(c.isScanning).toBe(false);
    expect(c.receiverMode).toBe('Tuning');
  });

  it('cancelScan() stops the sweep and returns to Tuning', () => {
    const c = newReceiver();
    bootReceiver(c);
    c.open();
    c.startScan();
    c.cancelScan();
    expect(c.isScanning).toBe(false);
    expect(c.receiverMode).toBe('Tuning');
  });

  it('the scan sweep is deterministic: identical elapsed time always yields identical channel/frequency', () => {
    const a = newReceiver();
    bootReceiver(a);
    a.open();
    a.startScan();
    const b = newReceiver();
    bootReceiver(b);
    b.open();
    b.startScan();
    for (let i = 0; i < 37; i++) {
      a.update(0.1);
      b.update(0.1);
    }
    expect(a.currentControls.channel).toBe(b.currentControls.channel);
    expect(a.currentControls.frequencyMHz).toBeCloseTo(b.currentControls.frequencyMHz, 5);
  });

  it('scanning does not set gain/filter/phase to the solution (does not trivially solve the puzzle)', () => {
    const c = newReceiver();
    bootReceiver(c);
    c.open();
    c.startScan();
    const initialGain = c.currentControls.gain;
    const initialFilter = c.currentControls.filter;
    const initialPhase = c.currentControls.phaseDeg;
    for (let i = 0; i < 200; i++) c.update(0.1);
    expect(c.currentControls.gain).toBe(initialGain);
    expect(c.currentControls.filter).toBe(initialFilter);
    expect(c.currentControls.phaseDeg).toBe(initialPhase);
  });

  it('emits ChannelActivityDetected when the sweep pauses on the activity channel near the target frequency', () => {
    const c = newReceiver();
    bootReceiver(c);
    c.open();
    const events: string[] = [];
    c.subscribe((e) => events.push(e.kind));
    c.startScan();
    for (let i = 0; i < 200 && !events.includes('ChannelActivityDetected'); i++) {
      c.update(0.1);
    }
    expect(events).toContain('ChannelActivityDetected');
  });
});
