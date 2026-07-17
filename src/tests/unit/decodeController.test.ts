import { describe, expect, it } from 'vitest';
import { DecodeController, MAX_DECODE_DT_SECONDS } from '../../game/signal/DecodeController';
import { asSignalId } from '../../game/signal/SignalId';
import type { SignalEvent } from '../../game/signal/SignalEvent';
import type { SignalLockState } from '../../game/signal/SignalLockController';

const CONFIG = { signalId: asSignalId('sig-1'), decodeSeconds: 5 };

function withEvents(): { controller: DecodeController; events: SignalEvent[] } {
  const controller = new DecodeController(CONFIG);
  const events: SignalEvent[] = [];
  controller.subscribe((e) => events.push(e));
  return { controller, events };
}

/**
 * Ticks the controller in real, per-frame-sized steps (≤ MAX_DECODE_DT_SECONDS)
 * for a total of `seconds` — update()'s internal dt clamp means a single
 * call with a large dt does NOT accumulate proportionally (by design, it
 * behaves like a single capped tick), so tests that want N seconds of
 * elapsed time must simulate N/step real ticks, exactly like production
 * code driven from a real render loop would.
 */
function runLocked(
  controller: DecodeController,
  seconds: number,
  lockState: SignalLockState,
  holdQuality: number,
  step = 0.1,
): void {
  const ticks = Math.round(seconds / step);
  for (let i = 0; i < ticks; i++) {
    controller.update(step, lockState, holdQuality);
  }
}

describe('DecodeController — begins only when Locked', () => {
  it('does not progress while Searching/Candidate/Acquiring', () => {
    const controller = new DecodeController(CONFIG);
    controller.update(0.1, 'Searching', 0);
    controller.update(0.1, 'Candidate', 0);
    controller.update(0.1, 'Acquiring', 0);
    expect(controller.decodeProgress).toBe(0);
    expect(controller.decodeState).toBe('Idle');
  });

  it('starts progressing once Locked with full holdQuality, firing DecodeStarted once', () => {
    const { controller, events } = withEvents();
    controller.update(0.1, 'Locked', 1);
    expect(controller.decodeState).toBe('InProgress');
    expect(controller.decodeProgress).toBeCloseTo(0.1 / CONFIG.decodeSeconds, 5);
    expect(events.filter((e) => e.kind === 'DecodeStarted')).toHaveLength(1);
  });
});

describe('DecodeController — accumulation', () => {
  it('accumulates toward 1 over decodeSeconds, frame-rate independent', () => {
    const a = new DecodeController(CONFIG);
    const b = new DecodeController(CONFIG);
    runLocked(a, 2.5, 'Locked', 1, 0.1);
    runLocked(b, 2.5, 'Locked', 1, 0.05);
    expect(a.decodeProgress).toBeCloseTo(b.decodeProgress, 5);
    expect(a.decodeProgress).toBeCloseTo(0.5, 2);
  });

  it('delta clamp: a huge dt spike behaves like a single MAX_DECODE_DT_SECONDS tick', () => {
    const controller = new DecodeController(CONFIG);
    controller.update(1000, 'Locked', 1);
    expect(controller.decodeProgress).toBeCloseTo(MAX_DECODE_DT_SECONDS / CONFIG.decodeSeconds, 5);
  });
});

describe('DecodeController — pause (moderate degradation)', () => {
  it('pauses without resetting progress when holdQuality dips below full while still Locked', () => {
    const { controller, events } = withEvents();
    controller.update(0.1, 'Locked', 1);
    const before = controller.decodeProgress;
    controller.update(0.1, 'Locked', 0.5); // still Locked, degraded hold
    expect(controller.decodeState).toBe('Paused');
    expect(controller.decodeProgress).toBe(before); // preserved, not reset
    expect(events.filter((e) => e.kind === 'DecodePaused')).toHaveLength(1);
  });

  it('resumes accumulating from the preserved progress once holdQuality returns to full', () => {
    const controller = new DecodeController(CONFIG);
    controller.update(0.1, 'Locked', 1);
    const before = controller.decodeProgress;
    controller.update(0.1, 'Locked', 0.5);
    controller.update(0.1, 'Locked', 1);
    expect(controller.decodeState).toBe('InProgress');
    expect(controller.decodeProgress).toBeGreaterThan(before);
  });
});

describe('DecodeController — full signal loss', () => {
  it('resets progress to 0 and returns to Idle when the lock state leaves Locked entirely', () => {
    const controller = new DecodeController(CONFIG);
    controller.update(0.1, 'Locked', 1);
    expect(controller.decodeProgress).toBeGreaterThan(0);
    controller.update(0.1, 'Lost', 0);
    expect(controller.decodeProgress).toBe(0);
    expect(controller.decodeState).toBe('Idle');
  });

  it('a subsequent Locked tick starts a fresh DecodeStarted (not treated as a resume)', () => {
    const { controller, events } = withEvents();
    controller.update(0.1, 'Locked', 1);
    controller.update(0.1, 'Lost', 0);
    controller.update(0.1, 'Locked', 1);
    expect(events.filter((e) => e.kind === 'DecodeStarted')).toHaveLength(2);
  });
});

describe('DecodeController — completion', () => {
  it('completes at progress 1, firing DecodeCompleted exactly once', () => {
    const { controller, events } = withEvents();
    runLocked(controller, CONFIG.decodeSeconds + 1, 'Locked', 1);
    expect(controller.decodeState).toBe('Completed');
    expect(controller.decodeProgress).toBe(1);
    expect(events.filter((e) => e.kind === 'DecodeCompleted')).toHaveLength(1);
  });

  it('is one-shot: further update() calls are no-ops after completion', () => {
    const { controller, events } = withEvents();
    runLocked(controller, CONFIG.decodeSeconds + 1, 'Locked', 1);
    controller.update(0.1, 'Lost', 0); // would normally reset — must not, once completed
    controller.update(0.1, 'Locked', 1);
    expect(controller.decodeState).toBe('Completed');
    expect(controller.decodeProgress).toBe(1);
    expect(events.filter((e) => e.kind === 'DecodeCompleted')).toHaveLength(1);
  });
});

describe('DecodeController — full reset', () => {
  it('reset() clears progress/state and allows decoding to begin again', () => {
    const controller = new DecodeController(CONFIG);
    runLocked(controller, CONFIG.decodeSeconds + 1, 'Locked', 1);
    expect(controller.isCompleted).toBe(true);
    controller.reset();
    expect(controller.decodeState).toBe('Idle');
    expect(controller.decodeProgress).toBe(0);
    controller.update(0.1, 'Locked', 1);
    expect(controller.decodeState).toBe('InProgress');
  });
});

describe('DecodeController — DecodeProgressed throttling', () => {
  it('emits DecodeProgressed at bounded 10%-decile increments, not every single tick', () => {
    const { controller, events } = withEvents();
    runLocked(controller, CONFIG.decodeSeconds, 'Locked', 1, 0.1); // 50 ticks, 5s total
    const progressed = events.filter((e) => e.kind === 'DecodeProgressed');
    expect(progressed.length).toBeLessThanOrEqual(10);
    expect(progressed.length).toBeGreaterThan(0);
  });
});
