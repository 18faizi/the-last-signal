import { describe, expect, it } from 'vitest';
import {
  NO_FOCUS,
  selectPreferredTarget,
  updateFocus,
  type FocusState,
} from '../../game/interaction/FocusStability';
import { AVAILABLE, type InteractionTarget } from '../../game/interaction/InteractionTarget';

function target(id: string, priority?: number): InteractionTarget {
  return {
    id,
    kind: 'immediate',
    meshes: [],
    ...(priority !== undefined && { priority }),
    getPrompt: () => ({ verb: 'USE', label: id.toUpperCase() }),
    getAvailability: () => AVAILABLE,
    interact: () => ({ status: 'completed' as const }),
  };
}

const GRACE = 0.15;

describe('focus stability', () => {
  it('enters focus exactly once', () => {
    const a = target('a');
    const first = updateFocus(NO_FOCUS, a, 0.016, GRACE);
    expect(first.entered?.id).toBe('a');
    const second = updateFocus(first.state, a, 0.016, GRACE);
    expect(second.entered).toBeNull();
    expect(second.exited).toBeNull();
  });

  it('keeps focus through momentary loss within the grace period', () => {
    const a = target('a');
    let state: FocusState = updateFocus(NO_FOCUS, a, 0.016, GRACE).state;
    const blip = updateFocus(state, null, 0.05, GRACE);
    expect(blip.exited).toBeNull();
    expect(blip.state.focused?.id).toBe('a');
    // Reacquired before grace expiry: no exit/enter events fired.
    state = blip.state;
    const back = updateFocus(state, a, 0.016, GRACE);
    expect(back.entered).toBeNull();
    expect(back.state.secondsSinceSeen).toBe(0);
  });

  it('exits focus exactly once after the grace period elapses', () => {
    const a = target('a');
    let state = updateFocus(NO_FOCUS, a, 0.016, GRACE).state;
    let exits = 0;
    for (let i = 0; i < 20; i += 1) {
      const update = updateFocus(state, null, 0.05, GRACE);
      state = update.state;
      if (update.exited !== null) {
        exits += 1;
      }
    }
    expect(exits).toBe(1);
    expect(state.focused).toBeNull();
  });

  it('switches to a different target immediately (no grace delay)', () => {
    const a = target('a');
    const b = target('b');
    const first = updateFocus(NO_FOCUS, a, 0.016, GRACE).state;
    const switched = updateFocus(first, b, 0.016, GRACE);
    expect(switched.exited?.id).toBe('a');
    expect(switched.entered?.id).toBe('b');
  });
});

describe('selectPreferredTarget', () => {
  it('prefers higher explicit priority at near-equal distance', () => {
    const primary = { target: target('primary', 5), distance: 1.0 };
    const secondary = { target: target('secondary'), distance: 1.02 };
    expect(selectPreferredTarget(primary, secondary)).toBe('primary');
    expect(selectPreferredTarget(secondary, primary)).toBe('primary');
  });

  it('prefers the nearer target when distances clearly differ', () => {
    const near = { target: target('near'), distance: 0.8 };
    const far = { target: target('far', 10), distance: 2.0 };
    expect(selectPreferredTarget(near, far)).toBe('near');
  });

  it('falls back to distance when priorities tie', () => {
    const a = { target: target('a', 1), distance: 1.0 };
    const b = { target: target('b', 1), distance: 1.01 };
    expect(selectPreferredTarget(a, b)).toBe('a');
  });
});
