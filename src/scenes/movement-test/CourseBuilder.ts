import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
// Side-effect imports: with subpath (tree-shaken) imports, the
// createDynamicTexture/updateDynamicTexture engine methods live in separate
// extension modules — one per backend. Omitting the WebGPU one crashes scene
// creation on WebGPU-capable browsers while WebGL keeps working.
import '@babylonjs/core/Engines/Extensions/engine.dynamicTexture';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import type { Scene } from '@babylonjs/core/scene';
import { FILTER_GROUP_PLAYER, FILTER_GROUP_WORLD } from '../../game/physics/PhysicsFilters';

/**
 * Helpers for building grey-box geometry: primitive meshes with flat
 * development materials and static Havok colliders carrying the WORLD
 * collision filter so player probes can target them selectively.
 */

/** Restrained development palette; surfaces are color-coded by purpose. */
export const COURSE_COLORS = {
  ground: new Color3(0.2, 0.22, 0.26),
  wall: new Color3(0.3, 0.32, 0.38),
  rampWalkable: new Color3(0.24, 0.36, 0.28),
  rampLimit: new Color3(0.42, 0.4, 0.24),
  rampSteep: new Color3(0.45, 0.26, 0.24),
  step: new Color3(0.28, 0.32, 0.42),
  tunnel: new Color3(0.34, 0.28, 0.4),
  platform: new Color3(0.26, 0.36, 0.42),
  pillar: new Color3(0.36, 0.36, 0.36),
} as const;

export class CourseBuilder {
  private readonly scene: Scene;
  private readonly materials = new Map<string, StandardMaterial>();
  private readonly aggregates: PhysicsAggregate[] = [];
  private readonly labelTextures: DynamicTexture[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
  }

  material(name: string, color: Color3): StandardMaterial {
    let material = this.materials.get(name);
    if (material === undefined) {
      material = new StandardMaterial(`course-mat-${name}`, this.scene);
      material.diffuseColor = color;
      material.specularColor = Color3.Black();
      this.materials.set(name, material);
    }
    return material;
  }

  /**
   * Static box collider. `rotationX` (radians) supports ramps — the Havok
   * BOX shape follows the mesh's world rotation.
   */
  box(
    name: string,
    options: {
      width: number;
      height: number;
      depth: number;
      position: Vector3;
      rotationX?: number;
      rotationY?: number;
      color: Color3;
    },
  ): Mesh {
    const mesh = CreateBox(
      name,
      { width: options.width, height: options.height, depth: options.depth },
      this.scene,
    );
    mesh.position.copyFrom(options.position);
    mesh.rotation.x = options.rotationX ?? 0;
    mesh.rotation.y = options.rotationY ?? 0;
    mesh.material = this.material(options.color.toHexString(), options.color);
    this.addStaticCollider(mesh, PhysicsShapeType.BOX);
    return mesh;
  }

  pillar(name: string, position: Vector3, diameter: number, height: number): Mesh {
    const mesh = CreateCylinder(name, { diameter, height, tessellation: 16 }, this.scene);
    mesh.position.copyFrom(position);
    mesh.material = this.material('pillar', COURSE_COLORS.pillar);
    this.addStaticCollider(mesh, PhysicsShapeType.CYLINDER);
    return mesh;
  }

  /**
   * Small floating development label (DynamicTexture on a plane; no external
   * assets). Non-colliding, unpickable.
   */
  label(text: string, position: Vector3): Mesh {
    const texture = new DynamicTexture(
      `label-tex-${text}`,
      { width: 512, height: 128 },
      this.scene,
      false,
    );
    texture.hasAlpha = true;
    texture.drawText(text, null, 84, 'bold 56px system-ui', '#d8dbe4', 'transparent', true);
    this.labelTextures.push(texture);

    const material = new StandardMaterial(`label-mat-${text}`, this.scene);
    material.diffuseTexture = texture;
    material.emissiveColor = new Color3(0.85, 0.87, 0.92);
    material.useAlphaFromDiffuseTexture = true;
    material.backFaceCulling = false;

    const plane = CreatePlane(`label-${text}`, { width: 3, height: 0.75 }, this.scene);
    plane.position.copyFrom(position);
    plane.billboardMode = 7; // BILLBOARDMODE_ALL: labels always face the camera
    plane.material = material;
    plane.isPickable = false;
    return plane;
  }

  /** Disposes physics aggregates and label textures (meshes die with the scene). */
  dispose(): void {
    for (const aggregate of this.aggregates) {
      aggregate.dispose();
    }
    this.aggregates.length = 0;
    for (const texture of this.labelTextures) {
      texture.dispose();
    }
    this.labelTextures.length = 0;
  }

  private addStaticCollider(mesh: Mesh, shapeType: PhysicsShapeType): void {
    const aggregate = new PhysicsAggregate(mesh, shapeType, { mass: 0 }, this.scene);
    aggregate.shape.filterMembershipMask = FILTER_GROUP_WORLD;
    aggregate.shape.filterCollideMask = FILTER_GROUP_PLAYER | FILTER_GROUP_WORLD;
    this.aggregates.push(aggregate);
  }
}
