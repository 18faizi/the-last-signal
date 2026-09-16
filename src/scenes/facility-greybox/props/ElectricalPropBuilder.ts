/**
 * Electrical Prop & Lever Mesh Builder for The Last Signal.
 *
 * Builds detailed industrial electrical hardware:
 * - Distribution panel cabinet with open hinged enclosure door and copper busbars.
 * - Heavy industrial knife-switch lever with copper blades, ceramic contacts, and molded red ball handle.
 * - Individual circuit breaker toggle switches with amperage ratings.
 */
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { TextureGenerator } from '../materials/TextureGenerator';

export class ElectricalPropBuilder {
  /**
   * Builds the detailed distribution panel cabinet and master knife switch lever.
   */
  static decorateDistributionPanel(panelMesh: Mesh, scene: Scene): void {
    const cabinetMat = new StandardMaterial('panel-cabinet-mat', scene);
    cabinetMat.diffuseColor = new Color3(0.2, 0.23, 0.27);
    cabinetMat.specularColor = new Color3(0.3, 0.3, 0.3);

    const copperMat = new StandardMaterial('panel-copper-mat', scene);
    copperMat.diffuseColor = new Color3(0.85, 0.45, 0.2); // Polished copper
    copperMat.specularColor = new Color3(0.9, 0.6, 0.4);

    const leverRedMat = new StandardMaterial('panel-lever-red-mat', scene);
    leverRedMat.diffuseColor = new Color3(0.85, 0.15, 0.12); // High-visibility safety red
    leverRedMat.specularColor = new Color3(0.6, 0.2, 0.2);

    const darkMat = new StandardMaterial('panel-dark-mat', scene);
    darkMat.diffuseColor = new Color3(0.08, 0.09, 0.1);

    // 1. Cabinet perimeter rim & interior recessed electrical bay
    const bay = CreateBox('dist-bay', { width: 0.18, height: 1.1, depth: 0.8 }, scene);
    bay.parent = panelMesh;
    bay.position.set(0.02, 0, 0);
    bay.material = darkMat;
    bay.isPickable = false;

    // 2. Open Hinged Enclosure Door (swung open against the wall)
    const door = CreateBox('dist-door', { width: 0.02, height: 1.15, depth: 0.85 }, scene);
    door.parent = panelMesh;
    door.position.set(-0.06, 0, 0.5);
    door.rotation.y = -Math.PI * 0.45; // Swung open
    door.material = cabinetMat;
    door.isPickable = false;

    // High Voltage Warning sign on the inside of the door
    const warnTex = new DynamicTexture('dist-warn-tex', { width: 256, height: 256 }, scene, false);
    const ctx = warnTex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = '#e6af19';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#1b1e22';
    ctx.font = 'bold 28px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('DANGER', 128, 50);
    ctx.font = 'bold 22px system-ui';
    ctx.fillText('HIGH VOLTAGE', 128, 90);
    ctx.font = '18px monospace';
    ctx.fillText('480V 3-PHASE', 128, 130);
    ctx.fillText('AUTHORISED ONLY', 128, 165);
    warnTex.update();
    const warnMat = new StandardMaterial('dist-warn-mat', scene);
    warnMat.diffuseTexture = warnTex;
    door.material = warnMat;

    // 3. Copper Busbars running vertically down the interior bay
    for (let b = -0.22; b <= 0.22; b += 0.22) {
      const busbar = CreateBox(
        `dist-busbar-${b}`,
        { width: 0.015, height: 0.95, depth: 0.04 },
        scene,
      );
      busbar.parent = bay;
      busbar.position.set(0.04, 0, b);
      busbar.material = copperMat;
      busbar.isPickable = false;
    }

    // 4. Four Individual Circuit Breaker Toggles (Substation, Receiver, Antenna, Bunkhouse)
    const breakerY = [0.35, 0.12, -0.11, -0.34];
    for (let i = 0; i < breakerY.length; i++) {
      const by = breakerY[i] ?? 0;
      // Breaker box
      const bBox = CreateBox(
        `dist-breaker-box-${i}`,
        { width: 0.06, height: 0.16, depth: 0.18 },
        scene,
      );
      bBox.parent = bay;
      bBox.position.set(0.05, by, -0.2);
      bBox.material = cabinetMat;
      bBox.isPickable = false;

      // Breaker rocker lever
      const rocker = CreateBox(
        `dist-rocker-${i}`,
        { width: 0.03, height: 0.08, depth: 0.05 },
        scene,
      );
      rocker.parent = bBox;
      rocker.position.set(0.03, 0, 0);
      rocker.material = leverRedMat;
      rocker.isPickable = false;
    }

    // 5. MASTER KNIFE-SWITCH LEVER
    // Ceramic mounting base
    const base = CreateBox('knife-base', { width: 0.05, height: 0.45, depth: 0.25 }, scene);
    base.parent = bay;
    base.position.set(0.05, 0, 0.15);
    base.material = cabinetMat;
    base.isPickable = false;

    // Copper contact jaws (top and bottom)
    for (const jy of [0.15, -0.15]) {
      const jaw = CreateBox(`knife-jaw-${jy}`, { width: 0.03, height: 0.05, depth: 0.04 }, scene);
      jaw.parent = base;
      jaw.position.set(0.03, jy, 0);
      jaw.material = copperMat;
      jaw.isPickable = false;
    }

    // Heavy pivot hinge
    const pivot = CreateCylinder(
      'knife-pivot',
      { diameter: 0.03, height: 0.06, tessellation: 12 },
      scene,
    );
    pivot.parent = base;
    pivot.position.set(0.03, -0.15, 0);
    pivot.rotation.x = Math.PI / 2;
    pivot.material = copperMat;
    pivot.isPickable = false;

    // Dual copper blade arm (throws up/down)
    const blade = CreateBox('knife-blade', { width: 0.015, height: 0.32, depth: 0.02 }, scene);
    blade.parent = base;
    blade.position.set(0.05, 0, 0);
    blade.material = copperMat;
    blade.isPickable = false;

    // Ergonomic Red Handle Grip
    const handle = CreateCylinder(
      'knife-handle-grip',
      { diameter: 0.035, height: 0.12, tessellation: 16 },
      scene,
    );
    handle.parent = blade;
    handle.position.set(0.04, 0.18, 0);
    handle.material = leverRedMat;
    handle.isPickable = false;

    const handleBall = CreateSphere('knife-handle-ball', { diameter: 0.048, segments: 12 }, scene);
    handleBall.parent = handle;
    handleBall.position.set(0, 0.06, 0);
    handleBall.material = leverRedMat;
    handleBall.isPickable = false;

    // Hazard warning stripes along base
    const hazardSill = CreateBox('knife-hazard', { width: 0.01, height: 0.45, depth: 0.03 }, scene);
    hazardSill.parent = base;
    hazardSill.position.set(0.01, 0, 0.14);
    const hMat = new StandardMaterial('knife-hmat', scene);
    hMat.diffuseTexture = TextureGenerator.createHazardStripeTexture(scene, 128);
    hazardSill.material = hMat;
    hazardSill.isPickable = false;
  }
}
