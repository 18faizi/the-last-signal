/**
 * Hinged door: rotates around a vertical axis at one edge.
 *
 * Physics: PhysicsMotionType.ANIMATED (kinematic) body so Havok reads the
 * mesh transform each physics step. disablePreStep = false on the body.
 * This means the door blocks the player CharacterController while moving.
 *
 * The pivot mesh sits at the hinge edge; the door leaf is a child offset
 * so that rotation feels natural. The PhysicsAggregate is placed on the
 * door leaf so the collider stays centred on the leaf's world position.
 */
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { PhysicsMotionType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import type { Scene } from '@babylonjs/core/scene';
import { FILTER_GROUP_PLAYER, FILTER_GROUP_WORLD } from '../physics/PhysicsFilters';
import type { HingedDoorConfig } from './DoorDefinition';
import type { DoorMotion } from './DoorMotion';

export const DOOR_COLOR = new Color3(0.36, 0.34, 0.3);
export const DOOR_COLOR_LOCKED = new Color3(0.5, 0.25, 0.22);
export const DOOR_COLOR_UNLOCKED = new Color3(0.3, 0.45, 0.32);

export class HingedDoorMotion implements DoorMotion {
  readonly meshes: readonly AbstractMesh[];

  private readonly pivot: Mesh;
  private readonly leaf: Mesh;
  private readonly aggregate: PhysicsAggregate;
  private readonly openAngle: number;

  constructor(
    id: string,
    config: HingedDoorConfig,
    worldPosition: Vector3,
    scene: Scene,
    color: Color3 = DOOR_COLOR,
  ) {
    const thickness = config.thickness ?? 0.08;
    this.openAngle = config.openAngle ?? Math.PI / 2;
    const hingeOnLeft = config.hingeOnLeft !== false;

    // Pivot node at the hinge edge position.
    const pivot = CreateBox(
      `door-pivot-${id}`,
      { width: 0.001, height: 0.001, depth: 0.001 },
      scene,
    );
    pivot.position.copyFrom(worldPosition);
    pivot.isPickable = false;
    pivot.isVisible = false;
    this.pivot = pivot;

    // Door leaf parented to the pivot, offset so it swings around the hinge.
    const halfWidth = config.width / 2;
    const leafOffsetX = hingeOnLeft ? halfWidth : -halfWidth;
    const leaf = CreateBox(
      `door-leaf-${id}`,
      { width: config.width, height: config.height, depth: thickness },
      scene,
    );
    leaf.parent = pivot;
    leaf.position.set(leafOffsetX, 0, 0);

    const mat = new StandardMaterial(`door-mat-${id}`, scene);
    mat.diffuseColor = color.clone();
    mat.specularColor = Color3.Black();
    leaf.material = mat;
    this.leaf = leaf;

    // ANIMATED (kinematic) aggregate on the leaf so physics knows where it is.
    const agg = new PhysicsAggregate(leaf, PhysicsShapeType.BOX, { mass: 0 }, scene);
    // ANIMATED = 1 (kinematic): moves via transform, blocks other bodies.
    agg.body.setMotionType(PhysicsMotionType.ANIMATED);
    agg.body.disablePreStep = false;
    agg.shape.filterMembershipMask = FILTER_GROUP_WORLD;
    agg.shape.filterCollideMask = FILTER_GROUP_PLAYER | FILTER_GROUP_WORLD;
    this.aggregate = agg;

    this.meshes = [leaf];
  }

  applyFraction(fraction: number): void {
    this.pivot.rotation.y = fraction * this.openAngle;
  }

  setColor(color: Color3): void {
    const mat = this.leaf.material as StandardMaterial;
    mat.diffuseColor = color;
  }

  dispose(): void {
    this.aggregate.dispose();
  }
}
