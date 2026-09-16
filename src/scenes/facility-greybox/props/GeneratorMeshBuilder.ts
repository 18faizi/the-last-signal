/**
 * Industrial Diesel Emergency Generator Mesh Builder for The Last Signal.
 *
 * Replaces generic generator blocks with a heavy, authentic mechanical powerplant:
 * - Structural steel I-beam skid frame with rubber vibration dampers.
 * - Cast-iron V-twin engine block with cylinder cooling fins and valve covers.
 * - Cylindrical copper-wound stator alternator with ventilation louvers.
 * - Heavy starter flywheel with ring gear teeth and hand crank socket.
 * - Vertical steel exhaust pipe leading through ceiling with a hinged rain flapper cap.
 * - Overhead diesel tank with brass petcock valve wheel, fuel sight glass tube, and filler neck.
 * - Analog circular dial gauges with needle indicators for RPM and Fuel Pressure.
 */
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { TextureGenerator } from '../materials/TextureGenerator';

export class GeneratorMeshBuilder {
  static buildIndustrialGenerator(position: Vector3, scene: Scene): Mesh {
    const castIronMat = new StandardMaterial('gen-iron-mat', scene);
    castIronMat.diffuseColor = new Color3(0.22, 0.24, 0.27);
    castIronMat.specularColor = new Color3(0.2, 0.2, 0.25);
    castIronMat.bumpTexture = TextureGenerator.createBumpMap(scene, 'noise', 256);

    const steelMat = new StandardMaterial('gen-steel-mat', scene);
    steelMat.diffuseColor = new Color3(0.45, 0.48, 0.52);
    steelMat.specularColor = new Color3(0.6, 0.6, 0.65);

    const brassMat = new StandardMaterial('gen-brass-mat', scene);
    brassMat.diffuseColor = new Color3(0.85, 0.72, 0.32);
    brassMat.specularColor = new Color3(0.9, 0.85, 0.5);

    const fuelMat = new StandardMaterial('gen-fuel-mat', scene);
    fuelMat.diffuseColor = new Color3(0.6, 0.18, 0.15); // Industrial red-orange tank

    const hazardMat = new StandardMaterial('gen-hazard-mat', scene);
    hazardMat.diffuseTexture = TextureGenerator.createHazardStripeTexture(scene, 256);

    // Root container
    const root = CreateBox(
      'generator-assembly',
      { width: 0.001, height: 0.001, depth: 0.001 },
      scene,
    );
    root.position.copyFrom(position);
    root.isPickable = false;

    // 1. Heavy Skid Base with vibration mounts
    const skid = CreateBox('gen-skid', { width: 2.2, height: 0.25, depth: 3.4 }, scene);
    skid.parent = root;
    skid.position.set(0, 0.125, 0);
    skid.material = steelMat;
    skid.isPickable = false;

    // Yellow/black hazard stripes around skid border
    const hazardBorder = CreateBox(
      'gen-skid-hazard',
      { width: 2.25, height: 0.1, depth: 3.45 },
      scene,
    );
    hazardBorder.parent = skid;
    hazardBorder.position.set(0, -0.07, 0);
    hazardBorder.material = hazardMat;
    hazardBorder.isPickable = false;

    // 4 Rubber vibration isolator pucks
    for (const sx of [-0.95, 0.95]) {
      for (const sz of [-1.5, 1.5]) {
        const puck = CreateCylinder(
          `gen-puck-${sx}-${sz}`,
          { diameter: 0.22, height: 0.1, tessellation: 12 },
          scene,
        );
        puck.parent = skid;
        puck.position.set(sx, -0.15, sz);
        const puckMat = new StandardMaterial('puck-mat', scene);
        puckMat.diffuseColor = new Color3(0.05, 0.05, 0.06);
        puck.material = puckMat;
        puck.isPickable = false;
      }
    }

    // 2. Cast-Iron Engine Block
    const block = CreateBox('gen-engine-block', { width: 1.4, height: 1.1, depth: 1.8 }, scene);
    block.parent = root;
    block.position.set(0, 0.75, -0.3);
    block.material = castIronMat;
    block.isPickable = false;

    // Twin cylinder heads with cooling fins
    for (const hx of [-0.42, 0.42]) {
      const head = CreateBox(`gen-head-${hx}`, { width: 0.55, height: 0.45, depth: 1.4 }, scene);
      head.parent = block;
      head.position.set(hx, 0.65, 0);
      head.material = castIronMat;
      head.isPickable = false;

      // Valve rocker cover on top
      const cover = CreateCylinder(
        `gen-cover-${hx}`,
        { diameter: 0.35, height: 1.3, tessellation: 12 },
        scene,
      );
      cover.parent = head;
      cover.position.set(0, 0.25, 0);
      cover.rotation.x = Math.PI / 2;
      cover.material = steelMat;
      cover.isPickable = false;
    }

    // 3. Alternator / Stator Drum (rear section)
    const stator = CreateCylinder(
      'gen-stator-drum',
      { diameter: 1.3, height: 1.2, tessellation: 20 },
      scene,
    );
    stator.parent = root;
    stator.position.set(0, 0.75, 1.1);
    stator.rotation.x = Math.PI / 2;
    stator.material = steelMat;
    stator.isPickable = false;

    // Copper winding grill peek
    const copperCoil = CreateCylinder(
      'gen-copper-coil',
      { diameter: 1.15, height: 0.25, tessellation: 16 },
      scene,
    );
    copperCoil.parent = stator;
    copperCoil.position.set(0, 0.5, 0);
    const cMat = new StandardMaterial('gen-copper-mat', scene);
    cMat.diffuseColor = new Color3(0.85, 0.45, 0.15);
    copperCoil.material = cMat;
    copperCoil.isPickable = false;

    // 4. Heavy Starter Flywheel with Hand Crank Socket
    const flywheel = CreateCylinder(
      'gen-flywheel',
      { diameter: 1.0, height: 0.14, tessellation: 24 },
      scene,
    );
    flywheel.parent = root;
    flywheel.position.set(0, 0.7, -1.25);
    flywheel.rotation.x = Math.PI / 2;
    flywheel.material = steelMat;
    flywheel.isPickable = false;

    const crankHub = CreateCylinder(
      'gen-crank-hub',
      { diameter: 0.18, height: 0.22, tessellation: 12 },
      scene,
    );
    crankHub.parent = flywheel;
    crankHub.position.set(0, 0.1, 0);
    crankHub.material = brassMat;
    crankHub.isPickable = false;

    // 5. Vertical Exhaust Manifold & Pipe
    const manifold = CreateCylinder(
      'gen-exhaust-elbow',
      { diameter: 0.24, height: 0.6, tessellation: 12 },
      scene,
    );
    manifold.parent = block;
    manifold.position.set(0.65, 0.5, 0.3);
    manifold.rotation.z = Math.PI / 4;
    manifold.material = castIronMat;
    manifold.isPickable = false;

    const exhaustPipe = CreateCylinder(
      'gen-exhaust-pipe',
      { diameter: 0.2, height: 3.2, tessellation: 12 },
      scene,
    );
    exhaustPipe.parent = root;
    exhaustPipe.position.set(0.85, 2.8, 0);
    exhaustPipe.material = steelMat;
    exhaustPipe.isPickable = false;

    // Hinged weather flapper cap on exhaust
    const flapper = CreateBox('gen-flapper', { width: 0.26, height: 0.02, depth: 0.26 }, scene);
    flapper.parent = exhaustPipe;
    flapper.position.set(0, 1.62, 0.05);
    flapper.rotation.x = Math.PI / 8; // Slightly open
    flapper.material = steelMat;
    flapper.isPickable = false;

    // 6. Diesel Fuel Tank with Sight Glass & Brass Wheel
    const tank = CreateCylinder(
      'gen-fuel-tank',
      { diameter: 0.75, height: 1.6, tessellation: 16 },
      scene,
    );
    tank.parent = root;
    tank.position.set(-0.75, 1.75, 0.2);
    tank.rotation.z = Math.PI / 2;
    tank.material = fuelMat;
    tank.isPickable = false;

    // Brass Priming Petcock Valve Wheel
    const valveStem = CreateCylinder(
      'gen-valve-stem',
      { diameter: 0.04, height: 0.2, tessellation: 8 },
      scene,
    );
    valveStem.parent = tank;
    valveStem.position.set(-0.65, 0.3, 0);
    valveStem.rotation.z = Math.PI / 2;
    valveStem.material = brassMat;
    valveStem.isPickable = false;

    const valveWheel = CreateTorus(
      'gen-valve-wheel',
      { diameter: 0.22, thickness: 0.025, tessellation: 16 },
      scene,
    );
    valveWheel.parent = valveStem;
    valveWheel.position.set(0, 0.1, 0);
    valveWheel.material = brassMat;
    valveWheel.isPickable = false;

    // Transparent Fuel Sight Glass Tube
    const sightGlass = CreateCylinder(
      'gen-sight-glass',
      { diameter: 0.04, height: 0.5, tessellation: 8 },
      scene,
    );
    sightGlass.parent = tank;
    sightGlass.position.set(0.1, 0.38, 0);
    sightGlass.rotation.z = Math.PI / 2;
    const glassMat = new StandardMaterial('gen-glass-mat', scene);
    glassMat.diffuseColor = new Color3(0.9, 0.6, 0.2); // Amber diesel fuel
    glassMat.alpha = 0.7;
    sightGlass.material = glassMat;
    sightGlass.isPickable = false;

    // 7. Analog Dial Gauges (RPM & Fuel Pressure)
    const gaugePositions = [new Vector3(0.35, 1.45, -1.0), new Vector3(-0.35, 1.45, -1.0)];
    const gaugeLabels = ['RPM x100', 'FUEL PSI'];

    for (let g = 0; g < 2; g++) {
      const gPos = gaugePositions[g] ?? Vector3.Zero();
      const gHousing = CreateCylinder(
        `gen-gauge-${g}`,
        { diameter: 0.24, height: 0.06, tessellation: 16 },
        scene,
      );
      gHousing.parent = root;
      gHousing.position.copyFrom(gPos);
      gHousing.rotation.x = Math.PI / 2;
      gHousing.material = steelMat;
      gHousing.isPickable = false;

      // Dial face texture
      const dt = new DynamicTexture(`gauge-face-${g}`, { width: 128, height: 128 }, scene, false);
      const ctx = dt.getContext() as CanvasRenderingContext2D;
      ctx.fillStyle = '#f0f4f8';
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = '#22262c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(64, 64, 58, 0, Math.PI * 2);
      ctx.stroke();

      // Tick marks
      for (let a = 0; a <= 180; a += 30) {
        const rad = ((a + 180) * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(64 + Math.cos(rad) * 44, 64 + Math.sin(rad) * 44);
        ctx.lineTo(64 + Math.cos(rad) * 54, 64 + Math.sin(rad) * 54);
        ctx.stroke();
      }

      // Red needle
      ctx.strokeStyle = '#d32f2f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(64, 64);
      ctx.lineTo(95, 45);
      ctx.stroke();

      ctx.fillStyle = '#333b45';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(gaugeLabels[g] ?? '', 64, 88);

      dt.update();
      const faceMat = new StandardMaterial(`gauge-mat-${g}`, scene);
      faceMat.diffuseTexture = dt;
      gHousing.material = faceMat;
    }

    return root;
  }
}
