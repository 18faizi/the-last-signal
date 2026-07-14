import type { EnvironmentInfo } from '../../config/environment';
import { GameError } from './GameError';

export type FatalErrorListener = (error: GameError) => void;

/**
 * Central sink for application errors.
 *
 * Services report here instead of calling `console.error` or touching UI
 * directly; the reporter decides how to log and who to notify. Milestone 0.1
 * only logs to the console and forwards fatal errors to the registered
 * listener (the fatal-error screen), but this is the seam where remote
 * telemetry would attach later.
 */
export class ErrorReporter {
  private readonly environment: EnvironmentInfo;
  private fatalListener: FatalErrorListener | undefined;

  constructor(environment: EnvironmentInfo) {
    this.environment = environment;
  }

  onFatal(listener: FatalErrorListener): void {
    this.fatalListener = listener;
  }

  /** Reports a recoverable problem. Keeps the application running. */
  reportRecoverable(error: GameError): void {
    if (this.environment.isDevelopment) {
      console.warn(`[recoverable:${error.kind}]`, error, error.cause ?? '');
    }
  }

  /** Reports an unrecoverable failure and notifies the fatal listener. */
  reportFatal(error: GameError): void {
    console.error(`[fatal:${error.kind}]`, error, error.cause ?? '');
    this.fatalListener?.(error);
  }
}
