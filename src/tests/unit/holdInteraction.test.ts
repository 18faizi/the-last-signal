import { describe, expect, it } from 'vitest';
import {
  IDLE_HOLD,
  updateHold,
  type HoldConditions,
  type HoldState,
} from '../../game/interaction/HoldInteraction';

const DURATION = 1.5;

function conditions(overrides: Partial<HoldConditions> = {}): HoldConditions {
  return { held: true, eligibleTargetId: 'breaker', holdDurationSeconds: DURATION, ...overrides };
}

function run(state: HoldState, dt: number, c: HoldConditions) {
  return updateHold(state, dt, c);
}

describe('hold interaction', () => {
  it('starts and accumulates progress while held on an eligible target', () => {
    const first = run(IDLE_HOLD, 0.1, conditions());
    expect(first.event).toBe('started');
    expect(first.state.progress).toBeCloseTo(0.1 / DURATION);
    const second = run(first.state, 0.2, conditions());
    expect(second.event).toBe('progressing');
    expect(second.state.progress).toBeCloseTo(0.3 / DURATION);
  });

  it('cancels when the key is released early', () => {
    const mid = run(IDLE_HOLD, 0.5, conditions());
    const cancelled = run(mid.state, 0.016, conditions({ held: false }));
    expect(cancelled.event).toBe('cancelled');
    expect(cancelled.state.progress).toBe(0);
  });

  it('cancels when focus is lost', () => {
    const mid = run(IDLE_HOLD, 0.5, conditions());
    const cancelled = run(mid.state, 0.016, conditions({ eligibleTargetId: null }));
    expect(cancelled.event).toBe('cancelled');
  });

  it('cancels when focus moves to a different target', () => {
    const mid = run(IDLE_HOLD, 0.5, conditions());
    const cancelled = run(mid.state, 0.016, conditions({ eligibleTargetId: 'other' }));
    expect(cancelled.event).toBe('cancelled');
  });

  it('completes exactly once and latches until release', () => {
    let state = IDLE_HOLD;
    let completions = 0;
    for (let i = 0; i < 30; i += 1) {
      const update = run(state, 0.1, conditions());
      state = update.state;
      if (update.event === 'completed') {
        completions += 1;
      }
    }
    expect(completions).toBe(1);
    expect(state.awaitingRelease).toBe(true);
  });

  it('requires a fresh press after completion for another attempt', () => {
    let state = IDLE_HOLD;
    for (let i = 0; i < 20; i += 1) {
      state = run(state, 0.1, conditions()).state;
    }
    expect(state.awaitingRelease).toBe(true);
    // Release clears the latch...
    const released = run(state, 0.016, conditions({ held: false }));
    expect(released.state).toEqual(IDLE_HOLD);
    // ...and a new press starts from zero.
    const restarted = run(released.state, 0.1, conditions());
    expect(restarted.event).toBe('started');
    expect(restarted.state.progress).toBeCloseTo(0.1 / DURATION);
  });

  it('does not start when nothing eligible is focused', () => {
    const update = run(IDLE_HOLD, 0.1, conditions({ eligibleTargetId: null }));
    expect(update.event).toBe('none');
    expect(update.state.progress).toBe(0);
  });
});
