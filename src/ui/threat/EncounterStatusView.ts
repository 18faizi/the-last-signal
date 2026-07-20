/**
 * Encounter status view (Milestone 0.9): the failure fade + reset message
 * and the completion banner. One fixed full-screen layer whose opacity is
 * CSS-transitioned — no per-frame JS animation, change-only DOM writes.
 *
 * No death screens, no lives: failure is a brief fade with a dev-facing
 * "ENCOUNTER RESET" message, then gameplay resumes at the encounter
 * checkpoint.
 */
export class EncounterStatusView {
  private readonly fadeLayer: HTMLElement;
  private readonly message: HTMLElement;
  private readonly banner: HTMLElement;
  private fadeTimer: number | null = null;
  private bannerTimer: number | null = null;

  constructor(parent: HTMLElement) {
    this.fadeLayer = document.createElement('div');
    this.fadeLayer.id = 'encounter-fade';
    Object.assign(this.fadeLayer.style, {
      position: 'fixed',
      inset: '0',
      background: '#000',
      opacity: '0',
      pointerEvents: 'none',
      transition: 'opacity 350ms ease',
      zIndex: '9200',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
    this.message = document.createElement('div');
    this.message.id = 'encounter-reset-message';
    Object.assign(this.message.style, {
      fontFamily: 'monospace',
      fontSize: '18px',
      letterSpacing: '4px',
      color: '#cfe0f0',
      opacity: '0',
      transition: 'opacity 250ms ease',
    });
    this.fadeLayer.append(this.message);
    parent.append(this.fadeLayer);

    this.banner = document.createElement('div');
    this.banner.id = 'encounter-complete-banner';
    this.banner.setAttribute('role', 'status');
    this.banner.hidden = true;
    Object.assign(this.banner.style, {
      position: 'fixed',
      top: '30%',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '14px 28px',
      background: 'rgba(8, 12, 10, 0.9)',
      border: '1px solid #4a6a4a',
      borderRadius: '4px',
      fontFamily: 'monospace',
      fontSize: '16px',
      letterSpacing: '3px',
      color: '#9fd0a0',
      zIndex: '9150',
      pointerEvents: 'none',
    });
    parent.append(this.banner);
  }

  /**
   * Failure sequence: fade to black, show the message, then run `midpoint`
   * (teleport + state reset happen while the screen is dark), fade back.
   */
  playEncounterReset(midpoint: () => void, messageText = 'ENCOUNTER RESET'): void {
    if (this.fadeTimer !== null) {
      window.clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    this.message.textContent = messageText;
    this.fadeLayer.style.opacity = '1';
    this.message.style.opacity = '1';
    this.fadeTimer = window.setTimeout(() => {
      try {
        midpoint();
      } finally {
        this.fadeTimer = window.setTimeout(() => {
          this.fadeLayer.style.opacity = '0';
          this.message.style.opacity = '0';
          this.fadeTimer = null;
        }, 650);
      }
    }, 400);
  }

  /** Completion banner, auto-hides after a few seconds. */
  showCompletionBanner(text = 'THREAT FOUNDATION COMPLETE'): void {
    this.banner.textContent = text;
    this.banner.hidden = false;
    if (this.bannerTimer !== null) window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => {
      this.banner.hidden = true;
      this.bannerTimer = null;
    }, 6000);
  }

  hideAll(): void {
    if (this.fadeTimer !== null) {
      window.clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    if (this.bannerTimer !== null) {
      window.clearTimeout(this.bannerTimer);
      this.bannerTimer = null;
    }
    this.fadeLayer.style.opacity = '0';
    this.message.style.opacity = '0';
    this.banner.hidden = true;
  }

  dispose(): void {
    this.hideAll();
    this.fadeLayer.remove();
    this.banner.remove();
  }
}
