/**
 * Audio Bridge Coordinator for The Last Signal.
 *
 * Integrates all audio subsystems into the Babylon.js scene render loop:
 * - Maps active camera position and forward direction to Howler 3D listener.
 * - Ticks Footstep, Environmental, Signal, and Threat audio systems.
 * - Subscribes to user settings volume controls.
 * - Cleanly disposes of all audio nodes and subscriptions on scene teardown.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Disposable } from '../../app/lifecycle/Disposable';
import type { SettingsStore } from '../../state/settingsStore';
import type { FirstPersonController } from '../../game/player/FirstPersonController';
import type { ZoneRegistry } from '../../game/facility/ZoneRegistry';
import type { PowerNetwork } from '../../game/power/PowerNetwork';
import type { GeneratorController } from '../../game/generator/GeneratorController';
import type { ReceiverController } from '../../game/receiver/ReceiverController';
import type { ThreatController } from '../../game/threat/ThreatController';
import type { AudioManager } from './AudioManager';
import { FootstepAudioSystem } from './connectors/FootstepAudioSystem';
import { EnvironmentalAudioSystem } from './connectors/EnvironmentalAudioSystem';
import { SignalAudioSystem } from './connectors/SignalAudioSystem';
import { ThreatAudioSystem } from './connectors/ThreatAudioSystem';

export interface AudioBridgeOptions {
  audio: AudioManager;
  scene: Scene;
  controller: FirstPersonController;
  zoneRegistry: ZoneRegistry;
  powerNetwork: PowerNetwork;
  generatorController: GeneratorController;
  receiverController: ReceiverController;
  threatController: ThreatController;
  settings?: SettingsStore;
}

export class AudioBridge implements Disposable {
  readonly audio: AudioManager;
  readonly footsteps: FootstepAudioSystem;
  readonly environment: EnvironmentalAudioSystem;
  readonly signal: SignalAudioSystem;
  readonly threat: ThreatAudioSystem;

  private updateObserver: Observer<Scene> | null = null;
  private unsubscribeSettings: (() => void) | null = null;
  private readonly originVec = new Vector3();
  private readonly forwardVec = new Vector3();
  private disposed = false;

  constructor(options: AudioBridgeOptions) {
    const {
      audio,
      scene,
      controller,
      zoneRegistry,
      powerNetwork,
      generatorController,
      receiverController,
      threatController,
      settings,
    } = options;

    this.audio = audio;

    // 1. Footstep System
    this.footsteps = new FootstepAudioSystem(audio, () => {
      const snap = controller.getDebugSnapshot();
      return {
        grounded: snap.grounded,
        horizontalSpeed: snap.horizontalSpeed,
        sprinting: snap.mode === 'sprinting',
        crouched: snap.crouched,
        zoneId: zoneRegistry.activeZoneIds[0] ?? null,
      };
    });

    // 2. Environmental System
    this.environment = new EnvironmentalAudioSystem(audio, () => {
      const zoneId = zoneRegistry.activeZoneIds[0] ?? null;
      const isOutdoor =
        zoneId === null ||
        zoneId.includes('courtyard') ||
        zoneId.includes('gate') ||
        zoneId.includes('perimeter') ||
        zoneId.includes('approach') ||
        zoneId.includes('roof');
      const genSnap = generatorController.snapshot;
      const powerSnap = powerNetwork.getSnapshot();
      const isFacilityPowered = powerSnap.circuits.some((c) => c.effective === 'energized');

      return {
        zoneId,
        isOutdoor,
        isGeneratorRunning: genSnap.state === 'Running' || genSnap.state === 'RunningUnstable',
        isFacilityPowered,
      };
    });

    // 3. Signal Audio System
    this.signal = new SignalAudioSystem(audio, () => {
      const rxSnap = receiverController.getSnapshot();
      const currentFreq = rxSnap.controls.frequencyMHz;
      const targetFreq = rxSnap.activeSignalId
        ? (receiverController.getSignalDefinition(rxSnap.activeSignalId)?.targetFrequencyMHz ?? 100)
        : 100;
      const deltaKhz = (currentFreq - targetFreq) * 1000;

      return {
        isReceiverActive: rxSnap.mode !== 'Offline' && rxSnap.mode !== 'Fault',
        frequencyDeltaKhz: deltaKhz,
        isSignalLocked: rxSnap.lockState === 'Locked',
        signalQuality: rxSnap.holdQuality,
      };
    });

    // 4. Threat Audio System
    this.threat = new ThreatAudioSystem(audio, () => {
      const threatSnap = threatController.getSnapshot();
      const pos = threatSnap.position;
      return {
        suspicion: threatSnap.suspicion,
        behaviorState: threatSnap.state,
        threatPosition: pos ? { x: pos.x, y: pos.y, z: pos.z } : null,
      };
    });

    // 5. Connect Settings volume controls if provided
    if (settings) {
      const syncVolumes = (s: {
        masterVolume: number;
        musicVolume: number;
        effectsVolume: number;
      }): void => {
        audio.setBusVolume('master', s.masterVolume);
        audio.setBusVolume('ambience', s.musicVolume);
        audio.setBusVolume('threat', s.musicVolume);
        audio.setBusVolume('sfx', s.effectsVolume);
        audio.setBusVolume('footsteps', s.effectsVolume);
        audio.setBusVolume('radio', s.effectsVolume);
      };
      syncVolumes(settings.getState());
      this.unsubscribeSettings = settings.subscribe(syncVolumes);
    }

    // 6. Hook into Scene Render Loop
    this.updateObserver = scene.onBeforeRenderObservable.add(() => {
      if (this.disposed) return;
      const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);

      // Update Spatial Listener from Camera
      const camera = scene.activeCamera;
      if (camera) {
        controller.getViewRay(this.originVec, this.forwardVec);
        audio.updateListener(camera.globalPosition, this.forwardVec);
      }

      // Tick audio systems
      this.footsteps.update(dt);
      this.environment.update(dt);
      this.signal.update(dt);
      this.threat.update(dt);
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.updateObserver) {
      this.updateObserver.remove();
      this.updateObserver = null;
    }

    this.unsubscribeSettings?.();
    this.unsubscribeSettings = null;

    this.footsteps.dispose();
    this.environment.dispose();
    this.signal.dispose();
    this.threat.dispose();
    this.audio.dispose();
  }
}
