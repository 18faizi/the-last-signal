import type { EnvironmentInfo } from '../../config/environment';
import type { SettingsStore } from '../../state/settingsStore';
import type { FirstPersonController, PlayerDebugSnapshot } from '../player/FirstPersonController';

/**
 * Development-only test bridge for browser automation.
 *
 * Installed on `window.__TLS_TEST__` exclusively in development builds
 * (production never constructs it). Exposes the minimum surface the
 * Playwright suite needs: a plain-data player snapshot, a pointer-lock
 * bypass (headless CI cannot always acquire a real pointer lock), and
 * respawn. No Babylon objects ever cross this boundary.
 *
 * Documented in docs/development/testing.md.
 */
export interface TestBridge {
  getPlayerState(): PlayerDebugSnapshot;
  setPointerLockBypass(enabled: boolean): void;
  respawn(): void;
  /** Settings-integration verification (spec §24): routed through the real store. */
  setMouseSensitivity(value: number): void;
  setInvertY(inverted: boolean): void;
}

declare global {
  interface Window {
    __TLS_TEST__?: TestBridge;
  }
}

/** Returns a cleanup function that removes the bridge. */
export function installTestBridge(
  controller: FirstPersonController,
  environment: EnvironmentInfo,
  settings: SettingsStore,
): () => void {
  if (!environment.isDevelopment) {
    return () => undefined;
  }
  const bridge: TestBridge = {
    getPlayerState: () => controller.getDebugSnapshot(),
    setPointerLockBypass: (enabled: boolean) => controller.setPointerLockBypass(enabled),
    respawn: () => controller.respawn(),
    setMouseSensitivity: (value: number) => settings.getState().setMouseSensitivity(value),
    setInvertY: (inverted: boolean) => settings.getState().setInvertYAxis(inverted),
  };
  window.__TLS_TEST__ = bridge;
  return () => {
    if (window.__TLS_TEST__ === bridge) {
      delete window.__TLS_TEST__;
    }
  };
}
