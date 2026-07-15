import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import type {
  SceneCreationContext,
  SceneDefinition,
  SceneHandle,
} from '../../core/scenes/SceneDefinition';

/**
 * Minimal development scene proving engine + physics work together:
 * a lit ground plane (static collider), a few primitives, and a dynamic
 * sphere that falls under gravity onto the ground.
 *
 * Deliberately restrained — this is a technical smoke scene, not a prototype
 * of the relay station.
 */
export const developmentSceneDefinition: SceneDefinition = {
  id: 'development',

  async create(context: SceneCreationContext): Promise<SceneHandle> {
    const scene = new Scene(context.engine);
    scene.clearColor = new Color4(0.05, 0.06, 0.08, 1);

    const camera = new ArcRotateCamera(
      'dev-camera',
      -Math.PI / 3,
      Math.PI / 3,
      18,
      new Vector3(0, 1, 0),
      scene,
    );
    camera.lowerRadiusLimit = 4;
    camera.upperRadiusLimit = 60;
    camera.attachControl(context.canvas, true);

    const light = new HemisphericLight('dev-light', new Vector3(0.2, 1, 0.1), scene);
    light.intensity = 0.9;
    light.groundColor = new Color3(0.1, 0.1, 0.15);

    const groundMaterial = new StandardMaterial('dev-ground-mat', scene);
    groundMaterial.diffuseColor = new Color3(0.16, 0.18, 0.22);
    const ground = CreateGround('dev-ground', { width: 24, height: 24 }, scene);
    ground.material = groundMaterial;

    const boxMaterial = new StandardMaterial('dev-box-mat', scene);
    boxMaterial.diffuseColor = new Color3(0.35, 0.38, 0.45);
    const staticBox = CreateBox('dev-static-box', { size: 2 }, scene);
    staticBox.position = new Vector3(3, 1, 0);
    staticBox.material = boxMaterial;

    const pillar = CreateBox('dev-pillar', { width: 1, depth: 1, height: 3 }, scene);
    pillar.position = new Vector3(-4, 1.5, -2);
    pillar.material = boxMaterial;

    const sphereMaterial = new StandardMaterial('dev-sphere-mat', scene);
    sphereMaterial.diffuseColor = new Color3(0.75, 0.45, 0.25);
    const fallingSphere = CreateSphere('dev-falling-sphere', { diameter: 1.5 }, scene);
    fallingSphere.position = new Vector3(0, 8, 0);
    fallingSphere.material = sphereMaterial;

    // Physics: ground and box are static colliders; the sphere is dynamic
    // and visibly falls onto the ground when the scene starts rendering.
    const physicsPlugin = await context.physics.enableForScene(scene);
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);
    new PhysicsAggregate(staticBox, PhysicsShapeType.BOX, { mass: 0 }, scene);
    new PhysicsAggregate(pillar, PhysicsShapeType.BOX, { mass: 0 }, scene);
    new PhysicsAggregate(
      fallingSphere,
      PhysicsShapeType.SPHERE,
      { mass: 1, restitution: 0.4 },
      scene,
    );
    context.onPhysicsReady();

    return {
      scene,
      markerText: 'Milestone 0.1 — Foundation Ready',
      dispose(): void {
        // Scene.dispose releases meshes, materials, lights and cameras; the
        // physics plugin is disposed explicitly since the service handed us
        // ownership of it.
        camera.detachControl();
        scene.dispose();
        physicsPlugin.dispose();
      },
    };
  },
};
