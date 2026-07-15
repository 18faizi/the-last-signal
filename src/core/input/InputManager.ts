import type { Disposable } from '../../app/lifecycle/Disposable';
import { DisposableBag } from '../../app/lifecycle/Disposable';
import {
  actionForCode,
  DEFAULT_BINDINGS,
  type InputAction,
  type InputBindings,
} from './InputAction';
import type { InputSnapshot } from './InputSnapshot';

export type ActionListener = (action: InputAction) => void;

/**
 * Centralized raw-input tracking.
 *
 * Listens to keyboard, pointer, wheel and focus events on the window and
 * target element, and exposes the result as immutable snapshots. It knows
 * nothing about Babylon, meshes or gameplay; scene logic queries snapshots
 * or subscribes to abstract actions.
 *
 * All state is cleared on window blur so keys never stick when the player
 * tabs away mid-press.
 */
export class InputManager implements Disposable {
  private readonly bindings: InputBindings;
  private readonly listeners = new DisposableBag();
  private readonly actionListeners = new Set<ActionListener>();

  private readonly pressedKeys = new Set<string>();
  private readonly pointerButtons = new Set<number>();
  private pointerX = 0;
  private pointerY = 0;
  private accumulatedDeltaX = 0;
  private accumulatedDeltaY = 0;
  private accumulatedWheel = 0;
  private focused = true;

  constructor(target: HTMLElement, bindings: InputBindings = DEFAULT_BINDINGS) {
    this.bindings = bindings;
    this.attach(target);
  }

  /** Notifies when a bound action's key is first pressed (no auto-repeat). */
  onAction(listener: ActionListener): () => void {
    this.actionListeners.add(listener);
    return () => this.actionListeners.delete(listener);
  }

  /**
   * Returns an immutable snapshot. Pointer and wheel deltas accumulate
   * between calls and reset when read, so a per-frame caller sees per-frame
   * deltas.
   */
  getSnapshot(): InputSnapshot {
    const snapshot: InputSnapshot = {
      pressedKeys: new Set(this.pressedKeys),
      pointer: {
        x: this.pointerX,
        y: this.pointerY,
        deltaX: this.accumulatedDeltaX,
        deltaY: this.accumulatedDeltaY,
        buttons: new Set(this.pointerButtons),
      },
      wheelDelta: this.accumulatedWheel,
      windowFocused: this.focused,
    };
    this.accumulatedDeltaX = 0;
    this.accumulatedDeltaY = 0;
    this.accumulatedWheel = 0;
    return snapshot;
  }

  isKeyPressed(code: string): boolean {
    return this.pressedKeys.has(code);
  }

  /** Non-consuming query for display purposes (does not reset deltas). */
  getPressedKeyCodes(): readonly string[] {
    return [...this.pressedKeys];
  }

  dispose(): void {
    this.listeners.dispose();
    this.actionListeners.clear();
    this.resetState();
  }

  private attach(target: HTMLElement): void {
    this.on(window, 'keydown', (event: KeyboardEvent) => {
      const isNewPress = !event.repeat && !this.pressedKeys.has(event.code);
      this.pressedKeys.add(event.code);
      if (isNewPress) {
        const action = actionForCode(this.bindings, event.code);
        if (action !== undefined) {
          for (const listener of this.actionListeners) {
            listener(action);
          }
        }
      }
    });
    this.on(window, 'keyup', (event: KeyboardEvent) => {
      this.pressedKeys.delete(event.code);
    });
    this.on(target, 'pointerdown', (event: PointerEvent) => {
      this.pointerButtons.add(event.button);
    });
    this.on(target, 'pointerup', (event: PointerEvent) => {
      this.pointerButtons.delete(event.button);
    });
    // Listen on window so pointer moves are captured regardless of which element
    // is under the cursor (e.g. inspection overlay sitting above the canvas).
    // With pointer lock active (gameplay) the browser dispatches raw movement
    // deltas to window as well as the lock-requesting element.
    this.on(window, 'pointermove', (event: PointerEvent) => {
      const clientDx = event.clientX - this.pointerX;
      const clientDy = event.clientY - this.pointerY;
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
      // movementX/Y are only reliable under an active pointer lock (gameplay).
      // When no lock is held (inspection, UI overlays, CI bypass mode) fall back
      // to clientX/Y position deltas so overlay mouse-drag interaction works.
      if (document.pointerLockElement !== null) {
        this.accumulatedDeltaX += event.movementX;
        this.accumulatedDeltaY += event.movementY;
      } else {
        this.accumulatedDeltaX += clientDx;
        this.accumulatedDeltaY += clientDy;
      }
    });
    // Listen on window for wheel events so they are captured regardless of
    // which element is under the cursor (e.g. inspection or document overlay).
    this.on(window, 'wheel', (event: WheelEvent) => {
      this.accumulatedWheel += event.deltaY;
    });
    this.on(window, 'focus', () => {
      this.focused = true;
    });
    this.on(window, 'blur', () => {
      this.focused = false;
      // Keyup/pointerup events are lost while unfocused; clear held state so
      // nothing stays "pressed" when focus returns.
      this.resetState();
    });
  }

  private resetState(): void {
    this.pressedKeys.clear();
    this.pointerButtons.clear();
    this.accumulatedDeltaX = 0;
    this.accumulatedDeltaY = 0;
    this.accumulatedWheel = 0;
  }

  private on<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    handler: (event: WindowEventMap[K]) => void,
  ): void;
  private on<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
  ): void;
  private on(target: Window | HTMLElement, type: string, handler: (event: never) => void): void {
    const listener = handler as EventListener;
    target.addEventListener(type, listener);
    this.listeners.add(() => target.removeEventListener(type, listener));
  }
}
