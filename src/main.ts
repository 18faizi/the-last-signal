import { createApplicationContext, type ApplicationDom } from './app/ApplicationContext';
import { GameApplication } from './app/GameApplication';

/**
 * Entry point. Responsibilities are deliberately minimal: locate required
 * DOM, build the application context, start the application, and surface
 * bootstrap failures that happen before the in-app error UI exists.
 */

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Required element #${id} is missing from index.html`);
  }
  return element as T;
}

function locateDom(): ApplicationDom {
  return {
    appRoot: requireElement('app-root'),
    canvas: requireElement<HTMLCanvasElement>('game-canvas'),
    loadingRoot: requireElement('loading-root'),
    loadingStage: requireElement('loading-stage'),
    loadingBarFill: requireElement('loading-bar-fill'),
    fatalRoot: requireElement('fatal-error-root'),
    fatalMessage: requireElement('fatal-error-message'),
    fatalDetails: requireElement('fatal-error-details'),
    fatalReloadButton: requireElement<HTMLButtonElement>('fatal-reload'),
    fatalCopyButton: requireElement<HTMLButtonElement>('fatal-copy'),
    debugRoot: requireElement('debug-overlay-root'),
    readyMarker: requireElement('ready-marker'),
  };
}

/** Last-resort failure display for errors before FatalErrorScreen exists. */
function showBootstrapFailure(error: unknown): void {
  console.error('[bootstrap] fatal', error);
  const root = document.getElementById('fatal-error-root');
  const message = document.getElementById('fatal-error-message');
  if (root !== null && message !== null) {
    message.textContent = 'The application failed to start.';
    root.hidden = false;
  }
}

try {
  const dom = locateDom();
  const application = new GameApplication(createApplicationContext(dom));
  window.addEventListener('beforeunload', () => application.stop());
  void application.start().catch(showBootstrapFailure);
} catch (error) {
  showBootstrapFailure(error);
}
