/**
 * Compact queued item-added notification toast (z-index 17).
 *
 * Shows one notification at a time; queues any that arrive while one is
 * displayed. Each notification auto-dismisses after DISPLAY_MS milliseconds.
 * Purely DOM-based; no Babylon objects.
 */
import type { Disposable } from '../../app/lifecycle/Disposable';

const DISPLAY_MS = 2500;
const FADE_MS = 300;

export class InventoryNotificationView implements Disposable {
  private readonly root: HTMLElement;
  private readonly text: HTMLElement;

  private queue: string[] = [];
  private showing = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'inventory-notification';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    this.root.setAttribute('aria-atomic', 'true');
    this.root.hidden = true;

    const icon = document.createElement('span');
    icon.className = 'inv-notif-icon';
    icon.textContent = '+';
    icon.setAttribute('aria-hidden', 'true');

    this.text = document.createElement('span');
    this.text.className = 'inv-notif-text';

    this.root.append(icon, this.text);
    parent.append(this.root);
  }

  /** Show a pickup notification for the given item display name. */
  notify(displayName: string): void {
    this.queue.push(displayName);
    if (!this.showing) {
      this.showNext();
    }
  }

  dispose(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.root.remove();
  }

  private showNext(): void {
    const name = this.queue.shift();
    if (name === undefined) {
      this.showing = false;
      return;
    }
    this.showing = true;
    this.text.textContent = `${name} added to inventory`;
    this.root.hidden = false;
    this.root.classList.remove('inv-notif-fade');

    this.timer = setTimeout(() => {
      this.root.classList.add('inv-notif-fade');
      this.timer = setTimeout(() => {
        this.root.hidden = true;
        this.showNext();
      }, FADE_MS);
    }, DISPLAY_MS);
  }
}
