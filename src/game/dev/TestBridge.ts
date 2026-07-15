import type { Scene } from '@babylonjs/core/scene';
import type { EnvironmentInfo } from '../../config/environment';
import type { SettingsStore } from '../../state/settingsStore';
import type { DocumentReaderView } from '../../ui/interaction/DocumentReaderView';
import type { InteractionDebugSnapshot, InteractionSystem } from '../interaction/InteractionSystem';
import type { InspectionController } from '../interaction/inspection/InspectionController';
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
/** Plain-data diagnostics for the repetition/leak browser test. */
export interface BridgeDiagnostics {
  readonly cameraCount: number;
  readonly meshCount: number;
  readonly beforeRenderObserverCount: number;
  readonly promptElementCount: number;
  readonly readerElementCount: number;
  readonly inspectionOverlayCount: number;
}

export interface TestBridge {
  getPlayerState(): PlayerDebugSnapshot;
  setPointerLockBypass(enabled: boolean): void;
  respawn(): void;
  /** Settings-integration verification (spec §24): routed through the real store. */
  setMouseSensitivity(value: number): void;
  setInvertY(inverted: boolean): void;
  /** Installed by the interaction scene (Milestone 0.3). */
  getInteractionState?(): InteractionDebugSnapshot & {
    inspectionView: { yaw: number; pitch: number; radius: number } | null;
    documentScrollTop: number;
  };
  getDiagnostics?(): BridgeDiagnostics;
  /** Dev-only direct activation (headless CI cannot aim precisely). */
  activateTarget?(targetId: string): boolean;
  closeOverlays?(): void;
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

/**
 * Adds interaction-framework inspection hooks to the already-installed
 * bridge (development only). Counts are plain numbers gathered on demand —
 * no Babylon objects cross the boundary.
 */
export function installInteractionBridge(
  interaction: InteractionSystem,
  inspection: InspectionController,
  reader: DocumentReaderView,
  scene: Scene,
  environment: EnvironmentInfo,
): () => void {
  if (!environment.isDevelopment) {
    return () => undefined;
  }
  const bridge = window.__TLS_TEST__;
  if (bridge === undefined) {
    return () => undefined;
  }
  bridge.getInteractionState = () => ({
    ...interaction.getDebugSnapshot(),
    inspectionView: inspection.isOpen
      ? {
          yaw: inspection.viewState.yaw,
          pitch: inspection.viewState.pitch,
          radius: inspection.viewState.radius,
        }
      : null,
    documentScrollTop: reader.scrollTop,
  });
  bridge.activateTarget = (targetId: string) => interaction.devActivate(targetId);
  bridge.closeOverlays = () => interaction.devCloseOverlays();
  bridge.getDiagnostics = () => ({
    cameraCount: scene.cameras.length,
    meshCount: scene.meshes.length,
    beforeRenderObserverCount: scene.onBeforeRenderObservable.observers.length,
    promptElementCount: document.querySelectorAll('#interaction-prompt').length,
    readerElementCount: document.querySelectorAll('#document-reader').length,
    inspectionOverlayCount: document.querySelectorAll('#inspection-overlay').length,
  });
  return () => {
    if (window.__TLS_TEST__ === bridge) {
      delete bridge.getInteractionState;
      delete bridge.getDiagnostics;
      delete bridge.activateTarget;
      delete bridge.closeOverlays;
    }
  };
}
