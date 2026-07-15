/**
 * Sliding door: translates along X or Z when opening.
 *
 * Same physics strategy as HingedDoorMotion: ANIMATED body with
 * disablePreStep = false so Havok tracks the leaf position each step.
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
import type { SlidingDoorConfig } from './DoorDefinition';
import type { DoorMotion } from './DoorMotion';
import { DOOR_COLOR } from './HingedDoorMotion';

export class SlidingDoorMotion implements DoorMotion {
  readonly meshes: readonly AbstractMesh[];

  private readonly leaf: Mesh;
  private readonly aggregate: PhysicsAggregate;
  private readonly closedPosition: Vector3;
  private readonly openOffset: Vector3;

  constructor(
    id: string,
    config: SlidingDoorConfig,
    worldPosition: Vector3,
    scene: Scene,
    color: Color3 = DOOR_COLOR,
  ) {
    const thickness = config.thickness ?? 0.08;
    const slideAxis = config.slideAxis ?? 'x';
    const slideDistance = config.slideDistance ?? config.width;

    const leaf = CreateBox(
      `door-leaf-${id}`,
      { width: config.width, height: config.height, depth: thickness },
      scene,
    );
    leaf.position.copyFrom(worldPosition);

    const mat = new StandardMaterial(`door-mat-${id}`, scene);
    mat.diffuseColor = color.clone();
    mat.specularColor = Color3.Black();
    leaf.material = mat;
    this.leaf = leaf;
    this.closedPosition = worldPosition.clone();

    if (slideAxis === 'x') {
      this.openOffset = new Vector3(slideDistance, 0, 0);
    } else {
      this.openOffset = new Vector3(0, 0, slideDistance);
    }

    const agg = new PhysicsAggregate(leaf, PhysicsShapeType.BOX, { mass: 0 }, scene);
    agg.body.setMotionType(PhysicsMotionType.ANIMATED);
    agg.body.disablePreStep = false;
    agg.shape.filterMembershipMask = FILTER_GROUP_WORLD;
    agg.shape.filterCollideMask = FILTER_GROUP_PLAYER | FILTER_GROUP_WORLD;
    this.aggregate = agg;

    this.meshes = [leaf];
  }

  applyFraction(fraction: number): void {
    this.leaf.position.set(
      this.closedPosition.x + this.openOffset.x * fraction,
      this.closedPosition.y + this.openOffset.y * fraction,
      this.closedPosition.z + this.openOffset.z * fraction,
    );
  }

  setColor(color: Color3): void {
    const mat = this.leaf.material as StandardMaterial;
    mat.diffuseColor = color;
  }

  dispose(): void {
    this.aggregate.dispose();
  }
}
