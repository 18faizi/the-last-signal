/**
 * Milestone 1.0 — Game Start Overlay.
 *
 * Atmospheric introductory screen setting tone, location, and initial narrative context.
 * Captures user pointer interaction to initialize audio/pointer lock and start Chapter 1.
 */

export interface GameStartOverlayCallbacks {
  readonly onStart: () => void;
}

export class GameStartOverlay {
  private readonly root: HTMLElement;
  private clickHandler?: () => void;
  private keydownHandler?: (e: KeyboardEvent) => void;

  constructor(
    parent: HTMLElement,
    private readonly callbacks: GameStartOverlayCallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'game-start-overlay';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Game Start Screen');
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      background: 'radial-gradient(ellipse at center, #0c1520 0%, #05080c 100%)',
      color: '#e2ebf5',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: '9980',
      userSelect: 'none',
      cursor: 'pointer',
      padding: '32px',
      transition: 'opacity 0.6s ease',
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '540px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px',
    });

    card.innerHTML = `
      <div style="font-size: 12px; letter-spacing: 3px; color: #64b5f6; font-weight: 600; text-transform: uppercase;">
        STATION ECHO // MOUNTAIN SECTOR
      </div>

      <div style="font-size: 34px; font-weight: 800; letter-spacing: 1px; color: #ffffff; line-height: 1.1;">
        THE LAST SIGNAL
      </div>

      <div style="width: 48px; height: 2px; background: #64b5f6; margin: 4px 0;"></div>

      <div style="font-size: 14px; line-height: 1.6; color: #a4b8cc; font-weight: 300;">
        November 14, 1982. Complete silence fell across the high-altitude listening post.
        You have arrived at the perimeter to investigate the facility and determine the fate of the carrier broadcast.
      </div>

      <div style="
        margin-top: 16px; padding: 12px 28px; background: rgba(30, 50, 75, 0.6);
        border: 1px solid rgba(100, 181, 246, 0.4); border-radius: 4px; font-size: 13px;
        letter-spacing: 1.5px; color: #90caf9; font-weight: 600;
        animation: pulseStartPrompt 2s infinite ease-in-out;
      ">
        CLICK ANYWHERE OR PRESS SPACE TO BEGIN
      </div>
    `;

    // Inject pulse animation keyframes if not present
    if (!document.getElementById('start-overlay-style')) {
      const style = document.createElement('style');
      style.id = 'start-overlay-style';
      style.textContent = `
        @keyframes pulseStartPrompt {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1.0; transform: scale(1.02); }
        }
      `;
      document.head.appendChild(style);
    }

    this.root.appendChild(card);
    parent.appendChild(this.root);

    this.setupListeners();
  }

  private setupListeners(): void {
    const triggerStart = () => {
      this.root.style.opacity = '0';
      this.root.style.pointerEvents = 'none';
      window.setTimeout(() => {
        this.callbacks.onStart();
        this.dispose();
      }, 500);
    };

    this.clickHandler = () => triggerStart();
    this.root.addEventListener('click', this.clickHandler);

    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        triggerStart();
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  public dispose(): void {
    if (this.clickHandler) {
      this.root.removeEventListener('click', this.clickHandler);
    }
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
    }
    this.root.remove();
  }
}
