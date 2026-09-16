/**
 * Comprehensive Facility Lighting, Physical Fixtures & Glow Layer.
 *
 * Replaces flat greybox lighting with cold Arctic moonlight, real-time contact shadows,
 * authentic physical lamp fixtures (courtyard floodlight poles, security booth desk lamp,
 * generator bulkhead fixtures, control room fluorescents, antenna beacon), and emissive bloom.
 */
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { SpotLight } from '@babylonjs/core/Lights/spotLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Observer } from '@babylonjs/core/Misc/observable';

export class FacilityLighting {
  readonly hemi: HemisphericLight;
  readonly moon: DirectionalLight;
  readonly shadowGenerator: ShadowGenerator | null = null;
  readonly glowLayer: GlowLayer;

  private readonly lights: (PointLight | SpotLight)[] = [];
  private readonly fixtureMeshes: Mesh[] = [];
  private beaconObserver: Observer<Scene> | null = null;
  private beaconMaterial: StandardMaterial | null = null;

  constructor(scene: Scene) {
    // 1. Ambient hemispheric light (deep polar blue ambient)
    this.hemi = new HemisphericLight('fac-hemi', new Vector3(0.1, 1, 0.2), scene);
    this.hemi.intensity = 0.42;
    this.hemi.diffuse = new Color3(0.5, 0.65, 0.85); // Arctic blue ambient
    this.hemi.groundColor = new Color3(0.08, 0.1, 0.14);

    // 2. Cold directional moonlight
    this.moon = new DirectionalLight('fac-moon', new Vector3(-0.4, -1, 0.3), scene);
    this.moon.intensity = 0.65;
    this.moon.diffuse = new Color3(0.75, 0.85, 0.95); // Silver moonlight
    this.moon.specular = new Color3(0.4, 0.5, 0.6);

    // 3. Shadow generator
    try {
      this.shadowGenerator = new ShadowGenerator(1024, this.moon);
      this.shadowGenerator.usePoissonSampling = true;
      this.shadowGenerator.bias = 0.002;
    } catch {
      // Gracefully continue if WebGL context does not support depth textures
    }

    // 4. Glow Layer for emissive monitors, LEDs, warning beacons
    this.glowLayer = new GlowLayer('fac-glow', scene, {
      mainTextureRatio: 0.5,
      blurKernelSize: 24,
    });
    this.glowLayer.intensity = 0.75;

    // 5. Build physical light fixtures throughout the facility
    this.buildPhysicalFixtures(scene);
  }

  private buildPhysicalFixtures(scene: Scene): void {
    const metalMat = new StandardMaterial('fixture-metal-mat', scene);
    metalMat.diffuseColor = new Color3(0.25, 0.28, 0.32);
    metalMat.specularColor = new Color3(0.3, 0.3, 0.3);

    const warmGlassMat = new StandardMaterial('fixture-warm-glass-mat', scene);
    warmGlassMat.diffuseColor = new Color3(1.0, 0.85, 0.5);
    warmGlassMat.emissiveColor = new Color3(1.0, 0.75, 0.35);

    const coolGlassMat = new StandardMaterial('fixture-cool-glass-mat', scene);
    coolGlassMat.diffuseColor = new Color3(0.8, 0.9, 1.0);
    coolGlassMat.emissiveColor = new Color3(0.7, 0.85, 1.0);

    // --- Courtyard Floodlights (Poles with Lamps) ---
    const polePositions = [
      new Vector3(-10, 0, -5),
      new Vector3(15, 0, -8),
      new Vector3(25, 0, 10),
      new Vector3(-5, 0, 15),
    ];

    for (let i = 0; i < polePositions.length; i++) {
      const pos = polePositions[i];
      if (!pos) continue;
      // Pole
      const pole = CreateCylinder(
        `flood-pole-${i}`,
        { height: 6.5, diameter: 0.22, tessellation: 8 },
        scene,
      );
      pole.position.set(pos.x, 3.25, pos.z);
      pole.material = metalMat;
      pole.isPickable = false;
      this.fixtureMeshes.push(pole);

      // Lamp housing
      const head = CreateBox(`flood-head-${i}`, { width: 0.7, height: 0.35, depth: 0.5 }, scene);
      head.position.set(pos.x, 6.4, pos.z);
      head.material = metalMat;
      head.rotation.x = Math.PI / 6;
      head.isPickable = false;
      this.fixtureMeshes.push(head);

      // Emissive bulb lens
      const lens = CreateBox(`flood-lens-${i}`, { width: 0.6, height: 0.05, depth: 0.4 }, scene);
      lens.parent = head;
      lens.position.set(0, -0.15, 0);
      lens.material = warmGlassMat;
      lens.isPickable = false;
      this.fixtureMeshes.push(lens);

      // Spot light pointing down into courtyard
      const spot = new SpotLight(
        `flood-light-${i}`,
        new Vector3(pos.x, 6.2, pos.z),
        new Vector3(0.1, -1, 0.1),
        Math.PI / 2.2,
        8,
        scene,
      );
      spot.intensity = 1.4;
      spot.diffuse = new Color3(1.0, 0.82, 0.55); // Sodium amber/gold
      spot.specular = new Color3(0.5, 0.4, 0.2);
      spot.range = 35;
      this.lights.push(spot);
    }

    // --- Security Guardhouse Desk Lamp ---
    const deskLight = new PointLight('guard-lamp', new Vector3(-14.5, 1.4, 8), scene);
    deskLight.intensity = 0.8;
    deskLight.diffuse = new Color3(1.0, 0.8, 0.45); // Warm incandescent
    deskLight.range = 8;
    this.lights.push(deskLight);

    // --- Control Room Overhead Fluorescent Banks ---
    const ctrlLight1 = new PointLight('ctrl-fl-1', new Vector3(-3, 3.2, 18), scene);
    ctrlLight1.intensity = 0.9;
    ctrlLight1.diffuse = new Color3(0.85, 0.92, 1.0); // Cool fluorescent
    ctrlLight1.range = 14;
    this.lights.push(ctrlLight1);

    const ctrlLight2 = new PointLight('ctrl-fl-2', new Vector3(3, 3.2, 22), scene);
    ctrlLight2.intensity = 0.85;
    ctrlLight2.diffuse = new Color3(0.85, 0.92, 1.0);
    ctrlLight2.range = 14;
    this.lights.push(ctrlLight2);

    // --- Generator Room Heavy Bulkhead Cages ---
    const genLight = new PointLight('gen-bulkhead', new Vector3(47, 3.0, 0), scene);
    genLight.intensity = 1.1;
    genLight.diffuse = new Color3(1.0, 0.7, 0.35); // Industrial amber
    genLight.range = 15;
    this.lights.push(genLight);

    // --- Service Cable Tunnel Strip Lights ---
    const tunLight1 = new PointLight('tun-light-1', new Vector3(15, -1.8, 0), scene);
    tunLight1.intensity = 0.7;
    tunLight1.diffuse = new Color3(0.9, 0.8, 0.6);
    tunLight1.range = 10;
    this.lights.push(tunLight1);

    const tunLight2 = new PointLight('tun-light-2', new Vector3(30, -1.8, 0), scene);
    tunLight2.intensity = 0.7;
    tunLight2.diffuse = new Color3(0.9, 0.8, 0.6);
    tunLight2.range = 10;
    this.lights.push(tunLight2);

    // --- Rooftop Antenna Tower Red Flashing Warning Beacon ---
    const beaconMesh = CreateSphere('antenna-beacon-mesh', { diameter: 0.35, segments: 12 }, scene);
    beaconMesh.position.set(0, 18.2, 22);
    this.beaconMaterial = new StandardMaterial('antenna-beacon-mat', scene);
    this.beaconMaterial.diffuseColor = new Color3(1.0, 0.1, 0.1);
    this.beaconMaterial.emissiveColor = new Color3(1.0, 0.05, 0.05);
    beaconMesh.material = this.beaconMaterial;
    beaconMesh.isPickable = false;
    this.fixtureMeshes.push(beaconMesh);

    const beaconLight = new PointLight('antenna-beacon-light', new Vector3(0, 18.4, 22), scene);
    beaconLight.intensity = 0.9;
    beaconLight.diffuse = new Color3(1.0, 0.15, 0.15);
    beaconLight.range = 18;
    this.lights.push(beaconLight);

    // Flash the warning beacon every 1.2 seconds
    let beaconTime = 0;
    this.beaconObserver = scene.onBeforeRenderObservable.add(() => {
      beaconTime += 0.035;
      const flash = Math.sin(beaconTime * 3.5);
      const on = flash > 0.4;
      beaconLight.intensity = on ? 1.2 : 0.05;
      if (this.beaconMaterial) {
        this.beaconMaterial.emissiveColor.set(on ? 1.0 : 0.2, on ? 0.08 : 0.01, on ? 0.08 : 0.01);
      }
    });
  }

  addShadowCasters(meshes: Mesh[]): void {
    if (!this.shadowGenerator) return;
    for (const mesh of meshes) {
      if (!mesh.isDisposed()) {
        this.shadowGenerator.addShadowCaster(mesh);
      }
    }
  }

  dispose(): void {
    if (this.beaconObserver) {
      this.beaconObserver.remove();
      this.beaconObserver = null;
    }
    for (const light of this.lights) {
      light.dispose();
    }
    this.lights.length = 0;
    for (const mesh of this.fixtureMeshes) {
      mesh.dispose();
    }
    this.fixtureMeshes.length = 0;
    this.glowLayer.dispose();
    this.shadowGenerator?.dispose();
    this.moon.dispose();
    this.hemi.dispose();
  }
}
