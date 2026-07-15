/**
 * Factory: given a PickupDefinition and world position, builds the mesh,
 * creates the appropriate InteractionTarget and registers it with the registry.
 *
 * Returns the created target so callers can also register it directly if they
 * want to hold a reference (e.g. test bridge).
 */
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { InventoryService } from '../inventory/InventoryService';
import type { InteractionRegistry } from '../interaction/InteractionRegistry';
import type { PickupDefinition } from './PickupDefinition';
import { PickupInteractionTarget } from './PickupInteractionTarget';
import { InspectablePickupTarget } from './InspectablePickupTarget';

export type AnyPickupTarget = PickupInteractionTarget | InspectablePickupTarget;

/**
 * Build a pickup mesh and register the appropriate interaction target.
 * Returns the registered target.
 */
export function createPickup(
  def: PickupDefinition,
  worldPosition: Vector3,
  scene: Scene,
  inventory: InventoryService,
  registry: InteractionRegistry,
): AnyPickupTarget {
  // Simple key/card shape in scene.
  const mesh = CreateBox(
    `pickup-mesh-${def.id}`,
    { width: 0.12, height: 0.06, depth: 0.28 },
    scene,
  );
  mesh.position.copyFrom(worldPosition);

  const mat = new StandardMaterial(`pickup-mat-${def.id}`, scene);
  mat.diffuseColor = new Color3(0.75, 0.65, 0.3);
  mat.specularColor = new Color3(0.5, 0.5, 0.3);
  mesh.material = mat;

  const mode = def.mode ?? 'direct';
  let target: AnyPickupTarget;

  if (mode === 'inspect-before-collect') {
    target = new InspectablePickupTarget(def, [mesh], inventory);
  } else {
    target = new PickupInteractionTarget(def, [mesh], inventory);
  }

  registry.register(target);
  return target;
}
