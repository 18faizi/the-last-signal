/**
 * Antenna control cabinet geometry + 'antenna'-kind interaction target.
 * Mirrors buildReceiverConsole.ts's structure exactly: this builder never
 * touches PowerNetwork directly — power on/off arrives exclusively via
 * facilityAntennaBindings.ts's PoweredStateBinding subscription calling
 * AntennaController.powerOn()/powerOff().
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import { createAntennaInteractionTarget } from '../../../game/antenna/AntennaInteractionTarget';

export const ANTENNA_CABINET_TARGET_ID = 'fg-antenna-cabinet';

export function buildAntennaControls(ctx: FacilitySceneContext, scene: Scene): void {
  const RY = 6;
  const cabinetMesh = CreateBox(
    'fg-antenna-cabinet-mesh',
    { width: 1, height: 2, depth: 0.6 },
    scene,
  );
  cabinetMesh.position.set(-8, RY + 1, 22);
  const cabinetMat = new StandardMaterial('fg-antenna-cabinet-mat', scene);
  cabinetMat.diffuseColor = new Color3(0.35, 0.2, 0.1);
  cabinetMat.specularColor = new Color3(0.05, 0.05, 0.05);
  cabinetMesh.material = cabinetMat;
  cabinetMesh.isPickable = true;

  const updateMaterial = () => {
    const powered = ctx.antennaController.isPowered;
    cabinetMat.diffuseColor = powered ? new Color3(0.25, 0.55, 0.3) : new Color3(0.35, 0.2, 0.1);
    cabinetMat.emissiveColor = powered ? new Color3(0.05, 0.15, 0.05) : new Color3(0, 0, 0);
  };
  updateMaterial();

  const target = createAntennaInteractionTarget(
    ANTENNA_CABINET_TARGET_ID,
    cabinetMesh,
    ctx.antennaController,
    scene,
    () => ctx.antennaController.isPowered,
  );
  ctx.interactionRegistry.register(target);

  ctx.geo.label('ANTENNA CONTROLS', new Vector3(-8, RY + 2.1, 22), 2.5);

  // Cheap, event-free liveness poll for the cabinet color piggybacks on the
  // same tick the antenna target's own observer already runs — rather than
  // adding a second observer here, subscribe to typed events instead
  // (spec's documented preference for discrete-state changes).
  ctx.antennaController.subscribe((event) => {
    if (event.kind === 'PowerRestored' || event.kind === 'PowerLost') {
      updateMaterial();
    }
  });
}
