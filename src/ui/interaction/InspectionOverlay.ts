import type { Disposable } from '../../app/lifecycle/Disposable';

/**
 * Minimal DOM frame for object inspection: dimmed backdrop (the 3D object
 * renders on the canvas beneath), object name, optional development
 * description, control hints, and an optional "TAKE ITEM" button for
 * inspect-before-collect pickups.
 *
 * Reused across sessions; never duplicated.
 */
export class InspectionOverlay implements Disposable {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly description: HTMLElement;
  private readonly takeButton: HTMLButtonElement;

  private takeCallback: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'inspection-overlay';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Object inspection');
    this.root.hidden = true;

    this.title = document.createElement('h2');
    this.title.className = 'inspection-title';

    this.description = document.createElement('p');
    this.description.className = 'inspection-description';

    this.takeButton = document.createElement('button');
    this.takeButton.className = 'inspection-take-btn';
    this.takeButton.type = 'button';
    this.takeButton.textContent = 'TAKE ITEM [E]';
    this.takeButton.hidden = true;
    this.takeButton.addEventListener('click', () => {
      this.takeCallback?.();
    });

    const hints = document.createElement('p');
    hints.className = 'inspection-hints';
    hints.textContent = 'Move mouse to rotate · Wheel to zoom · R to reset · Esc to close';

    this.root.append(this.title, this.description, this.takeButton, hints);
    parent.append(this.root);
  }

  show(title: string, description?: string): void {
    this.title.textContent = title;
    this.description.textContent = description ?? '';
    this.description.hidden = description === undefined;
    this.root.hidden = false;
  }

  /**
   * Reveal the "TAKE ITEM" button and register a callback for when it is
   * pressed. Pass null to hide the button again.
   */
  showTakeButton(callback: (() => void) | null): void {
    this.takeCallback = callback;
    this.takeButton.hidden = callback === null;
  }

  hide(): void {
    this.root.hidden = true;
    this.takeButton.hidden = true;
    this.takeCallback = null;
  }

  dispose(): void {
    this.root.remove();
  }
}
