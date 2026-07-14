import type { Disposable } from '../../app/lifecycle/Disposable';
import { DisposableBag } from '../../app/lifecycle/Disposable';

export type PointerLockListener = (locked: boolean) => void;

/**
 * Owns pointer-lock acquisition for the movement scenes.
 *
 * Shows a minimal development prompt overlay; clicking the canvas (or
 * activating the prompt with Enter/Space — the prompt is keyboard-focusable)
 * requests pointer lock. Escape releases it through native browser
 * behavior; we only observe `pointerlockchange`. Errors (denied requests,
 * transient browser refusals) are swallowed into the unlocked state instead
 * of crashing.
 *
 * Never requests lock automatically — a user gesture is always required.
 */
export class PointerLockController implements Disposable {
  private readonly canvas: HTMLCanvasElement;
  private readonly listeners = new DisposableBag();
  private readonly changeListeners = new Set<PointerLockListener>();
  private prompt: HTMLElement | null = null;
  private locked = false;

  constructor(canvas: HTMLCanvasElement, promptParent: HTMLElement) {
    this.canvas = canvas;
    this.buildPrompt(promptParent);

    const requestLock = (): void => {
      if (!this.locked) {
        // requestPointerLock may return a promise (newer engines) or void;
        // failures surface via pointerlockerror, which we also handle.
        try {
          const result = this.canvas.requestPointerLock() as unknown;
          if (result instanceof Promise) {
            result.catch(() => {
              // Denied (e.g. too soon after Escape); stay unlocked.
            });
          }
        } catch {
          // Some browsers throw synchronously when unavailable; stay unlocked.
        }
      }
    };

    this.on(this.canvas, 'click', requestLock);
    if (this.prompt !== null) {
      this.on(this.prompt, 'click', requestLock);
      this.on(this.prompt, 'keydown', (event: KeyboardEvent) => {
        if (event.code === 'Enter' || event.code === 'Space') {
          event.preventDefault();
          requestLock();
        }
      });
    }

    this.on(document, 'pointerlockchange', () => {
      this.setLocked(document.pointerLockElement === this.canvas);
    });
    this.on(document, 'pointerlockerror', () => {
      this.setLocked(false);
    });
  }

  get isLocked(): boolean {
    return this.locked;
  }

  onChange(listener: PointerLockListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  dispose(): void {
    this.listeners.dispose();
    this.changeListeners.clear();
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
    this.prompt?.remove();
    this.prompt = null;
  }

  private setLocked(locked: boolean): void {
    if (this.locked === locked) {
      return;
    }
    this.locked = locked;
    if (this.prompt !== null) {
      this.prompt.hidden = locked;
    }
    for (const listener of this.changeListeners) {
      listener(locked);
    }
  }

  private buildPrompt(parent: HTMLElement): void {
    const prompt = document.createElement('div');
    prompt.id = 'pointer-lock-prompt';
    prompt.setAttribute('role', 'button');
    prompt.tabIndex = 0;
    prompt.setAttribute(
      'aria-label',
      'Enter movement test. Activating captures the mouse pointer; press Escape to release it.',
    );
    const label = document.createElement('span');
    label.textContent = 'Click to enter movement test';
    const hint = document.createElement('span');
    hint.className = 'pointer-lock-hint';
    hint.textContent = 'Esc releases the mouse · WASD move · Shift sprint · C crouch · Space jump';
    prompt.append(label, hint);
    parent.append(prompt);
    this.prompt = prompt;
  }

  private on<K extends keyof DocumentEventMap>(
    target: EventTarget,
    type: K,
    handler: (event: DocumentEventMap[K]) => void,
  ): void {
    const listener = handler as EventListener;
    target.addEventListener(type, listener);
    this.listeners.add(() => target.removeEventListener(type, listener));
  }
}
