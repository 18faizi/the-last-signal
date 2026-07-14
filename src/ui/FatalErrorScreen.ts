import type { EnvironmentInfo } from '../config/environment';
import type { GameError } from '../core/errors/GameError';

/**
 * Full-screen unrecoverable-failure UI.
 *
 * Shows a player-friendly message always; technical detail (error chain and
 * stack) only in development builds. Never renders secrets — the detail text
 * is built exclusively from Error fields.
 */
export class FatalErrorScreen {
  private readonly root: HTMLElement;
  private readonly messageElement: HTMLElement;
  private readonly detailsElement: HTMLElement;
  private readonly copyButton: HTMLButtonElement;
  private readonly environment: EnvironmentInfo;

  constructor(
    environment: EnvironmentInfo,
    elements: {
      root: HTMLElement;
      message: HTMLElement;
      details: HTMLElement;
      reloadButton: HTMLButtonElement;
      copyButton: HTMLButtonElement;
    },
  ) {
    this.environment = environment;
    this.root = elements.root;
    this.messageElement = elements.message;
    this.detailsElement = elements.details;
    this.copyButton = elements.copyButton;

    elements.reloadButton.addEventListener('click', () => {
      window.location.reload();
    });
  }

  show(error: GameError): void {
    this.messageElement.textContent = error.userMessage;

    const details = this.formatDetails(error);
    if (this.environment.isDevelopment) {
      this.detailsElement.textContent = details;
      this.detailsElement.hidden = false;
    }

    if (typeof navigator.clipboard?.writeText === 'function') {
      this.copyButton.hidden = false;
      this.copyButton.addEventListener('click', () => {
        void navigator.clipboard.writeText(details);
      });
    }

    this.root.hidden = false;
  }

  private formatDetails(error: GameError): string {
    const lines = [`kind: ${error.kind}`, `message: ${error.message}`];
    let cause: unknown = error.cause;
    while (cause instanceof Error) {
      lines.push(`caused by: ${cause.name}: ${cause.message}`);
      cause = cause.cause;
    }
    if (error.stack !== undefined) {
      lines.push('', error.stack);
    }
    return lines.join('\n');
  }
}
