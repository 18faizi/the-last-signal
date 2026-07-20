/**
 * Hiding spot geometry + interaction targets (Milestone 0.9).
 *
 * Each authored spot gets a simple greybox prop (open-fronted cabinet /
 * locker shell, desk void marker, alcove shadow box) built from
 * NON-physics decorative meshes — the player's collider is parked INSIDE
 * the prop while hidden, so the shells deliberately have no Havok bodies
 * (they still block the threat's LOS probe because they stay pickable).
 * Registers a HidingSpotTarget per spot ("[E] HIDE" via the standard
 * interaction contract) and the definitions into the HidingSpotRegistry.
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { HidingSpotTarget } from '../../../game/interaction/hiding/HidingSpotTarget';
import type { HidingSpotRegistry } from '../../../game/threat/stealth/HidingSpotRegistry';
import type { ThreatRuntimeState } from '../../../game/threat/ThreatRuntimeState';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import {
  FACILITY_HIDING_SPOTS,
  HIDE_ALCOVE_RELAY,
  HIDE_CABINET_RELAY,
  HIDE_LOCKER_STAIRWELL,
  HIDE_UNDER_DESK,
} from './facilityThreatDefinitions';

export interface HidingSpotsHandle {
  dispose(): void;
}

/** Mutable shared flag the director's "enable hiding prompts" action flips. */
export interface HidingPromptGate {
  enabled: boolean;
}

export function buildHidingSpots(
  ctx: FacilitySceneContext,
  scene: Scene,
  registry: HidingSpotRegistry,
  threatRuntimeState: ThreatRuntimeState,
  promptGate: HidingPromptGate,
): HidingSpotsHandle {
  const material = new StandardMaterial('fg-hide-mat', scene);
  material.diffuseColor = new Color3(0.16, 0.18, 0.2);
  material.specularColor = new Color3(0, 0, 0);

  const meshes: Mesh[] = [];
  const shell = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ): Mesh => {
    const mesh = CreateBox(name, { width: w, height: h, depth: d }, scene);
    mesh.position.set(x, y, z);
    mesh.material = material;
    // Pickable (blocks the LOS probe) but no physics body — the hidden
    // player's collider parks inside without collision conflicts.
    mesh.isPickable = true;
    meshes.push(mesh);
    return mesh;
  };

  // Equipment cabinet, relay level east wall (open west face implied).
  shell('fg-hide-mesh-cabinet-back', 9.3, 4.1, 24, 0.15, 2.2, 1.4);
  shell('fg-hide-mesh-cabinet-side-n', 8.6, 4.1, 24.72, 1.4, 2.2, 0.12);
  shell('fg-hide-mesh-cabinet-side-s', 8.6, 4.1, 23.28, 1.4, 2.2, 0.12);
  shell('fg-hide-mesh-cabinet-top', 8.6, 5.2, 24, 1.4, 0.12, 1.4);

  // Maintenance locker, control-room west wall near the stairwell.
  shell('fg-hide-mesh-locker-back', -9.7, 1.1, 22.5, 0.12, 2.2, 1.1);
  shell('fg-hide-mesh-locker-side-n', -9.25, 1.1, 23.08, 1.0, 2.2, 0.1);
  shell('fg-hide-mesh-locker-side-s', -9.25, 1.1, 21.92, 1.0, 2.2, 0.1);
  shell('fg-hide-mesh-locker-top', -9.25, 2.2, 22.5, 1.0, 0.1, 1.1);

  // Under-desk void marker (the comms desk itself is built by
  // buildControlBuilding; this thin skirt panel reads as the hiding gap).
  shell('fg-hide-mesh-desk-skirt', -4, 0.35, 17.55, 3.6, 0.7, 0.08);

  // Dark alcove, relay level west wall.
  shell('fg-hide-mesh-alcove-back', -9.6, 4.2, 18.6, 0.12, 2.4, 1.6);
  shell('fg-hide-mesh-alcove-side-n', -9.0, 4.2, 19.42, 1.3, 2.4, 0.12);
  shell('fg-hide-mesh-alcove-side-s', -9.0, 4.2, 17.78, 1.3, 2.4, 0.12);

  const spotMeshes = new Map<string, Mesh[]>([
    [HIDE_CABINET_RELAY, meshes.slice(0, 4)],
    [HIDE_LOCKER_STAIRWELL, meshes.slice(4, 8)],
    [HIDE_UNDER_DESK, meshes.slice(8, 9)],
    [HIDE_ALCOVE_RELAY, meshes.slice(9, 12)],
  ]);

  const targets: HidingSpotTarget[] = [];
  for (const def of FACILITY_HIDING_SPOTS) {
    registry.register(def);
    const target = new HidingSpotTarget(
      def,
      spotMeshes.get(def.id) ?? [],
      registry,
      (spotId) => threatRuntimeState.recordHidingSpotDiscovered(spotId),
      () => promptGate.enabled,
    );
    ctx.interactionRegistry.register(target);
    targets.push(target);
  }

  return {
    dispose(): void {
      for (const mesh of meshes) mesh.dispose(false, true);
      material.dispose();
    },
  };
}
