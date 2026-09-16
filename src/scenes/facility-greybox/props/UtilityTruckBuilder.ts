/**
 * Abandoned Utility Truck Prop Builder.
 *
 * Implements a static, non-drivable facility utility truck positioned at the
 * mountain approach boundary (X = -54, Z = 7).
 *
 * Features:
 * - Detailed low-poly body: cab cabin, front hood, windshield, heavy-duty wheels with snow chains.
 * - Flatbed rear with emergency equipment boxes and radio mast.
 * - Walk-in / inspectable cab interior containing steering wheel, dashboard, and the
 *   interactive clue document 'doc-truck-dispatch-slip'.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import { createReadableDocument } from '../../interaction-test/testTargets/documentTargets';

export interface UtilityTruckPropHandle {
  readonly rootMesh: Mesh;
  dispose(): void;
}

export function buildUtilityTruck(
  ctx: FacilitySceneContext,
  position = new Vector3(-53, 0, 7.5),
): UtilityTruckPropHandle {
  const { scene, geo, materials, interactionRegistry } = ctx;

  const truckMeshes: Mesh[] = [];
  const truckMaterials: StandardMaterial[] = [];

  // Materials
  const bodyPaintMat = new StandardMaterial('truck-body-mat', scene);
  bodyPaintMat.diffuseColor = new Color3(0.55, 0.42, 0.28); // Weathered desert-tan/orange paint
  bodyPaintMat.specularColor = new Color3(0.15, 0.15, 0.15);
  truckMaterials.push(bodyPaintMat);

  const darkTrimMat = new StandardMaterial('truck-trim-mat', scene);
  darkTrimMat.diffuseColor = new Color3(0.12, 0.14, 0.16); // Matte black bumper/chassis
  darkTrimMat.specularColor = new Color3(0.2, 0.2, 0.2);
  truckMaterials.push(darkTrimMat);

  const wheelMat = new StandardMaterial('truck-wheel-mat', scene);
  wheelMat.diffuseColor = new Color3(0.08, 0.08, 0.09); // Heavy tire rubber
  wheelMat.specularColor = new Color3(0.05, 0.05, 0.05);
  truckMaterials.push(wheelMat);

  const glassMat = new StandardMaterial('truck-glass-mat', scene);
  glassMat.diffuseColor = new Color3(0.3, 0.4, 0.5);
  glassMat.specularColor = new Color3(0.8, 0.8, 0.9);
  glassMat.alpha = 0.55;
  truckMaterials.push(glassMat);

  const headlampMat = new StandardMaterial('truck-headlamp-mat', scene);
  headlampMat.diffuseColor = new Color3(0.9, 0.85, 0.7);
  headlampMat.emissiveColor = new Color3(0.2, 0.18, 0.12); // Faint dead battery filament
  truckMaterials.push(headlampMat);

  const interiorMat = new StandardMaterial('truck-interior-mat', scene);
  interiorMat.diffuseColor = new Color3(0.18, 0.18, 0.2);
  truckMaterials.push(interiorMat);

  // Root anchor
  const root = CreateBox('prop-utility-truck-root', { size: 0.1 }, scene);
  root.position.copyFrom(position);
  root.isVisible = false;
  root.isPickable = false;
  truckMeshes.push(root);

  // 1. Heavy undercarriage chassis
  const chassis = CreateBox('truck-chassis', { width: 5.6, height: 0.4, depth: 2.2 }, scene);
  chassis.parent = root;
  chassis.position.set(0, 0.45, 0);
  chassis.material = darkTrimMat;
  chassis.isPickable = false;
  truckMeshes.push(chassis);

  // 2. Heavy-duty 4-wheel setup with snow chain detailing
  const wheelOffsets = [
    { x: -1.8, z: 1.15 },
    { x: -1.8, z: -1.15 },
    { x: 1.8, z: 1.15 },
    { x: 1.8, z: -1.15 },
  ];

  for (let i = 0; i < wheelOffsets.length; i++) {
    const w = wheelOffsets[i];
    if (!w) continue;
    const tire = CreateCylinder(
      `truck-wheel-${i}`,
      { height: 0.45, diameter: 0.9, tessellation: 16 },
      scene,
    );
    tire.parent = root;
    tire.rotation.x = Math.PI / 2;
    tire.position.set(w.x, 0.45, w.z);
    tire.material = wheelMat;
    tire.isPickable = false;
    truckMeshes.push(tire);
  }

  // 3. Front engine hood
  const hood = CreateBox('truck-hood', { width: 1.7, height: 0.9, depth: 2.1 }, scene);
  hood.parent = root;
  hood.position.set(1.7, 1.05, 0);
  hood.material = bodyPaintMat;
  hood.isPickable = false;
  truckMeshes.push(hood);

  // Front grill & bumper
  const grill = CreateBox('truck-grill', { width: 0.15, height: 0.7, depth: 1.8 }, scene);
  grill.parent = root;
  grill.position.set(2.55, 0.95, 0);
  grill.material = darkTrimMat;
  grill.isPickable = false;
  truckMeshes.push(grill);

  const frontBumper = CreateBox('truck-bumper', { width: 0.35, height: 0.35, depth: 2.3 }, scene);
  frontBumper.parent = root;
  frontBumper.position.set(2.65, 0.5, 0);
  frontBumper.material = darkTrimMat;
  frontBumper.isPickable = false;
  truckMeshes.push(frontBumper);

  // Headlamps
  for (const z of [-0.7, 0.7]) {
    const lamp = CreateBox(`truck-headlamp-${z}`, { width: 0.1, height: 0.25, depth: 0.3 }, scene);
    lamp.parent = root;
    lamp.position.set(2.56, 1.1, z);
    lamp.material = headlampMat;
    lamp.isPickable = false;
    truckMeshes.push(lamp);
  }

  // 4. Cab Cabin Exterior
  // Cab roof
  const cabRoof = CreateBox('truck-cab-roof', { width: 1.6, height: 0.12, depth: 2.1 }, scene);
  cabRoof.parent = root;
  cabRoof.position.set(0.1, 2.15, 0);
  cabRoof.material = bodyPaintMat;
  cabRoof.isPickable = false;
  truckMeshes.push(cabRoof);

  // Cab back wall
  const cabBack = CreateBox('truck-cab-back', { width: 0.15, height: 1.4, depth: 2.1 }, scene);
  cabBack.parent = root;
  cabBack.position.set(-0.75, 1.45, 0);
  cabBack.material = bodyPaintMat;
  cabBack.isPickable = false;
  truckMeshes.push(cabBack);

  // Cab windshield
  const windshield = CreateBox(
    'truck-windshield',
    { width: 0.08, height: 0.75, depth: 1.9 },
    scene,
  );
  windshield.parent = root;
  windshield.position.set(0.85, 1.7, 0);
  windshield.rotation.z = -0.3; // Raked windshield angle
  windshield.material = glassMat;
  windshield.isPickable = false;
  truckMeshes.push(windshield);

  // Side door frames
  for (const z of [-1.02, 1.02]) {
    const doorBottom = CreateBox(
      `truck-door-bottom-${z}`,
      { width: 1.5, height: 0.6, depth: 0.1 },
      scene,
    );
    doorBottom.parent = root;
    doorBottom.position.set(0.05, 0.95, z);
    doorBottom.material = bodyPaintMat;
    doorBottom.isPickable = false;
    truckMeshes.push(doorBottom);

    const doorGlass = CreateBox(
      `truck-door-glass-${z}`,
      { width: 1.2, height: 0.55, depth: 0.05 },
      scene,
    );
    doorGlass.parent = root;
    doorGlass.position.set(0.05, 1.6, z);
    doorGlass.material = glassMat;
    doorGlass.isPickable = false;
    truckMeshes.push(doorGlass);
  }

  // 5. Cab Interior (Walk-in / Inspectable)
  // Dashboard
  const dashboard = CreateBox(
    'truck-interior-dash',
    { width: 0.45, height: 0.35, depth: 1.8 },
    scene,
  );
  dashboard.parent = root;
  dashboard.position.set(0.65, 1.25, 0);
  dashboard.material = interiorMat;
  dashboard.isPickable = false;
  truckMeshes.push(dashboard);

  // Steering wheel
  const steeringWheel = CreateCylinder(
    'truck-steering-wheel',
    { height: 0.06, diameter: 0.35, tessellation: 12 },
    scene,
  );
  steeringWheel.parent = root;
  steeringWheel.rotation.z = 0.5;
  steeringWheel.position.set(0.48, 1.35, 0.45);
  steeringWheel.material = darkTrimMat;
  steeringWheel.isPickable = false;
  truckMeshes.push(steeringWheel);

  // Driver & passenger seats
  for (const z of [-0.45, 0.45]) {
    const seatBase = CreateBox(
      `truck-seat-base-${z}`,
      { width: 0.6, height: 0.35, depth: 0.6 },
      scene,
    );
    seatBase.parent = root;
    seatBase.position.set(-0.15, 0.8, z);
    seatBase.material = interiorMat;
    seatBase.isPickable = false;
    truckMeshes.push(seatBase);

    const seatBack = CreateBox(
      `truck-seat-back-${z}`,
      { width: 0.18, height: 0.7, depth: 0.55 },
      scene,
    );
    seatBack.parent = root;
    seatBack.position.set(-0.45, 1.3, z);
    seatBack.material = interiorMat;
    seatBack.isPickable = false;
    truckMeshes.push(seatBack);
  }

  // 6. Rear Cargo Flatbed
  const flatbed = CreateBox('truck-flatbed', { width: 2.1, height: 0.15, depth: 2.1 }, scene);
  flatbed.parent = root;
  flatbed.position.set(-1.75, 0.75, 0);
  flatbed.material = darkTrimMat;
  flatbed.isPickable = false;
  truckMeshes.push(flatbed);

  // Cargo flatbed side rails
  for (const z of [-1.02, 1.02]) {
    const rail = CreateBox(`truck-rail-${z}`, { width: 2.1, height: 0.45, depth: 0.08 }, scene);
    rail.parent = root;
    rail.position.set(-1.75, 1.0, z);
    rail.material = bodyPaintMat;
    rail.isPickable = false;
    truckMeshes.push(rail);
  }

  // Emergency cargo crates on the flatbed
  const crateA = CreateBox('truck-crate-a', { width: 0.7, height: 0.65, depth: 0.8 }, scene);
  crateA.parent = root;
  crateA.position.set(-1.4, 1.1, -0.4);
  crateA.material = materials.palette.wood;
  crateA.isPickable = false;
  truckMeshes.push(crateA);

  const crateB = CreateBox('truck-crate-b', { width: 0.8, height: 0.75, depth: 0.6 }, scene);
  crateB.parent = root;
  crateB.position.set(-2.1, 1.15, 0.3);
  crateB.material = darkTrimMat;
  crateB.isPickable = false;
  truckMeshes.push(crateB);

  // Coiled cable spool
  const cableSpool = CreateCylinder(
    'truck-cable-spool',
    { height: 0.5, diameter: 0.65, tessellation: 12 },
    scene,
  );
  cableSpool.parent = root;
  cableSpool.position.set(-1.5, 1.05, 0.5);
  cableSpool.material = darkTrimMat;
  cableSpool.isPickable = false;
  truckMeshes.push(cableSpool);

  // 7. Interactive Cab Interior Clue: Logistics Dispatch Slip
  // Placed on passenger seat/console for inspection
  const docPos = new Vector3(position.x + 0.5, position.y + 1.28, position.z - 0.4);
  const truckDoc = createReadableDocument(scene, docPos, {
    id: 'fg-doc-truck-dispatch-readable',
    documentId: 'doc-truck-dispatch-slip',
    label: 'VEHICLE 04 DISPATCH SLIP',
    rotationY: 0.2,
  });
  interactionRegistry.register(truckDoc);

  // 8. Solid physical bounding obstacle for truck body (player collides with vehicle body)
  geo.course.box('fac-truck-collision-box', {
    width: 5.4,
    height: 2.2,
    depth: 2.4,
    position: new Vector3(position.x, position.y + 1.1, position.z),
    color: materials.palette.exterior.diffuseColor,
  });

  return {
    rootMesh: root,
    dispose(): void {
      for (const m of truckMeshes) {
        m.dispose();
      }
      truckMeshes.length = 0;

      for (const mat of truckMaterials) {
        mat.dispose();
      }
      truckMaterials.length = 0;
    },
  };
}
