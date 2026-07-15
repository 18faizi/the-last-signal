import type { Disposable } from '../../app/lifecycle/Disposable';
import type { PromptDisplay } from '../../game/interaction/InteractionPromptFormat';

/**
 * Lower-center contextual prompt with integrated hold-progress bar.
 *
 * DOM is built once; updates mutate text/width only when values change.
 * `pointer-events: none` (via CSS) keeps it from interfering with pointer
 * lock or canvas clicks.
 */
export class InteractionPromptView implements Disposable {
  private readonly root: HTMLElement;
  private readonly keyElement: HTMLElement;
  private readonly textElement: HTMLElement;
  private readonly progressTrack: HTMLElement;
  private readonly progressFill: HTMLElement;

  private lastKey = '';
  private lastText = '';
  private lastDisabled = false;
  private lastProgressPercent = -1;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'interaction-prompt';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    this.root.hidden = true;

    const line = document.createElement('div');
    line.className = 'interaction-prompt-line';
    this.keyElement = document.createElement('span');
    this.keyElement.className = 'interaction-prompt-key';
    this.textElement = document.createElement('span');
    this.textElement.className = 'interaction-prompt-text';
    line.append(this.keyElement, this.textElement);

    this.progressTrack = document.createElement('div');
    this.progressTrack.className = 'interaction-hold-track';
    this.progressTrack.setAttribute('role', 'progressbar');
    this.progressTrack.setAttribute('aria-label', 'Hold progress');
    this.progressTrack.hidden = true;
    this.progressFill = document.createElement('div');
    this.progressFill.className = 'interaction-hold-fill';
    this.progressTrack.append(this.progressFill);

    this.root.append(line, this.progressTrack);
    parent.append(this.root);
  }

  show(display: PromptDisplay): void {
    if (display.keyHint !== this.lastKey) {
      this.lastKey = display.keyHint;
      this.keyElement.textContent = display.keyHint;
      this.keyElement.hidden = display.keyHint === '';
    }
    if (display.text !== this.lastText) {
      this.lastText = display.text;
      this.textElement.textContent = display.text;
    }
    if (display.disabled !== this.lastDisabled) {
      this.lastDisabled = display.disabled;
      this.root.classList.toggle('interaction-prompt-disabled', display.disabled);
    }
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.setHoldProgress(null);
  }

  /** null hides the bar; 0..1 shows it filled to that fraction. */
  setHoldProgress(fraction: number | null): void {
    if (fraction === null) {
      if (!this.progressTrack.hidden) {
        this.progressTrack.hidden = true;
        this.progressFill.style.width = '0%';
        this.progressTrack.removeAttribute('aria-valuenow');
        this.lastProgressPercent = -1;
      }
      return;
    }
    this.progressTrack.hidden = false;
    const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
    if (percent !== this.lastProgressPercent) {
      this.lastProgressPercent = percent;
      this.progressFill.style.width = `${percent}%`;
      this.progressTrack.setAttribute('aria-valuenow', String(percent));
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
