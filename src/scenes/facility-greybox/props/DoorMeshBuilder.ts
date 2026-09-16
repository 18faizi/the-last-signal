/**
 * Industrial Door Mesh Builder for The Last Signal.
 *
 * Builds detailed architectural 3D door assemblies:
 * - Hinged security doors: steel doorframe, recessed panel leaf, lever handle, barrel hinges,
 *   observation window with wired glass, and lock status LED bezel (Red = locked, Green = unlocked).
 * - Sliding blast doors: heavy cross-braced steel slab, overhead guide track with rollers,
 *   bottom yellow/black hazard chevrons, and wall-mounted card reader terminal.
 * - Compound perimeter gate: welded tubular steel frame, vertical security bars, sliding latch.
 */
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { TextureGenerator } from '../materials/TextureGenerator';

export class DoorMeshBuilder {
  /**
   * Builds a detailed hinged industrial security door attached to a door leaf mesh.
   */
  static decorateHingedDoor(
    id: string,
    leafMesh: Mesh,
    width: number,
    height: number,
    thickness: number,
    scene: Scene,
  ): void {
    const frameMat = new StandardMaterial(`door-frame-mat-${id}`, scene);
    frameMat.diffuseColor = new Color3(0.28, 0.3, 0.34); // Slate industrial steel
    frameMat.specularColor = new Color3(0.35, 0.35, 0.35);

    const handleMat = new StandardMaterial(`door-handle-mat-${id}`, scene);
    handleMat.diffuseColor = new Color3(0.75, 0.77, 0.8); // Brushed stainless steel
    handleMat.specularColor = new Color3(0.85, 0.85, 0.9);

    const leafFaceMat = new StandardMaterial(`door-face-mat-${id}`, scene);
    leafFaceMat.diffuseColor = new Color3(0.32, 0.35, 0.38);
    const concreteTex = TextureGenerator.createConcreteTexture(scene, 256);
    leafFaceMat.diffuseTexture = concreteTex;

    // 1. Recessed interior bevel panels (gives depth to the flat slab)
    const panelW = width * 0.75;
    const panelH = height * 0.38;
    const upperPanel = CreateBox(
      `door-panel-up-${id}`,
      { width: panelW, height: panelH, depth: thickness * 1.15 },
      scene,
    );
    upperPanel.parent = leafMesh;
    upperPanel.position.set(0, height * 0.22, 0);
    upperPanel.material = leafFaceMat;
    upperPanel.isPickable = false;

    const lowerPanel = CreateBox(
      `door-panel-low-${id}`,
      { width: panelW, height: panelH, depth: thickness * 1.15 },
      scene,
    );
    lowerPanel.parent = leafMesh;
    lowerPanel.position.set(0, -height * 0.24, 0);
    lowerPanel.material = leafFaceMat;
    lowerPanel.isPickable = false;

    // 2. Wired Security Glass Observation Window (in upper panel)
    if (!id.includes('gate')) {
      const windowFrame = CreateBox(
        `door-win-frame-${id}`,
        { width: width * 0.35, height: height * 0.2, depth: thickness * 1.25 },
        scene,
      );
      windowFrame.parent = leafMesh;
      windowFrame.position.set(0, height * 0.25, 0);
      windowFrame.material = frameMat;
      windowFrame.isPickable = false;

      const glassPane = CreateBox(
        `door-win-glass-${id}`,
        { width: width * 0.3, height: height * 0.16, depth: thickness * 1.3 },
        scene,
      );
      glassPane.parent = windowFrame;
      const glassMat = new StandardMaterial(`door-glass-mat-${id}`, scene);
      glassMat.diffuseColor = new Color3(0.2, 0.3, 0.38);
      glassMat.alpha = 0.65;
      glassPane.material = glassMat;
      glassPane.isPickable = false;
    }

    // 3. Ergonomic Lever Handle on both sides
    const handleX = (width / 2) * 0.78;
    const handleY = 0; // Center height

    for (const side of [-1, 1]) {
      // Escutcheon plate
      const plate = CreateBox(
        `door-plate-${id}-${side}`,
        { width: 0.05, height: 0.16, depth: 0.01 },
        scene,
      );
      plate.parent = leafMesh;
      plate.position.set(handleX, handleY, (thickness / 2 + 0.005) * side);
      plate.material = handleMat;
      plate.isPickable = false;

      // Spindle
      const spindle = CreateCylinder(
        `door-spindle-${id}-${side}`,
        { diameter: 0.016, height: 0.045, tessellation: 8 },
        scene,
      );
      spindle.parent = plate;
      spindle.position.set(0, 0.03, 0.02 * side);
      spindle.rotation.x = Math.PI / 2;
      spindle.material = handleMat;
      spindle.isPickable = false;

      // Lever arm
      const lever = CreateCylinder(
        `door-lever-${id}-${side}`,
        { diameter: 0.014, height: 0.11, tessellation: 8 },
        scene,
      );
      lever.parent = spindle;
      lever.position.set(-0.045, 0.02 * side, 0);
      lever.rotation.z = Math.PI / 2;
      lever.material = handleMat;
      lever.isPickable = false;
    }

    // 4. Barrel Hinges along the pivot edge
    const hingeX = -(width / 2) * 0.95;
    for (const hy of [height * 0.35, -height * 0.35]) {
      const hinge = CreateCylinder(
        `door-hinge-${id}-${hy}`,
        { diameter: 0.028, height: 0.1, tessellation: 12 },
        scene,
      );
      hinge.parent = leafMesh;
      hinge.position.set(hingeX, hy, 0);
      hinge.material = frameMat;
      hinge.isPickable = false;
    }

    // 5. Lock Status Indicator LED
    const ledBezel = CreateBox(
      `door-led-bezel-${id}`,
      { width: 0.04, height: 0.04, depth: thickness * 1.2 },
      scene,
    );
    ledBezel.parent = leafMesh;
    ledBezel.position.set(handleX, handleY + 0.14, 0);
    ledBezel.material = frameMat;
    ledBezel.isPickable = false;

    const led = CreateCylinder(
      `door-led-${id}`,
      { diameter: 0.018, height: thickness * 1.25, tessellation: 12 },
      scene,
    );
    led.parent = ledBezel;
    led.rotation.x = Math.PI / 2;
    const ledMat = new StandardMaterial(`door-led-mat-${id}`, scene);
    ledMat.diffuseColor = new Color3(0.1, 0.9, 0.2); // Default green / unlocked
    ledMat.emissiveColor = new Color3(0.05, 0.8, 0.15);
    led.material = ledMat;
    led.isPickable = false;

    // Attach status update helper directly on the mesh
    (leafMesh as unknown as Record<string, unknown>)['updateLockLed'] = (isLocked: boolean) => {
      if (isLocked) {
        ledMat.diffuseColor.set(1.0, 0.1, 0.1);
        ledMat.emissiveColor.set(0.9, 0.05, 0.05);
      } else {
        ledMat.diffuseColor.set(0.1, 0.9, 0.2);
        ledMat.emissiveColor.set(0.05, 0.8, 0.15);
      }
    };
  }

  /**
   * Builds an industrial sliding blast door with overhead track, rollers, and hazard trim.
   */
  static decorateSlidingDoor(
    id: string,
    leafMesh: Mesh,
    width: number,
    height: number,
    thickness: number,
    scene: Scene,
  ): void {
    const metalMat = new StandardMaterial(`slide-metal-mat-${id}`, scene);
    metalMat.diffuseColor = new Color3(0.35, 0.38, 0.42);
    metalMat.specularColor = new Color3(0.4, 0.4, 0.45);
    metalMat.diffuseTexture = TextureGenerator.createCorrugatedMetalTexture(scene, 256);

    const hazardMat = new StandardMaterial(`slide-hazard-mat-${id}`, scene);
    hazardMat.diffuseTexture = TextureGenerator.createHazardStripeTexture(scene, 256);

    // 1. Reinforced diagonal cross-braces (heavy blast door ribbing)
    const brace1 = CreateBox(
      `slide-brace-1-${id}`,
      { width: width * 1.1, height: 0.08, depth: thickness * 1.18 },
      scene,
    );
    brace1.parent = leafMesh;
    brace1.rotation.z = Math.atan2(height, width);
    brace1.material = metalMat;
    brace1.isPickable = false;

    const brace2 = CreateBox(
      `slide-brace-2-${id}`,
      { width: width * 1.1, height: 0.08, depth: thickness * 1.18 },
      scene,
    );
    brace2.parent = leafMesh;
    brace2.rotation.z = -Math.atan2(height, width);
    brace2.material = metalMat;
    brace2.isPickable = false;

    // 2. Yellow/black hazard chevron sill along bottom
    const hazardSill = CreateBox(
      `slide-hazard-${id}`,
      { width: width, height: 0.12, depth: thickness * 1.2 },
      scene,
    );
    hazardSill.parent = leafMesh;
    hazardSill.position.set(0, -height / 2 + 0.06, 0);
    hazardSill.material = hazardMat;
    hazardSill.isPickable = false;

    // 3. Overhead track casing with guide rollers
    const track = CreateBox(
      `slide-track-${id}`,
      { width: width * 2.2, height: 0.16, depth: thickness * 2.2 },
      scene,
    );
    track.position.set(
      leafMesh.position.x,
      leafMesh.position.y + height / 2 + 0.1,
      leafMesh.position.z,
    );
    const trackMat = new StandardMaterial(`track-mat-${id}`, scene);
    trackMat.diffuseColor = new Color3(0.2, 0.22, 0.25);
    track.material = trackMat;
    track.isPickable = false;

    // 4. Wall-mounted card swipe terminal
    const reader = CreateBox(
      `slide-reader-${id}`,
      { width: 0.12, height: 0.22, depth: 0.06 },
      scene,
    );
    reader.position.set(
      leafMesh.position.x - width * 0.7,
      leafMesh.position.y,
      leafMesh.position.z,
    );
    const readerMat = new StandardMaterial(`reader-mat-${id}`, scene);
    readerMat.diffuseColor = new Color3(0.12, 0.14, 0.18);
    reader.material = readerMat;
    reader.isPickable = false;

    const readerLed = CreateSphere(`reader-led-${id}`, { diameter: 0.02, segments: 8 }, scene);
    readerLed.parent = reader;
    readerLed.position.set(0, 0.07, 0.032);
    const rLedMat = new StandardMaterial(`reader-led-mat-${id}`, scene);
    rLedMat.diffuseColor = new Color3(0.1, 0.9, 0.2);
    rLedMat.emissiveColor = new Color3(0.05, 0.8, 0.15);
    readerLed.material = rLedMat;
    readerLed.isPickable = false;

    (leafMesh as unknown as Record<string, unknown>)['updateLockLed'] = (isLocked: boolean) => {
      if (isLocked) {
        rLedMat.diffuseColor.set(1.0, 0.1, 0.1);
        rLedMat.emissiveColor.set(0.9, 0.05, 0.05);
      } else {
        rLedMat.diffuseColor.set(0.1, 0.9, 0.2);
        rLedMat.emissiveColor.set(0.05, 0.8, 0.15);
      }
    };
  }
}
