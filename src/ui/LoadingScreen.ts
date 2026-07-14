import type { Disposable } from '../app/lifecycle/Disposable';

export type LoadingStage =
  'Initializing renderer' | 'Loading physics' | 'Preparing systems' | 'Loading scene' | 'Ready';

/**
 * Controls the DOM loading screen declared in index.html. The screen covers
 * the viewport from first paint (so there is no flash of empty canvas) and
 * is hidden only after the initial scene is ready.
 */
export class LoadingScreen implements Disposable {
  private readonly root: HTMLElement;
  private readonly stageElement: HTMLElement;
  private readonly barFill: HTMLElement;

  constructor(root: HTMLElement, stageElement: HTMLElement, barFill: HTMLElement) {
    this.root = root;
    this.stageElement = stageElement;
    this.barFill = barFill;
  }

  setStage(stage: LoadingStage, progressFraction: number): void {
    this.stageElement.textContent = stage;
    const clamped = Math.min(1, Math.max(0, progressFraction));
    this.barFill.style.width = `${(clamped * 100).toFixed(0)}%`;
  }

  hide(): void {
    this.root.classList.add('loading-hidden');
    // Remove from the accessibility tree and hit-testing once faded.
    window.setTimeout(() => {
      this.root.hidden = true;
    }, 400);
  }

  dispose(): void {
    this.root.hidden = true;
  }
}
