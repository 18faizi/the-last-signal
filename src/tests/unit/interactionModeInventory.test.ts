import { describe, expect, it } from 'vitest';
import { canTransitionMode, isOverlayMode } from '../../game/interaction/InteractionMode';

describe('inventory mode transitions', () => {
  it('allows gameplay -> inventory', () => {
    expect(canTransitionMode('gameplay', 'inventory')).toBe(true);
  });

  it('allows inventory -> gameplay', () => {
    expect(canTransitionMode('inventory', 'gameplay')).toBe(true);
  });

  it('rejects inventory -> holding (must go via gameplay)', () => {
    expect(canTransitionMode('inventory', 'holding')).toBe(false);
  });

  it('rejects inventory -> transitioning', () => {
    expect(canTransitionMode('inventory', 'transitioning')).toBe(false);
  });

  it('rejects holding -> inventory', () => {
    expect(canTransitionMode('holding', 'inventory')).toBe(false);
  });

  it('isOverlayMode returns true for inventory', () => {
    expect(isOverlayMode('inventory')).toBe(true);
  });

  it('isOverlayMode false for gameplay/holding', () => {
    expect(isOverlayMode('gameplay')).toBe(false);
    expect(isOverlayMode('holding')).toBe(false);
  });
});
