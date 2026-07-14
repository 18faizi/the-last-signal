import { environment, type EnvironmentInfo } from '../config/environment';
import { gameConfig, type GameConfig } from '../config/gameConfig';
import { performanceConfig, type PerformanceConfig } from '../config/performanceConfig';
import { ErrorReporter } from '../core/errors/ErrorReporter';
import { createApplicationStore, type ApplicationStore } from '../state/applicationStore';
import { createSettingsStore, type SettingsStore } from '../state/settingsStore';

/** The DOM elements the application requires; located once in main.ts. */
export interface ApplicationDom {
  readonly canvas: HTMLCanvasElement;
  readonly loadingRoot: HTMLElement;
  readonly loadingStage: HTMLElement;
  readonly loadingBarFill: HTMLElement;
  readonly fatalRoot: HTMLElement;
  readonly fatalMessage: HTMLElement;
  readonly fatalDetails: HTMLElement;
  readonly fatalReloadButton: HTMLButtonElement;
  readonly fatalCopyButton: HTMLButtonElement;
  readonly debugRoot: HTMLElement;
  readonly readyMarker: HTMLElement;
}

/**
 * Explicit dependency container passed into GameApplication.
 *
 * Nothing here is a global: main.ts builds one context and hands it over,
 * so every dependency is visible at the constructor boundary and tests can
 * substitute any piece.
 */
export interface ApplicationContext {
  readonly environment: EnvironmentInfo;
  readonly gameConfig: GameConfig;
  readonly performanceConfig: PerformanceConfig;
  readonly applicationStore: ApplicationStore;
  readonly settingsStore: SettingsStore;
  readonly errorReporter: ErrorReporter;
  readonly dom: ApplicationDom;
}

export function createApplicationContext(dom: ApplicationDom): ApplicationContext {
  return {
    environment,
    gameConfig,
    performanceConfig,
    applicationStore: createApplicationStore({ developmentMode: environment.isDevelopment }),
    settingsStore: createSettingsStore({
      audioDefaults: gameConfig.audio,
      initialGraphicsPreset: performanceConfig.initialGraphicsPreset,
    }),
    errorReporter: new ErrorReporter(environment),
    dom,
  };
}
