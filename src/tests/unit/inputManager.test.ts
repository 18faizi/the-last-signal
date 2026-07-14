import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InputAction } from '../../core/input/InputAction';
import { InputManager } from '../../core/input/InputManager';

describe('InputManager', () => {
  let target: HTMLElement;
  let manager: InputManager;

  beforeEach(() => {
    target = document.createElement('div');
    document.body.append(target);
    manager = new InputManager(target);
  });

  afterEach(() => {
    manager.dispose();
    target.remove();
  });

  function pressKey(code: string, repeat = false): void {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, repeat }));
  }

  function releaseKey(code: string): void {
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  }

  it('tracks key press and release', () => {
    pressKey('KeyW');
    expect(manager.isKeyPressed('KeyW')).toBe(true);
    releaseKey('KeyW');
    expect(manager.isKeyPressed('KeyW')).toBe(false);
  });

  it('resets all pressed state on window blur', () => {
    pressKey('KeyW');
    pressKey('KeyA');
    window.dispatchEvent(new Event('blur'));
    expect(manager.isKeyPressed('KeyW')).toBe(false);
    expect(manager.isKeyPressed('KeyA')).toBe(false);
    expect(manager.getSnapshot().windowFocused).toBe(false);
  });

  it('restores focus flag on window focus', () => {
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
    expect(manager.getSnapshot().windowFocused).toBe(true);
  });

  it('produces immutable snapshots that do not track later input', () => {
    pressKey('KeyW');
    const snapshot = manager.getSnapshot();
    pressKey('KeyS');
    expect(snapshot.pressedKeys.has('KeyW')).toBe(true);
    expect(snapshot.pressedKeys.has('KeyS')).toBe(false);
  });

  it('accumulates wheel delta and resets it after a snapshot', () => {
    target.dispatchEvent(new WheelEvent('wheel', { deltaY: 60 }));
    target.dispatchEvent(new WheelEvent('wheel', { deltaY: 40 }));
    expect(manager.getSnapshot().wheelDelta).toBe(100);
    expect(manager.getSnapshot().wheelDelta).toBe(0);
  });

  it('fires action listeners for bound keys without auto-repeat', () => {
    const listener = vi.fn();
    manager.onAction(listener);

    pressKey('Backquote');
    pressKey('Backquote', true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(InputAction.ToggleDebugOverlay);
  });

  it('stops reporting input after dispose', () => {
    manager.dispose();
    pressKey('KeyW');
    expect(manager.isKeyPressed('KeyW')).toBe(false);
  });
});
