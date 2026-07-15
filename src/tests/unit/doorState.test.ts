import { describe, expect, it } from 'vitest';
import { createDoorState, isDoorBlocking } from '../../game/doors/DoorState';

describe('DoorState', () => {
  it('creates door in closed/locked state by default', () => {
    const state = createDoorState();
    expect(state.physical).toBe('closed');
    expect(state.access).toBe('locked');
    expect(state.openFraction).toBe(0);
  });

  it('creates door with given initial access state', () => {
    const state = createDoorState('unlocked');
    expect(state.access).toBe('unlocked');
  });

  it('isDoorBlocking returns true for closed and blocked', () => {
    expect(isDoorBlocking(createDoorState())).toBe(true);
    const blocked = createDoorState();
    blocked.physical = 'blocked';
    expect(isDoorBlocking(blocked)).toBe(true);
  });

  it('isDoorBlocking returns false for open and moving', () => {
    const open = createDoorState('unlocked');
    open.physical = 'open';
    expect(isDoorBlocking(open)).toBe(false);

    const opening = createDoorState('unlocked');
    opening.physical = 'opening';
    expect(isDoorBlocking(opening)).toBe(false);
  });
});
