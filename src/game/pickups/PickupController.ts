/**
 * Factory: given a PickupDefinition and world position, builds the mesh,
 * creates the appropriate InteractionTarget and registers it with the registry.
 *
 * Returns the created target so callers can also register it directly if they
 * want to hold a reference (e.g. test bridge).
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { InventoryService } from '../inventory/InventoryService';
import type { InteractionRegistry } from '../interaction/InteractionRegistry';
import type { PickupDefinition } from './PickupDefinition';
import { PickupInteractionTarget } from './PickupInteractionTarget';
import { InspectablePickupTarget } from './InspectablePickupTarget';
import { KeyMeshBuilder } from '../../scenes/facility-greybox/props/KeyMeshBuilder';

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
  // Realistic 3D key/card/seal model
  const mesh = KeyMeshBuilder.buildPickupMesh(def, scene);
  mesh.name = `pickup-mesh-${def.id}`;
  mesh.position.copyFrom(worldPosition);
  mesh.isPickable = true;
  for (const child of mesh.getChildMeshes()) {
    child.isPickable = true;
  }

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
