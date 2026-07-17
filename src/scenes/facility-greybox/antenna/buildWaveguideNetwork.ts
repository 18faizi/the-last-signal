/**
 * Waveguide junction box geometry + interaction target(s). One compact,
 * non-modal target per waveguide path that has an actual puzzle (spec §23's
 * East Relay Dish example) — see AntennaJunctionTarget.ts's doc comment for
 * why this is an 'immediate'-kind target rather than a dedicated panel.
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import { createAntennaJunctionTarget } from '../../../game/antenna/AntennaJunctionTarget';
import { WAVEGUIDE_EAST_RELAY_ID } from './facilityAntennaDefinitions';

export const WAVEGUIDE_JUNCTION_TARGET_ID = 'fg-waveguide-junction-east-relay';

export function buildWaveguideNetwork(ctx: FacilitySceneContext, scene: Scene): void {
  const RY = 6;
  // Mounted at the player's standing eye height above the rooftop floor
  // (RY + PlayerConfig.standingEyeHeight, see buildGeneratorControls.ts's
  // identical reasoning) so a level (pitch 0) look lands on it directly —
  // a margin of 0.5 units tall comfortably covers the settled eye height.
  const junctionMesh = CreateBox(
    'fg-waveguide-junction-mesh',
    { width: 0.5, height: 0.5, depth: 0.4 },
    scene,
  );
  junctionMesh.position.set(3, RY + 1.66, 20);
  const junctionMat = new StandardMaterial('fg-waveguide-junction-mat', scene);
  junctionMat.diffuseColor = new Color3(0.3, 0.3, 0.35);
  junctionMesh.material = junctionMat;
  junctionMesh.isPickable = true;

  const target = createAntennaJunctionTarget(
    WAVEGUIDE_JUNCTION_TARGET_ID,
    junctionMesh,
    WAVEGUIDE_EAST_RELAY_ID,
    ctx.waveguideController,
  );
  ctx.interactionRegistry.register(target);

  ctx.geo.label('WAVEGUIDE JUNCTION', new Vector3(3, RY + 2.3, 20), 2.5);
}
