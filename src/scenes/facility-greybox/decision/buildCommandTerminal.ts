/**
 * Milestone 1.0 — Control Room Command Terminal Mesh & Interaction Target.
 *
 * Places the central master command console on the upper observation deck
 * of the control room for executing the final protocol.
 */

import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import type { InteractionTarget } from '../../../game/interaction/InteractionTarget';

export const COMMAND_TERMINAL_TARGET_ID = 'fg-command-terminal';

export function buildCommandTerminal(
  ctx: FacilitySceneContext,
  scene: Scene,
  onActivate: () => void,
): void {
  // Main desk / terminal podium
  const terminalMesh = CreateBox(
    'fg-command-terminal-mesh',
    { width: 1.2, height: 1.1, depth: 0.8 },
    scene,
  );
  terminalMesh.position.set(-2, 1.1, 23.5);

  const mat = new StandardMaterial('fg-command-terminal-mat', scene);
  mat.diffuseColor = new Color3(0.18, 0.25, 0.22);
  mat.emissiveColor = new Color3(0.02, 0.08, 0.05);
  mat.specularColor = new Color3(0.1, 0.1, 0.1);
  terminalMesh.material = mat;
  terminalMesh.isPickable = true;

  // Screen facet
  const screenMesh = CreateBox(
    'fg-command-terminal-screen',
    { width: 0.8, height: 0.5, depth: 0.05 },
    scene,
  );
  screenMesh.position.set(-2, 1.5, 23.1);
  screenMesh.rotation.x = -Math.PI / 6; // tilted upward
  const screenMat = new StandardMaterial('fg-command-screen-mat', scene);
  screenMat.diffuseColor = new Color3(0.05, 0.15, 0.1);
  screenMat.emissiveColor = new Color3(0.1, 0.4, 0.25);
  screenMesh.material = screenMat;
  screenMesh.parent = terminalMesh;

  const target: InteractionTarget = {
    id: COMMAND_TERMINAL_TARGET_ID,
    kind: 'immediate',
    meshes: [terminalMesh, screenMesh],
    maxDistance: 3.0,
    getPrompt: () => ({
      verb: 'ACCESS',
      label: 'COMMAND PROTOCOL TERMINAL',
    }),
    getAvailability: () => ({
      status: 'available',
    }),
    interact: () => {
      ctx.checkpointRegistry.activate('fg-cp-command-terminal');
      onActivate();
      return { status: 'completed' };
    },
  };

  ctx.interactionRegistry.register(target);
  ctx.geo.label('COMMAND TERMINAL', new Vector3(-2, 2.0, 23.5), 2.5);
}
