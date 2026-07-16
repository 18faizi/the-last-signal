/**
 * Babylon-facing adapter: builds InteractionTarget-conforming objects for the
 * generator control panel.
 *
 * This is the one sanctioned mesh-touching file in game/generator/ — it
 * mirrors the existing DoorInteractionTarget precedent (game/doors/): the
 * *state* (GeneratorController) is pure TypeScript; this adapter merely
 * translates that state into the InteractionTarget contract using meshes the
 * scene builder already constructed. It also owns the single
 * onBeforeRenderObservable hook that drives GeneratorController.update(dt)
 * (warm-up / stop-down timers) — exactly like DoorInteractionTarget drives
 * DoorController.update(dt). Disposing the status-panel target removes that
 * observer, so the timer mechanism is fully scoped and leak-free.
 */
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import {
  AVAILABLE,
  type InteractionAvailability,
  type InteractionContext,
  type InteractionPromptSpec,
  type InteractionResult,
  type InteractionTarget,
} from '../interaction/InteractionTarget';
import type { GeneratorController } from './GeneratorController';

export interface GeneratorControlMeshes {
  readonly fuelValve: AbstractMesh;
  readonly battery: AbstractMesh;
  readonly emergencyStop: AbstractMesh;
  readonly selector: AbstractMesh;
  readonly starter: AbstractMesh;
  readonly breaker: AbstractMesh;
  readonly statusPanel: AbstractMesh;
}

const STARTER_HOLD_SECONDS = 2;

class SimpleImmediateTarget implements InteractionTarget {
  readonly kind = 'immediate' as const;
  readonly id: string;
  readonly meshes: readonly AbstractMesh[];
  readonly priority?: number;

  constructor(
    id: string,
    mesh: AbstractMesh,
    private readonly promptFn: () => InteractionPromptSpec,
    private readonly availabilityFn: () => InteractionAvailability,
    private readonly onInteract: () => InteractionResult,
  ) {
    this.id = id;
    this.meshes = [mesh];
  }

  getPrompt(_context: InteractionContext): InteractionPromptSpec {
    return this.promptFn();
  }

  getAvailability(_context: InteractionContext): InteractionAvailability {
    return this.availabilityFn();
  }

  interact(_context: InteractionContext): InteractionResult {
    return this.onInteract();
  }
}

class StarterHoldTarget implements InteractionTarget {
  readonly kind = 'hold' as const;
  readonly id: string;
  readonly meshes: readonly AbstractMesh[];
  readonly holdDurationSeconds = STARTER_HOLD_SECONDS;
  readonly repeatable = true;

  constructor(
    id: string,
    mesh: AbstractMesh,
    private readonly controller: GeneratorController,
  ) {
    this.id = id;
    this.meshes = [mesh];
  }

  getPrompt(_context: InteractionContext): InteractionPromptSpec {
    return { verb: 'HOLD E', label: 'START GENERATOR' };
  }

  getAvailability(_context: InteractionContext): InteractionAvailability {
    const state = this.controller.generatorState;
    if (state === 'ReadyToStart') return AVAILABLE;
    if (state === 'Cranking' || state === 'RunningUnstable' || state === 'Running') {
      return { status: 'disabled', reason: 'GENERATOR ALREADY RUNNING' };
    }
    const reason = this.controller.readiness.blockingReason;
    return { status: 'disabled', reason: reason ?? 'GENERATOR NOT READY' };
  }

  interact(_context: InteractionContext): InteractionResult {
    const denied = this.controller.attemptStart();
    if (denied !== null) {
      return { status: 'failed', message: denied };
    }
    return { status: 'completed' };
  }
}

/**
 * Builds the seven generator control-panel interaction targets. Registers
 * one onBeforeRenderObservable to tick the controller's scoped warm-up/
 * stop-down timer; disposing the returned status-panel target removes it.
 */
export function createGeneratorInteractionTargets(
  idPrefix: string,
  controller: GeneratorController,
  scene: Scene,
  meshes: GeneratorControlMeshes,
): readonly InteractionTarget[] {
  const fuelValveTarget = new SimpleImmediateTarget(
    `${idPrefix}-fuel-valve`,
    meshes.fuelValve,
    () => ({
      verb: controller.snapshot.fuelValve === 'Open' ? 'CLOSE' : 'OPEN',
      label: 'FUEL VALVE',
    }),
    () => AVAILABLE,
    () => {
      if (controller.snapshot.fuelValve === 'Open') {
        controller.closeFuelValve();
      } else {
        controller.openFuelValve();
      }
      return { status: 'completed' };
    },
  );

  const batteryTarget = new SimpleImmediateTarget(
    `${idPrefix}-battery`,
    meshes.battery,
    () => ({
      verb: controller.snapshot.starterBattery === 'Connected' ? 'DISCONNECT' : 'CONNECT',
      label: 'STARTER BATTERY',
    }),
    () => {
      if (controller.snapshot.starterBattery === 'Depleted') {
        return { status: 'disabled', reason: 'STARTER BATTERY DEPLETED' };
      }
      return AVAILABLE;
    },
    () => {
      if (controller.snapshot.starterBattery === 'Connected') {
        controller.disconnectBattery();
      } else {
        controller.connectBattery();
      }
      return { status: 'completed' };
    },
  );

  const estopTarget = new SimpleImmediateTarget(
    `${idPrefix}-estop`,
    meshes.emergencyStop,
    () => ({
      verb: controller.snapshot.emergencyStop === 'Engaged' ? 'RELEASE' : 'ENGAGE',
      label: 'EMERGENCY STOP',
    }),
    () => AVAILABLE,
    () => {
      if (controller.snapshot.emergencyStop === 'Engaged') {
        controller.releaseEmergencyStop();
      } else {
        controller.engageEmergencyStop();
      }
      return { status: 'completed' };
    },
  );

  const selectorTarget = new SimpleImmediateTarget(
    `${idPrefix}-selector`,
    meshes.selector,
    () => ({ verb: 'SET', label: `SELECTOR (${controller.snapshot.selector.toUpperCase()})` }),
    () => AVAILABLE,
    () => {
      const cur = controller.snapshot.selector;
      if (cur === 'Off') controller.setSelectorManual();
      else if (cur === 'Manual') controller.setSelectorAutomatic();
      else controller.setSelectorOff();
      return { status: 'completed' };
    },
  );

  const starterTarget = new StarterHoldTarget(`${idPrefix}-starter`, meshes.starter, controller);

  const breakerTarget = new SimpleImmediateTarget(
    `${idPrefix}-breaker`,
    meshes.breaker,
    () => ({
      verb: controller.snapshot.mainBreaker === 'Closed' ? 'OPEN' : 'CLOSE',
      label: 'MAIN BREAKER',
    }),
    () => {
      if (controller.snapshot.mainBreaker === 'Closed') return AVAILABLE;
      if (controller.generatorState !== 'Running') {
        return { status: 'disabled', reason: 'MAIN BREAKER LOCKED — GENERATOR UNSTABLE' };
      }
      return AVAILABLE;
    },
    () => {
      if (controller.snapshot.mainBreaker === 'Closed') {
        controller.openMainBreaker();
        return { status: 'completed' };
      }
      const denied = controller.closeMainBreaker();
      if (denied !== null) {
        return { status: 'failed', message: denied };
      }
      return { status: 'completed' };
    },
  );

  const statusPanelTargetId = `${idPrefix}-status-panel`;
  let observer: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);
    controller.update(dt);
  });

  const statusPanelTarget: InteractionTarget = {
    id: statusPanelTargetId,
    kind: 'immediate',
    meshes: [meshes.statusPanel],
    getPrompt: () => ({ verb: 'VIEW', label: 'GENERATOR STATUS' }),
    getAvailability: () => AVAILABLE,
    interact: () => {
      controller.inspect();
      return { status: 'completed' };
    },
    dispose: () => {
      if (observer !== null) {
        scene.onBeforeRenderObservable.remove(observer);
        observer = null;
      }
    },
  };

  return [
    fuelValveTarget,
    batteryTarget,
    estopTarget,
    selectorTarget,
    starterTarget,
    breakerTarget,
    statusPanelTarget,
  ];
}
