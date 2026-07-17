import { describe, expect, it } from 'vitest';
import { canTransitionMode, isOverlayMode } from '../../game/interaction/InteractionMode';

describe('receiver mode transitions', () => {
  it('allows gameplay -> transitioning -> receiver -> gameplay', () => {
    expect(canTransitionMode('gameplay', 'transitioning')).toBe(true);
    expect(canTransitionMode('transitioning', 'receiver')).toBe(true);
    expect(canTransitionMode('receiver', 'gameplay')).toBe(true);
  });

  it('rejects direct gameplay -> receiver (must pass transitioning)', () => {
    expect(canTransitionMode('gameplay', 'receiver')).toBe(false);
  });

  it('rejects receiver opening during inventory/reading/inspecting/power-panel', () => {
    expect(canTransitionMode('inventory', 'receiver')).toBe(false);
    expect(canTransitionMode('reading', 'receiver')).toBe(false);
    expect(canTransitionMode('inspecting', 'receiver')).toBe(false);
    expect(canTransitionMode('power-panel', 'receiver')).toBe(false);
  });

  it('rejects those modes opening during receiver', () => {
    expect(canTransitionMode('receiver', 'inventory')).toBe(false);
    expect(canTransitionMode('receiver', 'reading')).toBe(false);
    expect(canTransitionMode('receiver', 'inspecting')).toBe(false);
    expect(canTransitionMode('receiver', 'power-panel')).toBe(false);
  });

  it('rejects starting the receiver during an active hold', () => {
    expect(canTransitionMode('holding', 'receiver')).toBe(false);
  });

  it('isOverlayMode returns true for receiver', () => {
    expect(isOverlayMode('receiver')).toBe(true);
  });
});
