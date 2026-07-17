import { describe, expect, it } from 'vitest';
import { SignalLockController, MAX_LOCK_DT_SECONDS } from '../../game/signal/SignalLockController';
import { asSignalId } from '../../game/signal/SignalId';
import type { SignalEvent } from '../../game/signal/SignalEvent';

const CONFIG = { signalId: asSignalId('sig-1'), minLockQuality: 0.85, lockAcquisitionSeconds: 2 };

function withEvents(): { controller: SignalLockController; events: SignalEvent[] } {
  const controller = new SignalLockController(CONFIG);
  const events: SignalEvent[] = [];
  controller.subscribe((e) => events.push(e));
  return { controller, events };
}

/**
 * Ticks the controller in real, per-frame-sized steps (≤ MAX_LOCK_DT_SECONDS)
 * for a total of `seconds` — update()'s internal dt clamp means a single
 * call with a large dt does NOT accumulate proportionally (matching
 * PlayerConfig's own dt-clamp precedent: a lag spike is capped, not
 * compensated with substeps), so tests simulate N/step real ticks exactly
 * like a real render loop would.
 */
function run(controller: SignalLockController, seconds: number, quality: number, step = 0.1): void {
  const ticks = Math.round(seconds / step);
  for (let i = 0; i < ticks; i++) {
    controller.update(step, quality);
  }
}

describe('SignalLockController — below threshold', () => {
  it('stays Searching with zero quality', () => {
    const { controller } = withEvents();
    controller.update(0.1, 0);
    expect(controller.lockState).toBe('Searching');
    expect(controller.acquisitionProgress).toBe(0);
  });
});

describe('SignalLockController — candidate', () => {
  it('moves to Candidate once quality crosses the candidate threshold (0.5x minLockQuality)', () => {
    const { controller, events } = withEvents();
    controller.update(0.1, CONFIG.minLockQuality * 0.6);
    expect(controller.lockState).toBe('Candidate');
    expect(events.some((e) => e.kind === 'ChannelActivityDetected')).toBe(true);
  });

  it('drops back to Searching if quality falls below the candidate threshold', () => {
    const { controller } = withEvents();
    controller.update(0.1, CONFIG.minLockQuality * 0.6);
    expect(controller.lockState).toBe('Candidate');
    controller.update(0.1, 0);
    expect(controller.lockState).toBe('Searching');
  });
});

describe('SignalLockController — accumulation', () => {
  it('accumulates acquisitionProgress toward 1 over lockAcquisitionSeconds at full quality', () => {
    const controller = new SignalLockController(CONFIG);
    run(controller, 1, 1); // 1s of 2s
    expect(controller.lockState).toBe('Acquiring');
    expect(controller.acquisitionProgress).toBeCloseTo(0.5, 2);
  });

  it('reaches Locked once acquisitionProgress fills, firing LockAcquired exactly once', () => {
    const { controller, events } = withEvents();
    run(controller, CONFIG.lockAcquisitionSeconds + 0.5, 1);
    expect(controller.lockState).toBe('Locked');
    expect(events.filter((e) => e.kind === 'LockAcquired')).toHaveLength(1);
  });

  it('frame-rate independence: many small ticks equal one big-step run for the same total time*quality', () => {
    const a = new SignalLockController(CONFIG);
    const b = new SignalLockController(CONFIG);
    run(a, 1, 1, 0.05);
    run(b, 1, 1, 0.1);
    expect(a.acquisitionProgress).toBeCloseTo(b.acquisitionProgress, 5);
  });

  it('delta clamp: a huge dt spike behaves like a single MAX_LOCK_DT_SECONDS tick, not an instant fill', () => {
    const controller = new SignalLockController(CONFIG);
    controller.update(1000, 1);
    expect(controller.acquisitionProgress).toBeCloseTo(
      MAX_LOCK_DT_SECONDS / CONFIG.lockAcquisitionSeconds,
      5,
    );
    expect(controller.lockState).toBe('Acquiring');
  });
});

describe('SignalLockController — decay', () => {
  it('gradually decays acquisitionProgress in the moderate zone (candidate ≤ quality < threshold)', () => {
    const controller = new SignalLockController(CONFIG);
    run(controller, 1, 1); // progress 0.5
    const before = controller.acquisitionProgress;
    controller.update(0.1, CONFIG.minLockQuality * 0.6); // moderate dip
    expect(controller.lockState).toBe('Acquiring');
    expect(controller.acquisitionProgress).toBeLessThan(before);
    expect(controller.acquisitionProgress).toBeGreaterThan(0);
  });

  it('fast-resets to Searching when quality drops far below the candidate threshold', () => {
    const controller = new SignalLockController(CONFIG);
    run(controller, 1, 1); // progress 0.5, Acquiring
    controller.update(0.1, 0);
    expect(controller.lockState).toBe('Searching');
    expect(controller.acquisitionProgress).toBe(0);
  });
});

describe('SignalLockController — loss', () => {
  it('holds Locked through a brief moderate dip, draining holdQuality gradually', () => {
    const { controller } = withEvents();
    run(controller, CONFIG.lockAcquisitionSeconds + 0.5, 1);
    expect(controller.lockState).toBe('Locked');
    controller.update(0.05, CONFIG.minLockQuality * 0.6);
    expect(controller.lockState).toBe('Locked');
    expect(controller.holdQuality).toBeLessThan(1);
  });

  it('transitions to Lost exactly once when holdQuality is exhausted, firing LockLost once', () => {
    const { controller, events } = withEvents();
    run(controller, CONFIG.lockAcquisitionSeconds + 0.5, 1);
    expect(controller.lockState).toBe('Locked');
    // Drain hold quality with repeated moderate-dip ticks (HOLD_DECAY_PER_SECOND
    // is 0.5/s, so fully draining from 1 takes 2s = 20 ticks of 0.1s). Lost is
    // transient (resolves the very next tick — see the class doc comment), so
    // stop ticking the instant it's observed rather than overshooting past it.
    let reachedLost = false;
    for (let i = 0; i < 25 && !reachedLost; i++) {
      controller.update(0.1, CONFIG.minLockQuality * 0.6);
      reachedLost = controller.lockState === 'Lost';
    }
    expect(controller.lockState).toBe('Lost');
    expect(events.filter((e) => e.kind === 'LockLost')).toHaveLength(1);
  });

  it('a full loss (quality far below threshold while Locked) drops straight to Lost', () => {
    const { controller, events } = withEvents();
    run(controller, CONFIG.lockAcquisitionSeconds + 0.5, 1);
    expect(controller.lockState).toBe('Locked');
    controller.update(0.1, 0);
    expect(controller.lockState).toBe('Lost');
    expect(events.filter((e) => e.kind === 'LockLost')).toHaveLength(1);
  });

  it('Lost resolves on the very next tick back into Searching/Candidate/Acquiring', () => {
    const controller = new SignalLockController(CONFIG);
    run(controller, CONFIG.lockAcquisitionSeconds + 0.5, 1);
    controller.update(0.1, 0); // -> Lost
    expect(controller.lockState).toBe('Lost');
    controller.update(0.1, 0); // resolves
    expect(controller.lockState).toBe('Searching');
  });
});

describe('SignalLockController — single acquisition event discipline', () => {
  it('does not re-fire LockAcquired on subsequent ticks while remaining Locked', () => {
    const { controller, events } = withEvents();
    run(controller, CONFIG.lockAcquisitionSeconds + 0.5, 1);
    for (let i = 0; i < 20; i++) controller.update(0.1, 1);
    expect(events.filter((e) => e.kind === 'LockAcquired')).toHaveLength(1);
  });
});

describe('SignalLockController — reset', () => {
  it('reset() returns to Searching with zero progress/hold', () => {
    const controller = new SignalLockController(CONFIG);
    run(controller, CONFIG.lockAcquisitionSeconds + 0.5, 1);
    controller.reset();
    expect(controller.lockState).toBe('Searching');
    expect(controller.acquisitionProgress).toBe(0);
    expect(controller.holdQuality).toBe(0);
  });
});
