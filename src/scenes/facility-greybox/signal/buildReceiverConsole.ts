/**
 * Control-room receiver console geometry + interaction target.
 *
 * REPLACES M0.6's provisional "[E] ACTIVATE RECEIVER" one-shot target
 * (formerly built inline in buildDistributionPanel.ts) with the real
 * ReceiverController-backed system: a 'receiver'-kind InteractionTarget that
 * opens the full ReceiverPanelView through InteractionSystem's receiver
 * mode. Same world position as the M0.6 placeholder (control room, next to
 * the distribution panel) and the same power-gating precedent — this
 * builder itself never touches PowerNetwork; power on/off is delivered
 * exclusively via facilityReceiverBindings.ts's PoweredStateBinding
 * subscription calling ReceiverController.powerOn()/powerOff().
 */
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import { createReceiverInteractionTarget } from '../../../game/receiver/ReceiverInteractionTarget';
import { isReceiverPowered } from '../../../game/receiver/ReceiverMode';
import type { InteractionContext } from '../../../game/interaction/InteractionTarget';

export const RECEIVER_TARGET_ID = 'fg-receiver';

export function buildReceiverConsole(ctx: FacilitySceneContext, scene: Scene): void {
  const receiverMesh = CreateBox('fg-receiver-mesh', { width: 0.15, height: 1, depth: 1.1 }, scene);
  receiverMesh.position.set(-9.7, 1.6, 22);
  const receiverMat = new StandardMaterial('fg-receiver-mat', scene);
  receiverMat.diffuseColor = new Color3(0.24, 0.26, 0.3);
  receiverMat.specularColor = new Color3(0.3, 0.3, 0.35);
  receiverMesh.material = receiverMat;
  receiverMesh.isPickable = true;

  // Oscilloscope CRT screen
  const screen = CreateBox('fg-receiver-screen', { width: 0.05, height: 0.45, depth: 0.55 }, scene);
  screen.parent = receiverMesh;
  screen.position.set(0.08, 0.15, -0.2);
  const screenTex = new DynamicTexture('rcv-screen-tex', { width: 256, height: 256 }, scene, false);
  const sctx = screenTex.getContext() as CanvasRenderingContext2D;

  const renderScreen = (powered: boolean) => {
    sctx.fillStyle = powered ? '#041208' : '#0a0a0c';
    sctx.fillRect(0, 0, 256, 256);

    if (powered) {
      sctx.strokeStyle = '#0e3a1a';
      sctx.lineWidth = 1;
      for (let g = 20; g < 256; g += 25) {
        sctx.beginPath();
        sctx.moveTo(g, 0);
        sctx.lineTo(g, 256);
        sctx.moveTo(0, g);
        sctx.lineTo(256, g);
        sctx.stroke();
      }

      // Green Oscilloscope carrier sine wave
      sctx.strokeStyle = '#39ff74';
      sctx.lineWidth = 3;
      sctx.beginPath();
      for (let x = 0; x < 256; x += 4) {
        const y = 128 + Math.sin(x * 0.08) * 45;
        if (x === 0) sctx.moveTo(x, y);
        else sctx.lineTo(x, y);
      }
      sctx.stroke();

      sctx.fillStyle = '#64ff88';
      sctx.font = 'bold 16px monospace';
      sctx.fillText('1420.405 MHz', 20, 30);
      sctx.fillText('CARRIER LOCKED', 20, 235);
    } else {
      sctx.fillStyle = '#333b45';
      sctx.font = '14px monospace';
      sctx.fillText('CIRCUIT OFFLINE', 35, 130);
    }
    screenTex.update();
  };

  const screenMat = new StandardMaterial('fg-receiver-screen-mat', scene);
  screenMat.diffuseTexture = screenTex;
  screen.material = screenMat;
  screen.isPickable = false;

  const updateMaterial = () => {
    const powered = isReceiverPowered(ctx.receiverController.receiverMode);
    renderScreen(powered);
    screenMat.emissiveColor = powered ? new Color3(0.5, 0.9, 0.6) : new Color3(0, 0, 0);
  };
  updateMaterial();
  const unsubscribe = ctx.receiverController.subscribeMode(updateMaterial);

  const target = createReceiverInteractionTarget(
    RECEIVER_TARGET_ID,
    receiverMesh,
    ctx.receiverController,
    scene,
    () => isReceiverPowered(ctx.receiverController.receiverMode),
  );
  const originalInteract = target.interact.bind(target);
  const wrappedTarget = {
    ...target,
    interact: (context: InteractionContext) => {
      ctx.checkpointRegistry.activate('fg-cp-receiver');
      return originalInteract(context);
    },
    dispose: () => {
      unsubscribe();
      target.dispose?.();
    },
  };
  ctx.interactionRegistry.register(wrappedTarget);

  ctx.geo.label('SIGNAL RECEIVER', new Vector3(-9.7, 2.1, 22), 2.5);
}
