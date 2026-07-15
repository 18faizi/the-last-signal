import { describe, expect, it } from 'vitest';
import {
  assertModeTransition,
  canTransitionMode,
  isOverlayMode,
  type InteractionMode,
} from '../../game/interaction/InteractionMode';

describe('interaction mode transitions', () => {
  it('allows gameplay -> holding -> gameplay', () => {
    expect(canTransitionMode('gameplay', 'holding')).toBe(true);
    expect(canTransitionMode('holding', 'gameplay')).toBe(true);
  });

  it('allows gameplay -> transitioning -> inspecting -> gameplay', () => {
    expect(canTransitionMode('gameplay', 'transitioning')).toBe(true);
    expect(canTransitionMode('transitioning', 'inspecting')).toBe(true);
    expect(canTransitionMode('inspecting', 'gameplay')).toBe(true);
  });

  it('allows transitioning to fall back to gameplay on failed setup', () => {
    expect(canTransitionMode('transitioning', 'gameplay')).toBe(true);
  });

  it('rejects reading while inspecting and vice versa', () => {
    expect(canTransitionMode('inspecting', 'reading')).toBe(false);
    expect(canTransitionMode('reading', 'inspecting')).toBe(false);
  });

  it('rejects starting an overlay during an active hold', () => {
    expect(canTransitionMode('holding', 'transitioning')).toBe(false);
    expect(canTransitionMode('holding', 'inspecting')).toBe(false);
    expect(canTransitionMode('holding', 'reading')).toBe(false);
  });

  it('rejects direct gameplay -> inspecting/reading (must pass transitioning)', () => {
    expect(canTransitionMode('gameplay', 'inspecting')).toBe(false);
    expect(canTransitionMode('gameplay', 'reading')).toBe(false);
  });

  it('assertModeTransition throws with a descriptive message', () => {
    expect(() => assertModeTransition('inspecting', 'reading')).toThrow(
      'Illegal interaction-mode transition: inspecting -> reading',
    );
  });

  it('classifies overlay modes', () => {
    const overlay: InteractionMode[] = ['inspecting', 'reading', 'transitioning'];
    for (const mode of overlay) {
      expect(isOverlayMode(mode)).toBe(true);
    }
    expect(isOverlayMode('gameplay')).toBe(false);
    expect(isOverlayMode('holding')).toBe(false);
  });
});
