/**
 * Distribution panel geometry + interaction target in the main control room.
 *
 * The panel target is 'panel' kind (opens DistributionPanelView through
 * InteractionSystem's power-panel mode).
 *
 * M0.6's provisional "[E] ACTIVATE RECEIVER" one-shot target used to be
 * built here too; Milestone 0.7 replaced it with the real receiver system —
 * see signal/buildReceiverConsole.ts, which builds the receiver console at
 * the same world position using the same control-room power gating.
 */
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import { AVAILABLE } from '../../../game/interaction/InteractionTarget';

export const DISTRIBUTION_PANEL_TARGET_ID = 'fg-distribution-panel';

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
}
