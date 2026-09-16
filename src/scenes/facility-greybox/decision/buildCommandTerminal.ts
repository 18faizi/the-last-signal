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
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
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

  // CRT Monitor Screen facet with green phosphor telemetry readout
  const screenMesh = CreateBox(
    'fg-command-terminal-screen',
    { width: 0.85, height: 0.52, depth: 0.08 },
    scene,
  );
  screenMesh.position.set(-2, 1.5, 23.1);
  screenMesh.rotation.x = -Math.PI / 6; // tilted upward toward player

  const screenTex = new DynamicTexture('cmd-screen-tex', { width: 512, height: 320 }, scene, false);
  const sctx = screenTex.getContext() as CanvasRenderingContext2D;
  sctx.fillStyle = '#051009';
  sctx.fillRect(0, 0, 512, 320);

  // Monitor border bezel & oscilloscope grid
  sctx.strokeStyle = '#124422';
  sctx.lineWidth = 2;
  sctx.strokeRect(10, 10, 492, 300);
  for (let gx = 50; gx < 500; gx += 40) {
    sctx.beginPath();
    sctx.moveTo(gx, 10);
    sctx.lineTo(gx, 310);
    sctx.stroke();
  }
  for (let gy = 40; gy < 310; gy += 35) {
    sctx.beginPath();
    sctx.moveTo(10, gy);
    sctx.lineTo(502, gy);
    sctx.stroke();
  }

  // CRT Telemetry text
  sctx.fillStyle = '#39ff74';
  sctx.font = 'bold 22px monospace';
  sctx.fillText('STATION ECHO · COMMAND TERMINAL', 24, 45);
  sctx.font = '16px monospace';
  sctx.fillText('STATUS: ONLINE · PROTOCOL STANDBY', 24, 85);
  sctx.fillText('> READY FOR AUTHORIZED PROTOCOL DIRECTIVE', 24, 125);
  sctx.fillText('• OMEGA (SILENCE)  • SIGMA (RESPONSE)  • DELTA (ARCHIVE)', 24, 165);

  // CRT scanlines
  sctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  for (let y = 0; y < 320; y += 4) {
    sctx.fillRect(0, y, 512, 2);
  }
  screenTex.update();

  const screenMat = new StandardMaterial('fg-command-screen-mat', scene);
  screenMat.diffuseTexture = screenTex;
  screenMat.emissiveTexture = screenTex;
  screenMat.emissiveColor = new Color3(0.55, 0.95, 0.65);
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
