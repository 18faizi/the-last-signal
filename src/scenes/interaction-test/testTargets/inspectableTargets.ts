import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { AVAILABLE, type InspectableTarget } from '../../../game/interaction/InteractionTarget';

/**
 * Inspectable test targets built from primitive assemblies. The same build
 * function produces both the world mesh and the isolated inspection model,
 * so the inspection representation is a fresh assembly — the world mesh is
 * never moved or cloned-and-detached. The radio's knobs/antenna are child
 * meshes, exercising child→parent target resolution.
 */

function assembleFieldRadio(scene: Scene, prefix: string): TransformNode {
  const root = new TransformNode(`${prefix}-root`, scene);

  const bodyMat = new StandardMaterial(`${prefix}-body-mat`, scene);
  bodyMat.diffuseColor = new Color3(0.25, 0.3, 0.28);
  bodyMat.specularColor = Color3.Black();
  const detailMat = new StandardMaterial(`${prefix}-detail-mat`, scene);
  detailMat.diffuseColor = new Color3(0.15, 0.15, 0.17);

  const body = CreateBox(`${prefix}-body`, { width: 0.42, height: 0.26, depth: 0.14 }, scene);
  body.parent = root;
  body.material = bodyMat;

  const grille = CreateBox(`${prefix}-grille`, { width: 0.16, height: 0.16, depth: 0.02 }, scene);
  grille.parent = root;
  grille.position.set(-0.1, 0, -0.075);
  grille.material = detailMat;

  for (let i = 0; i < 2; i += 1) {
    const knob = CreateCylinder(`${prefix}-knob-${i}`, { diameter: 0.06, height: 0.04 }, scene);
    knob.parent = root;
    knob.rotation.x = Math.PI / 2;
    knob.position.set(0.08 + i * 0.09, 0.04, -0.08);
    knob.material = detailMat;
  }

  const antenna = CreateCylinder(`${prefix}-antenna`, { diameter: 0.015, height: 0.4 }, scene);
  antenna.parent = root;
  antenna.position.set(0.17, 0.31, 0);
  antenna.material = detailMat;

  return root;
}

function assembleRelayComponent(scene: Scene, prefix: string): TransformNode {
  const root = new TransformNode(`${prefix}-root`, scene);

  const baseMat = new StandardMaterial(`${prefix}-base-mat`, scene);
  baseMat.diffuseColor = new Color3(0.35, 0.3, 0.2);
  baseMat.specularColor = Color3.Black();
  const coilMat = new StandardMaterial(`${prefix}-coil-mat`, scene);
  coilMat.diffuseColor = new Color3(0.5, 0.32, 0.18);

  const base = CreateBox(`${prefix}-base`, { width: 0.3, height: 0.06, depth: 0.2 }, scene);
  base.parent = root;
  base.material = baseMat;

  const coil = CreateCylinder(`${prefix}-coil`, { diameter: 0.12, height: 0.16 }, scene);
  coil.parent = root;
  coil.position.set(-0.06, 0.11, 0);
  coil.material = coilMat;

  const armature = CreateBox(
    `${prefix}-armature`,
    { width: 0.16, height: 0.02, depth: 0.06 },
    scene,
  );
  armature.parent = root;
  armature.position.set(0.06, 0.16, 0);
  armature.rotation.z = -0.2;
  armature.material = baseMat;

  for (let i = 0; i < 3; i += 1) {
    const pin = CreateCylinder(`${prefix}-pin-${i}`, { diameter: 0.015, height: 0.06 }, scene);
    pin.parent = root;
    pin.position.set(0.1 - i * 0.08, -0.06, 0.06);
    pin.material = coilMat;
  }

  return root;
}

export function createFieldRadio(scene: Scene, position: Vector3): InspectableTarget {
  const world = assembleFieldRadio(scene, 'radio-world');
  world.position.copyFrom(position);
  const rootMeshes = world
    .getChildMeshes(true)
    .filter((mesh): mesh is Mesh => mesh.parent === world);

  return {
    id: 'test-field-radio',
    kind: 'inspect',
    meshes: rootMeshes,
    inspectionTitle: 'FIELD RADIO',
    inspectionDescription: 'Development prop — a battered portable receiver.',
    getPrompt: () => ({ verb: 'INSPECT', label: 'FIELD RADIO' }),
    getAvailability: () => AVAILABLE,
    interact: () => ({ status: 'completed' as const }),
    buildInspectionModel: (targetScene) => assembleFieldRadio(targetScene, 'radio-inspect'),
  };
}

export function createRelayComponent(scene: Scene, position: Vector3): InspectableTarget {
  const world = assembleRelayComponent(scene, 'relay-world');
  world.position.copyFrom(position);
  const rootMeshes = world
    .getChildMeshes(true)
    .filter((mesh): mesh is Mesh => mesh.parent === world);

  return {
    id: 'test-relay-component',
    kind: 'inspect',
    meshes: rootMeshes,
    inspectionTitle: 'RELAY COMPONENT',
    inspectionDescription: 'Development prop — a damaged electromechanical relay.',
    getPrompt: () => ({ verb: 'INSPECT', label: 'RELAY COMPONENT' }),
    getAvailability: () => AVAILABLE,
    interact: () => ({ status: 'completed' as const }),
    buildInspectionModel: (targetScene) => assembleRelayComponent(targetScene, 'relay-inspect'),
  };
}
