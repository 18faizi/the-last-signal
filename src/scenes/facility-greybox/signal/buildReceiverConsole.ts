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
import type { FacilitySceneContext } from '../FacilitySceneContext';
import { createReceiverInteractionTarget } from '../../../game/receiver/ReceiverInteractionTarget';
import { isReceiverPowered } from '../../../game/receiver/ReceiverMode';

export const RECEIVER_TARGET_ID = 'fg-receiver';

export function buildReceiverConsole(ctx: FacilitySceneContext, scene: Scene): void {
  const receiverMesh = CreateBox('fg-receiver-mesh', { width: 0.15, height: 1, depth: 1.1 }, scene);
  receiverMesh.position.set(-9.7, 1.6, 22);
  const receiverMat = new StandardMaterial('fg-receiver-mat', scene);
  receiverMat.diffuseColor = new Color3(0.35, 0.2, 0.1);
  receiverMat.specularColor = new Color3(0.05, 0.05, 0.05);
  receiverMesh.material = receiverMat;
  receiverMesh.isPickable = true;

  const updateMaterial = () => {
    const powered = isReceiverPowered(ctx.receiverController.receiverMode);
    receiverMat.diffuseColor = powered ? new Color3(0.25, 0.55, 0.3) : new Color3(0.35, 0.2, 0.1);
    receiverMat.emissiveColor = powered ? new Color3(0.05, 0.15, 0.05) : new Color3(0, 0, 0);
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
  const wrappedTarget = {
    ...target,
    dispose: () => {
      unsubscribe();
      target.dispose?.();
    },
  };
  ctx.interactionRegistry.register(wrappedTarget);

  ctx.geo.label('SIGNAL RECEIVER', new Vector3(-9.7, 2.1, 22), 2.5);
}
