import type { Disposable } from '../../app/lifecycle/Disposable';

/**
 * Minimal DOM frame for object inspection: dimmed backdrop (the 3D object
 * renders on the canvas beneath), object name, optional development
 * description and control hints. Reused across sessions; never duplicated.
 */
export class InspectionOverlay implements Disposable {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly description: HTMLElement;

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

    const hints = document.createElement('p');
    hints.className = 'inspection-hints';
    hints.textContent = 'Move mouse to rotate · Wheel to zoom · R to reset · Esc to close';

    this.root.append(this.title, this.description, hints);
    parent.append(this.root);
  }

  show(title: string, description?: string): void {
    this.title.textContent = title;
    this.description.textContent = description ?? '';
    this.description.hidden = description === undefined;
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  dispose(): void {
    this.root.remove();
  }
}
