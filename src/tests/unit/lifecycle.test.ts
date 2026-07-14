import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  canTransition,
  type LifecycleState,
} from '../../app/lifecycle/LifecycleState';

describe('lifecycle transitions', () => {
  it('allows the normal startup path', () => {
    const path: LifecycleState[] = ['created', 'initializing', 'ready', 'running'];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canTransition(path[i] as LifecycleState, path[i + 1] as LifecycleState)).toBe(true);
    }
  });

  it('allows a clean shutdown from running', () => {
    expect(canTransition('running', 'stopping')).toBe(true);
    expect(canTransition('stopping', 'stopped')).toBe(true);
  });

  it('allows failure from any active state', () => {
    for (const state of ['created', 'initializing', 'ready', 'running'] as const) {
      expect(canTransition(state, 'failed')).toBe(true);
    }
  });

  it('rejects double initialization', () => {
    expect(canTransition('running', 'initializing')).toBe(false);
    expect(canTransition('ready', 'initializing')).toBe(false);
  });

  it('rejects leaving stopped', () => {
    for (const target of [
      'created',
      'initializing',
      'ready',
      'running',
      'stopping',
      'failed',
    ] as const) {
      expect(canTransition('stopped', target)).toBe(false);
    }
  });

  it('allows stopping after failure so cleanup stays safe', () => {
    expect(canTransition('failed', 'stopping')).toBe(true);
  });

  it('assertTransition throws with a descriptive message', () => {
    expect(() => assertTransition('stopped', 'running')).toThrow(
      'Illegal lifecycle transition: stopped -> running',
    );
  });
});
