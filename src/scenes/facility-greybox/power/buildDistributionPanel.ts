/**
 * Distribution panel geometry + interaction target in the main control room,
 * plus the control-room receiver — the milestone's completion trigger.
 *
 * The panel target is 'panel' kind (opens DistributionPanelView through
 * InteractionSystem's power-panel mode). The receiver is a plain 'immediate'
 * target whose availability is driven by a PoweredStateBinding on the
 * control-room circuit: "NO POWER" when de-energized, "[E] ACTIVATE
 * RECEIVER" once energized. Activating it is one-shot — it records
 * ReceiverActivated and advances the power-progression phase.
 */
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import { AVAILABLE, type InteractionTarget } from '../../../game/interaction/InteractionTarget';
import { PoweredStateBinding } from '../../../game/electrical/PoweredStateBinding';
import { CIRCUIT_CONTROL_ROOM_ID } from './facilityPowerDefinitions';

export const DISTRIBUTION_PANEL_TARGET_ID = 'fg-distribution-panel';
export const RECEIVER_TARGET_ID = 'fg-receiver';

export function buildDistributionPanel(ctx: FacilitySceneContext, scene: Scene): void {
  // ----- Panel geometry ----------------------------------------------------
  const panelMesh = CreateBox(
    'fg-distribution-panel-mesh',
    { width: 0.15, height: 1.2, depth: 0.9 },
    scene,
  );
  // y aligned to standing eye height (1.66m) so a level look hits it directly.
  panelMesh.position.set(-9.7, 1.6, 18);
  const panelMat = new StandardMaterial('fg-distribution-panel-mat', scene);
  panelMat.diffuseColor = new Color3(0.2, 0.3, 0.45);
  panelMat.specularColor = new Color3(0.05, 0.05, 0.05);
  panelMesh.material = panelMat;
  panelMesh.isPickable = true;

  const panelTarget = {
    id: DISTRIBUTION_PANEL_TARGET_ID,
    kind: 'panel' as const,
    panelId: 'main',
    meshes: [panelMesh],
    getPrompt: () => ({ verb: 'OPEN', label: 'DISTRIBUTION PANEL' }),
    getAvailability: () => AVAILABLE,
    interact: () => ({ status: 'completed' as const }),
  };
  ctx.interactionRegistry.register(panelTarget);

  ctx.geo.label('DISTRIBUTION PANEL', new Vector3(-9.7, 2.1, 18), 2.5);

  // ----- Receiver ------------------------------------------------------------
  const receiverMesh = CreateBox('fg-receiver-mesh', { width: 0.15, height: 1, depth: 1.1 }, scene);
  receiverMesh.position.set(-9.7, 1.6, 22);
  const receiverMat = new StandardMaterial('fg-receiver-mat', scene);
  receiverMat.diffuseColor = new Color3(0.35, 0.2, 0.1);
  receiverMat.specularColor = new Color3(0.05, 0.05, 0.05);
  receiverMesh.material = receiverMat;
  receiverMesh.isPickable = true;

  let controlRoomPowered = false;
  let activated = false;

  const binding = PoweredStateBinding.forCircuit(
    ctx.powerNetwork,
    CIRCUIT_CONTROL_ROOM_ID,
    (powered) => {
      controlRoomPowered = powered;
      receiverMat.diffuseColor = powered ? new Color3(0.25, 0.55, 0.3) : new Color3(0.35, 0.2, 0.1);
      receiverMat.emissiveColor = powered ? new Color3(0.05, 0.15, 0.05) : new Color3(0, 0, 0);
      if (powered) {
        ctx.facilityState.tryAdvancePhase('ControlRoomPowered');
      }
    },
  );

  const receiverTarget: InteractionTarget = {
    id: RECEIVER_TARGET_ID,
    kind: 'immediate',
    meshes: [receiverMesh],
    getPrompt: () => ({
      verb: activated ? 'ACTIVATED' : 'ACTIVATE',
      label: 'RECEIVER',
    }),
    getAvailability: () => {
      if (activated) return { status: 'disabled', reason: 'RECEIVER ALREADY ACTIVE' };
      if (!controlRoomPowered) return { status: 'disabled', reason: 'NO POWER' };
      return AVAILABLE;
    },
    interact: () => {
      if (activated || !controlRoomPowered) {
        return { status: 'failed', message: controlRoomPowered ? 'ALREADY ACTIVE' : 'NO POWER' };
      }
      activated = true;
      ctx.facilityState.recordReceiverActivated();
      ctx.facilityState.tryAdvancePhase('ReceiverActivated');
      ctx.facilityState.tryAdvancePhase('PowerNetworkOperational');
      ctx.facilityState.recordPowerMilestoneComplete();
      return { status: 'completed' };
    },
    // The PoweredStateBinding subscription is scene-scoped, not owned by
    // PowerNetwork itself — disposing it here (rather than a separate
    // scene-level list) means InteractionRegistry.dispose() during scene
    // teardown releases it automatically, same as every other target.
    dispose: () => binding.dispose(),
  };
  ctx.interactionRegistry.register(receiverTarget);

  ctx.geo.label('FIELD RECEIVER', new Vector3(-9.7, 2.1, 22), 2.5);
}
