import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { AVAILABLE, type InteractionTarget } from '../../../game/interaction/InteractionTarget';

/**
 * Immediate/disabled/async test targets. All state is local to each target
 * closure — nothing enters global stores. Materials are created per target
 * so indicator changes never mutate shared materials.
 */

function panelMaterial(scene: Scene, name: string): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = new Color3(0.32, 0.34, 0.4);
  material.specularColor = Color3.Black();
  return material;
}

function indicatorMaterial(scene: Scene, name: string, color: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = Color3.Black();
  material.emissiveColor = color;
  return material;
}

export function createToggleSwitch(scene: Scene, position: Vector3): InteractionTarget {
  const body = CreateBox('switch-body', { width: 0.35, height: 0.5, depth: 0.15 }, scene);
  body.position.copyFrom(position);
  body.material = panelMaterial(scene, 'switch-body-mat');

  const lever = CreateBox('switch-lever', { width: 0.1, height: 0.22, depth: 0.08 }, scene);
  lever.parent = body;
  lever.position.set(0, -0.08, -0.1);

  const indicator = CreateSphere('switch-indicator', { diameter: 0.1 }, scene);
  indicator.parent = body;
  indicator.position.set(0, 0.18, -0.09);
  const indicatorMat = indicatorMaterial(scene, 'switch-indicator-mat', new Color3(0.5, 0.1, 0.1));
  indicator.material = indicatorMat;

  let on = false;
  return {
    id: 'test-toggle-switch',
    kind: 'immediate',
    meshes: [body],
    getPrompt: () => ({ verb: 'USE', label: 'SWITCH' }),
    getAvailability: () => AVAILABLE,
    interact: () => {
      on = !on;
      indicatorMat.emissiveColor = on ? new Color3(0.15, 0.75, 0.25) : new Color3(0.5, 0.1, 0.1);
      lever.position.y = on ? 0.08 : -0.08;
      return { status: 'completed' as const };
    },
  };
}

const CONTROL_STATES = ['OFF', 'STANDBY', 'ACTIVE', 'FAULT'] as const;
const CONTROL_COLORS = [
  new Color3(0.25, 0.25, 0.28),
  new Color3(0.75, 0.6, 0.15),
  new Color3(0.15, 0.7, 0.3),
  new Color3(0.75, 0.2, 0.15),
];

/** Cycles OFF → STANDBY → ACTIVE → FAULT; proves non-boolean interactions. */
export function createMultiStateControl(scene: Scene, position: Vector3): InteractionTarget {
  const body = CreateBox('control-body', { width: 0.6, height: 0.45, depth: 0.15 }, scene);
  body.position.copyFrom(position);
  body.material = panelMaterial(scene, 'control-body-mat');

  const lampMaterials: StandardMaterial[] = [];
  for (let i = 0; i < CONTROL_STATES.length; i += 1) {
    const lamp = CreateSphere(`control-lamp-${i}`, { diameter: 0.08 }, scene);
    lamp.parent = body;
    lamp.position.set(-0.21 + i * 0.14, 0.12, -0.09);
    const material = indicatorMaterial(
      scene,
      `control-lamp-mat-${i}`,
      CONTROL_COLORS[0] ?? Color3.Black(),
    );
    lamp.material = material;
    lampMaterials.push(material);
  }

  let stateIndex = 0;
  const applyLamps = (): void => {
    for (let i = 0; i < lampMaterials.length; i += 1) {
      const material = lampMaterials[i];
      if (material === undefined) {
        continue;
      }
      material.emissiveColor =
        i === stateIndex
          ? (CONTROL_COLORS[stateIndex] ?? Color3.White())
          : new Color3(0.08, 0.08, 0.1);
    }
  };
  applyLamps();

  return {
    id: 'test-multi-state-control',
    kind: 'immediate',
    meshes: [body],
    getPrompt: () => ({ verb: 'CYCLE', label: `MODE (${CONTROL_STATES[stateIndex] ?? '?'})` }),
    getAvailability: () => AVAILABLE,
    interact: () => {
      stateIndex = (stateIndex + 1) % CONTROL_STATES.length;
      applyLamps();
      return { status: 'completed' as const };
    },
  };
}

/** Disabled target: prompt shows the reason, never an action key. */
export function createDisabledPanel(scene: Scene, position: Vector3): InteractionTarget {
  const body = CreateBox('disabled-panel', { width: 0.5, height: 0.6, depth: 0.12 }, scene);
  body.position.copyFrom(position);
  const material = panelMaterial(scene, 'disabled-panel-mat');
  material.diffuseColor = new Color3(0.26, 0.24, 0.22);
  body.material = material;

  return {
    id: 'test-disabled-panel',
    kind: 'disabled',
    meshes: [body],
    getPrompt: () => ({ verb: 'USE', label: 'AUX PANEL' }),
    getAvailability: () => ({ status: 'disabled', reason: 'REQUIRES POWER' }),
    interact: () => ({ status: 'failed', message: 'disabled' }),
  };
}

/**
 * Async test target (development): interaction resolves after a short
 * artificial delay, proving busy-state handling. The delay exists only in
 * this dev test target, not in the framework.
 */
export function createAsyncTerminal(
  scene: Scene,
  position: Vector3,
  delayMs: number,
): InteractionTarget {
  const body = CreateBox('async-terminal', { width: 0.5, height: 0.4, depth: 0.3 }, scene);
  body.position.copyFrom(position);
  body.material = panelMaterial(scene, 'async-terminal-mat');

  const indicator = CreateSphere('async-terminal-indicator', { diameter: 0.09 }, scene);
  indicator.parent = body;
  indicator.position.set(0.15, 0.12, -0.16);
  const indicatorMat = indicatorMaterial(
    scene,
    'async-terminal-indicator-mat',
    new Color3(0.2, 0.2, 0.25),
  );
  indicator.material = indicatorMat;

  let cycles = 0;
  return {
    id: 'test-async-terminal',
    kind: 'immediate',
    meshes: [body],
    getPrompt: () => ({ verb: 'QUERY', label: 'TERMINAL' }),
    getAvailability: () => AVAILABLE,
    interact: async () => {
      indicatorMat.emissiveColor = new Color3(0.75, 0.6, 0.15);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      cycles += 1;
      indicatorMat.emissiveColor =
        cycles % 2 === 1 ? new Color3(0.15, 0.7, 0.3) : new Color3(0.2, 0.2, 0.25);
      return { status: 'completed' as const };
    },
  };
}

/** Hold-to-reset breaker: TRIPPED → RESET once; not repeatable. */
export function createBreaker(scene: Scene, position: Vector3): InteractionTarget {
  const body = CreateBox('breaker-body', { width: 0.8, height: 0.7, depth: 0.18 }, scene);
  body.position.copyFrom(position);
  body.material = panelMaterial(scene, 'breaker-body-mat');

  const handle = CreateBox('breaker-handle', { width: 0.12, height: 0.25, depth: 0.1 }, scene);
  handle.parent = body;
  handle.position.set(0, -0.12, -0.12);
  const indicator = CreateSphere('breaker-indicator', { diameter: 0.1 }, scene);
  indicator.parent = body;
  indicator.position.set(0, 0.24, -0.11);
  const indicatorMat = indicatorMaterial(
    scene,
    'breaker-indicator-mat',
    new Color3(0.75, 0.2, 0.15),
  );
  indicator.material = indicatorMat;

  let resetDone = false;
  return {
    id: 'test-breaker',
    kind: 'hold',
    meshes: [body],
    holdDurationSeconds: 1.5,
    repeatable: false,
    getPrompt: () => ({ verb: 'RESET', label: 'BREAKER' }),
    getAvailability: () =>
      resetDone ? { status: 'disabled', reason: 'BREAKER READY' } : AVAILABLE,
    interact: () => {
      // Completion can only arrive through a finished hold; the availability
      // gate above prevents re-completion once reset.
      resetDone = true;
      handle.position.y = 0.12;
      indicatorMat.emissiveColor = new Color3(0.15, 0.7, 0.3);
      return { status: 'completed' as const };
    },
  };
}
