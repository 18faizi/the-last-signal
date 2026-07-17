/**
 * Mechanical antenna dish assemblies for the rooftop deck (Milestone 0.8).
 *
 * Extends M0.5's buildRooftopAntennaDeck.ts greybox placeholders with real
 * per-array mechanical representations: pedestal (static, collidable —
 * reuses ctx.geo.course.pillar like the rest of the greybox), azimuth base
 * (rotates about Y), elevation hinge (tilts about X), dish reflector, feed
 * horn (rotates about Z for polarization), and a status light.
 *
 * Every part EXCEPT the static pedestal is a plain, non-physics,
 * non-pickable mesh (`isPickable = false`, no Havok aggregate) — mechanical
 * parts are only interactable through the registered antenna cabinet/
 * junction-box InteractionTargets, never by raw mesh click, and moving a
 * KINEMATIC transform never pushes the player (no dynamic/tumbling bodies
 * anywhere in this file).
 *
 * Visual transforms are driven by ONE scoped onBeforeRenderObservable that
 * reads AntennaController.getMechanicalState()/getControlState() — this
 * does NOT add a second engine render loop, it hooks the scene's existing
 * per-frame observable exactly like every other mechanical system in this
 * codebase (doors, generator, receiver).
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import type { AntennaArrayDefinition } from '../../../game/antenna/AntennaArrayDefinition';
import type { AntennaController } from '../../../game/antenna/AntennaController';
import type { AntennaControlState } from '../../../game/antenna/AntennaControlState';

const DEG2RAD = Math.PI / 180;

export interface DishAssemblyHandle {
  dispose(): void;
}

interface AssemblyRuntime {
  readonly def: AntennaArrayDefinition;
  readonly azimuthNode: TransformNode;
  readonly elevationNode: TransformNode;
  readonly feedHorn: Mesh;
  readonly statusLight: Mesh;
  readonly statusMaterial: StandardMaterial;
}

function statusColor(state: AntennaControlState): Color3 {
  switch (state) {
    case 'Aligned':
      return new Color3(0.15, 0.85, 0.2);
    case 'AlignedCandidate':
    case 'Moving':
      return new Color3(0.85, 0.75, 0.1);
    case 'Fault':
      return new Color3(0.85, 0.1, 0.1);
    case 'Offline':
    case 'Unavailable':
    default:
      return new Color3(0.3, 0.3, 0.3);
  }
}

function buildAssembly(
  scene: Scene,
  ctx: FacilitySceneContext,
  def: AntennaArrayDefinition,
  position: Vector3,
): AssemblyRuntime {
  ctx.geo.course.pillar(`fac-antenna-pedestal-${def.id}`, position, 0.3, 1.4);

  const azimuthNode = new TransformNode(`fac-antenna-az-${def.id}`, scene);
  azimuthNode.position = position.add(new Vector3(0, 1.4, 0));

  const elevationNode = new TransformNode(`fac-antenna-el-${def.id}`, scene);
  elevationNode.parent = azimuthNode;

  const dish = CreateBox(`fac-antenna-dish-${def.id}`, { width: 2, height: 0.12, depth: 2 }, scene);
  dish.parent = elevationNode;
  dish.position.set(0, 0, 0.6);
  dish.isPickable = false;
  const dishMat = new StandardMaterial(`fac-antenna-dish-mat-${def.id}`, scene);
  dishMat.diffuseColor = ctx.materials.palette.metal.diffuseColor;
  dish.material = dishMat;

  const feedHorn = CreateBox(
    `fac-antenna-feed-${def.id}`,
    { width: 0.15, height: 0.15, depth: 0.6 },
    scene,
  );
  feedHorn.parent = elevationNode;
  feedHorn.position.set(0, 0.2, -0.3);
  feedHorn.isPickable = false;
  const feedMat = new StandardMaterial(`fac-antenna-feed-mat-${def.id}`, scene);
  feedMat.diffuseColor = new Color3(0.2, 0.2, 0.25);
  feedHorn.material = feedMat;

  const statusLight = CreateSphere(`fac-antenna-status-${def.id}`, { diameter: 0.2 }, scene);
  statusLight.parent = azimuthNode;
  statusLight.position.set(0, 0.5, 0);
  statusLight.isPickable = false;
  const statusMaterial = new StandardMaterial(`fac-antenna-status-mat-${def.id}`, scene);
  statusMaterial.diffuseColor = statusColor('Offline');
  statusMaterial.emissiveColor = statusColor('Offline').scale(0.6);
  statusLight.material = statusMaterial;

  return { def, azimuthNode, elevationNode, feedHorn, statusLight, statusMaterial };
}

/**
 * Builds all 3 array assemblies (North Dish, East Relay, Tower Diagnostic
 * Loop) at fixed rooftop positions and starts the single scoped tick
 * observer. Returns a disposal handle that removes the observer and every
 * mesh/material/TransformNode created here.
 */
export function buildDishAssemblies(
  ctx: FacilitySceneContext,
  scene: Scene,
  controller: AntennaController,
  arrays: readonly AntennaArrayDefinition[],
  positions: ReadonlyMap<string, Vector3>,
): DishAssemblyHandle {
  const assemblies: AssemblyRuntime[] = [];
  for (const def of arrays) {
    const position = positions.get(def.id) ?? new Vector3(0, 6, 20);
    assemblies.push(buildAssembly(scene, ctx, def, position));
  }

  let observer: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    for (const assembly of assemblies) {
      const mech = controller.getMechanicalState(assembly.def.id);
      if (mech === undefined) continue;
      assembly.azimuthNode.rotation.y = mech.currentAzimuthDeg * DEG2RAD;
      assembly.elevationNode.rotation.x = -mech.currentElevationDeg * DEG2RAD;
      assembly.feedHorn.rotation.z = mech.currentPolarizationDeg * DEG2RAD;

      const state = controller.getControlState(assembly.def.id);
      const color = statusColor(state);
      assembly.statusMaterial.diffuseColor = color;
      assembly.statusMaterial.emissiveColor = color.scale(0.6);
    }
  });

  return {
    dispose: () => {
      if (observer !== null) {
        scene.onBeforeRenderObservable.remove(observer);
        observer = null;
      }
      for (const assembly of assemblies) {
        assembly.statusLight.dispose();
        assembly.feedHorn.dispose();
        assembly.elevationNode.dispose();
        assembly.azimuthNode.dispose();
      }
    },
  };
}
