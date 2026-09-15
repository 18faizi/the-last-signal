/**
 * Milestone 1.0 — Restart Controller.
 *
 * Coordinates clean start-to-finish game restart and explore-mode continuation
 * without page reloads or memory leaks.
 */

export interface RestartableSystem {
  reset: () => void;
}

export class RestartController {
  private readonly systems: RestartableSystem[] = [];
  private onRestartCallback?: () => void;

  public registerSystem(system: RestartableSystem): void {
    this.systems.push(system);
  }

  public setRestartCallback(callback: () => void): void {
    this.onRestartCallback = callback;
  }

  public restart(): void {
    for (const sys of this.systems) {
      try {
        sys.reset();
      } catch (err) {
        console.error('[RestartController] Error resetting system:', err);
      }
    }

    if (this.onRestartCallback) {
      try {
        this.onRestartCallback();
      } catch (err) {
        console.error('[RestartController] Error during restart callback:', err);
      }
    }
  }
}
