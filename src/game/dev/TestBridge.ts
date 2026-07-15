import type { Scene } from '@babylonjs/core/scene';
import type { EnvironmentInfo } from '../../config/environment';
import type { SettingsStore } from '../../state/settingsStore';
import type { DocumentReaderView } from '../../ui/interaction/DocumentReaderView';
import type { InteractionDebugSnapshot, InteractionSystem } from '../interaction/InteractionSystem';
import type { InspectionController } from '../interaction/inspection/InspectionController';
import type { FirstPersonController, PlayerDebugSnapshot } from '../player/FirstPersonController';
import type { InventoryService } from '../inventory/InventoryService';
import type { PickupRegistry } from '../pickups/PickupRegistry';
import type { DoorRegistry } from '../doors/DoorRegistry';

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

export interface InventoryBridgeSnapshot {
  readonly itemCount: number;
  readonly entries: ReadonlyArray<{ itemId: string; quantity: number }>;
  readonly has: (itemId: string) => boolean;
  readonly getQuantity: (itemId: string) => number;
}

export interface DoorBridgeSnapshot {
  readonly doorId: string;
  readonly physical: string;
  readonly access: string;
  readonly openFraction: number;
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
  /** Installed by the access-test scene (Milestone 0.4). */
  getInventorySnapshot?(): InventoryBridgeSnapshot;
  collectPickup?(pickupId: string): boolean;
  getDoorState?(doorId: string): DoorBridgeSnapshot | null;
  openDoor?(doorId: string): boolean;
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
 * Adds access/inventory hooks to the already-installed bridge.
 * Installed by the access-test scene (Milestone 0.4).
 */
export function installAccessBridge(
  inventory: InventoryService,
  pickupRegistry: PickupRegistry,
  doorRegistry: DoorRegistry,
  environment: EnvironmentInfo,
): () => void {
  if (!environment.isDevelopment) {
    return () => undefined;
  }
  const bridge = window.__TLS_TEST__;
  if (bridge === undefined) {
    return () => undefined;
  }

  bridge.getInventorySnapshot = () => {
    const snap = inventory.getSnapshot();
    return {
      itemCount: snap.itemTypeCount,
      entries: snap.entries.map((e) => ({ itemId: e.itemId, quantity: e.quantity })),
      has: (id: string) => snap.has(id),
      getQuantity: (id: string) => snap.getQuantity(id),
    };
  };

  bridge.collectPickup = (pickupId: string) => {
    const target = pickupRegistry.get(pickupId);
    if (target === undefined) {
      return false;
    }
    if ('collect' in target && typeof (target as { collect?: unknown }).collect === 'function') {
      (target as { collect: () => void }).collect();
      return true;
    }
    // Direct / hold pickup: simulate interact
    if ('interact' in target) {
      (target as { interact: (ctx: unknown) => unknown }).interact({
        playerPosition: { x: 0, y: 0, z: 0 },
        distance: 1,
      });
      return true;
    }
    return false;
  };

  bridge.getDoorState = (doorId: string) => {
    const door = doorRegistry.get(doorId);
    if (door === undefined) {
      return null;
    }
    const s = door.doorState;
    return {
      doorId,
      physical: s.physical,
      access: s.access,
      openFraction: s.openFraction,
    };
  };

  bridge.openDoor = (doorId: string) => {
    const door = doorRegistry.get(doorId);
    if (door === undefined) {
      return false;
    }
    const denied = door.interact();
    return denied === null;
  };

  return () => {
    if (window.__TLS_TEST__ === bridge) {
      delete bridge.getInventorySnapshot;
      delete bridge.collectPickup;
      delete bridge.getDoorState;
      delete bridge.openDoor;
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
