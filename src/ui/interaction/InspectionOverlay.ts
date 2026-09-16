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
  private readonly clueBanner: HTMLElement;
  private readonly buttonContainer: HTMLElement;
  private readonly takeButton: HTMLButtonElement;
  private readonly flipButton: HTMLButtonElement;
  private readonly highlightButton: HTMLButtonElement;
  private readonly hints: HTMLElement;

  private takeCallback: (() => void) | null = null;
  private flipCallback: (() => void) | null = null;
  private highlightCallback: (() => void) | null = null;

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

    this.clueBanner = document.createElement('div');
    this.clueBanner.className = 'inspection-clue-banner';
    Object.assign(this.clueBanner.style, {
      margin: '12px auto',
      padding: '8px 16px',
      background: 'rgba(25, 45, 75, 0.85)',
      border: '1px solid #64b5f6',
      borderRadius: '4px',
      color: '#90caf9',
      fontWeight: '600',
      fontSize: '13px',
      letterSpacing: '1px',
      textTransform: 'uppercase',
      boxShadow: '0 0 12px rgba(100, 181, 246, 0.4)',
      display: 'none',
      width: 'fit-content',
    });

    this.buttonContainer = document.createElement('div');
    this.buttonContainer.className = 'inspection-buttons';
    Object.assign(this.buttonContainer.style, {
      display: 'flex',
      gap: '8px',
      justifyContent: 'center',
      margin: '12px 0',
    });

    this.takeButton = document.createElement('button');
    this.takeButton.className = 'inspection-take-btn';
    this.takeButton.type = 'button';
    this.takeButton.textContent = 'TAKE ITEM [E]';
    this.takeButton.hidden = true;
    this.takeButton.addEventListener('click', () => {
      this.takeCallback?.();
    });

    this.flipButton = document.createElement('button');
    this.flipButton.className = 'inspection-action-btn';
    this.flipButton.type = 'button';
    this.flipButton.textContent = 'FLIP [F]';
    Object.assign(this.flipButton.style, {
      padding: '8px 16px',
      background: 'rgba(20, 30, 45, 0.9)',
      border: '1px solid rgba(100, 181, 246, 0.4)',
      color: '#e2ebf5',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '600',
      letterSpacing: '0.5px',
    });
    this.flipButton.addEventListener('click', () => {
      this.flipCallback?.();
    });

    this.highlightButton = document.createElement('button');
    this.highlightButton.className = 'inspection-action-btn';
    this.highlightButton.type = 'button';
    this.highlightButton.textContent = 'INSPECT CLUE [H]';
    Object.assign(this.highlightButton.style, {
      padding: '8px 16px',
      background: 'rgba(20, 30, 45, 0.9)',
      border: '1px solid rgba(100, 181, 246, 0.4)',
      color: '#e2ebf5',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '600',
      letterSpacing: '0.5px',
    });
    this.highlightButton.addEventListener('click', () => {
      this.highlightCallback?.();
    });

    this.buttonContainer.append(this.takeButton, this.flipButton, this.highlightButton);

    this.hints = document.createElement('p');
    this.hints.className = 'inspection-hints';
    this.hints.textContent =
      'Move mouse to rotate · Wheel to zoom · F to flip · H to highlight · R to reset · Esc to close';

    this.root.append(
      this.title,
      this.description,
      this.clueBanner,
      this.buttonContainer,
      this.hints,
    );
    parent.append(this.root);
  }

  show(title: string, description?: string): void {
    this.title.textContent = title;
    this.description.textContent = description ?? '';
    this.description.hidden = description === undefined;
    this.clueBanner.style.display = 'none';
    this.root.hidden = false;
  }

  setFlipCallback(callback: (() => void) | null): void {
    this.flipCallback = callback;
  }

  setHighlightCallback(callback: (() => void) | null): void {
    this.highlightCallback = callback;
  }

  showClueBanner(title: string): void {
    this.clueBanner.textContent = `★ Clue Discovered: ${title}`;
    this.clueBanner.style.display = 'block';
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
    this.flipCallback = null;
    this.highlightCallback = null;
    this.clueBanner.style.display = 'none';
  }

  dispose(): void {
    this.root.remove();
  }
}
