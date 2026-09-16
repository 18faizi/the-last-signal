/**
 * Horizon Backdrop & Distant Vista System for The Last Signal.
 *
 * Implements a high-performance, purely visual exterior vista:
 * 1. Low-poly silhouette ring of distant Arctic mountain ranges (radius ~250m)
 *    outside playable boundaries, merged into minimal draw calls.
 * 2. Exponential height fog (EXP2) seamlessly blending mountain bases into the horizon.
 * 3. Distant winding access road cutting through the western mountain pass.
 * 4. Landslide rockfall & heavy hazard barrier blocking the approach boundary.
 *
 * ZERO physics colliders — purely visual backdrop maintaining 60 FPS in WebGL.
 */
import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateRibbon } from '@babylonjs/core/Meshes/Builders/ribbonBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { HorizonBackdropConfig } from '../types';

export class HorizonBackdrop {
  private readonly scene: Scene;
  private readonly meshes: Mesh[] = [];
  private readonly materials: StandardMaterial[] = [];

  constructor(scene: Scene, config: HorizonBackdropConfig = {}) {
    this.scene = scene;

    // 1. Configure exponential fog blending
    this.configureFog();

    // 2. Build distant mountain range silhouette ring
    this.buildMountainRings(config);

    // 3. Build distant winding access road through mountain pass
    this.buildWindingAccessRoad(config);

    // 4. Build landslide / road barrier at approach boundary
    this.buildLandslideBarricade();
  }

  private configureFog(): void {
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.007;
    this.scene.fogColor = new Color3(0.06, 0.09, 0.14);
  }

  /**
   * Generates low-poly silhouette rings of distant mountain ranges.
   * Merged into optimized single meshes with fog attenuation.
   */
  private buildMountainRings(config: HorizonBackdropConfig): void {
    const baseRadius = config.ringRadius ?? 250;
    const segments = config.segments ?? 64;

    // Mountain material with fog attenuation enabled
    const mountainMat = new StandardMaterial('vista-mountain-mat', this.scene);
    mountainMat.diffuseColor = new Color3(0.04, 0.06, 0.09);
    mountainMat.emissiveColor = new Color3(0.02, 0.03, 0.05);
    mountainMat.specularColor = new Color3(0.05, 0.07, 0.1);
    mountainMat.backFaceCulling = false;
    mountainMat.fogEnabled = true;
    this.materials.push(mountainMat);

    // --- Outer Mountain Ring (Distant High Peaks) ---
    const outerMesh = this.generateMountainRingMesh(
      'vista-mountains-outer',
      baseRadius * 1.15,
      segments,
      -12, // base Y (submerged into ground fog)
      75, // max peak height
      42, // seed offset
    );
    outerMesh.material = mountainMat;
    this.meshes.push(outerMesh);

    // --- Inner Mountain Ring (Mid-Distance Ridges) ---
    const innerMesh = this.generateMountainRingMesh(
      'vista-mountains-inner',
      baseRadius * 0.95,
      segments,
      -8,
      48,
      137,
    );
    innerMesh.material = mountainMat;
    this.meshes.push(innerMesh);
  }

  private generateMountainRingMesh(
    name: string,
    radius: number,
    segments: number,
    baseY: number,
    peakHeight: number,
    seed: number,
  ): Mesh {
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const angleStep = (Math.PI * 2) / segments;

    for (let i = 0; i <= segments; i++) {
      const angle = i * angleStep;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // Multi-harmonic deterministic peak variations
      const harmonic1 = Math.sin(angle * 4 + seed) * 0.35;
      const harmonic2 = Math.cos(angle * 9 + seed * 1.7) * 0.25;
      const harmonic3 = Math.sin(angle * 17 + seed * 0.3) * 0.15;
      const heightFactor = Math.max(0.25, 0.6 + harmonic1 + harmonic2 + harmonic3);

      const radVariation = radius * (1 + Math.sin(angle * 3 + seed) * 0.06);

      // Vertex 0: Bottom base (submerged below ground)
      const bx = cos * (radVariation - 15);
      const bz = sin * (radVariation - 15);
      positions.push(bx, baseY, bz);
      normals.push(0, 1, 0);
      colors.push(0.04, 0.06, 0.09, 1);

      // Vertex 1: Peak
      const px = cos * radVariation;
      const py = peakHeight * heightFactor;
      const pz = sin * radVariation;
      positions.push(px, py, pz);
      normals.push(-cos * 0.5, 0.8, -sin * 0.5);
      colors.push(0.08, 0.12, 0.18, 1);
    }

    // Connect triangle strip
    for (let i = 0; i < segments; i++) {
      const v0 = i * 2;
      const v1 = v0 + 1;
      const v2 = (i + 1) * 2;
      const v3 = v2 + 1;

      // Triangle 1: v0 -> v1 -> v2
      indices.push(v0, v1, v2);
      // Triangle 2: v2 -> v1 -> v3
      indices.push(v2, v1, v3);
    }

    const mesh = new Mesh(name, this.scene);
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;
    vertexData.applyToMesh(mesh);

    // Architectural rule: No physics colliders, purely visual backdrop
    mesh.isPickable = false;
    mesh.checkCollisions = false;

    return mesh;
  }

  /**
   * Distant winding access road stretching beyond the approach boundary (-62)
   * out through the mountain pass (-240m).
   */
  private buildWindingAccessRoad(_config: HorizonBackdropConfig): void {
    const roadMat = new StandardMaterial('vista-road-mat', this.scene);
    roadMat.diffuseColor = new Color3(0.08, 0.09, 0.11); // Dark asphalt
    roadMat.specularColor = new Color3(0.02, 0.02, 0.03);
    roadMat.fogEnabled = true;
    this.materials.push(roadMat);

    const shoulderMat = new StandardMaterial('vista-shoulder-mat', this.scene);
    shoulderMat.diffuseColor = new Color3(0.18, 0.22, 0.26); // Compacted ice/gravel
    shoulderMat.fogEnabled = true;
    this.materials.push(shoulderMat);

    // Road path points starting at approach boundary and curving westward
    const waypoints = [
      new Vector3(-62, 0.02, 0),
      new Vector3(-85, 0.05, -3),
      new Vector3(-115, 0.15, -9),
      new Vector3(-145, 0.25, -6),
      new Vector3(-180, 0.4, -18),
      new Vector3(-215, 0.6, -30),
      new Vector3(-250, 0.8, -48),
    ];

    const roadWidth = 9.5;
    const shoulderWidth = 3.5;

    // Create ribbon paths for left edge, right edge
    const leftRoadPath: Vector3[] = [];
    const rightRoadPath: Vector3[] = [];
    const leftShoulderPath: Vector3[] = [];
    const rightShoulderPath: Vector3[] = [];

    for (let i = 0; i < waypoints.length; i++) {
      const p = waypoints[i];
      if (!p) continue;
      const next = waypoints[Math.min(i + 1, waypoints.length - 1)] ?? p;
      const prev = waypoints[Math.max(i - 1, 0)] ?? p;

      // Tangent direction
      const dir = next.subtract(prev);
      const forward = dir.lengthSquared() > 0.001 ? dir.normalize() : new Vector3(-1, 0, 0);
      const normal = new Vector3(-forward.z, 0, forward.x); // 90 deg horizontal normal

      const halfW = roadWidth * 0.5;
      leftRoadPath.push(p.add(normal.scale(halfW)));
      rightRoadPath.push(p.subtract(normal.scale(halfW)));

      leftShoulderPath.push(p.add(normal.scale(halfW + shoulderWidth)));
      rightShoulderPath.push(p.subtract(normal.scale(halfW + shoulderWidth)));
    }

    // Main road ribbon
    const roadRibbon = CreateRibbon(
      'vista-road-ribbon',
      { pathArray: [leftRoadPath, rightRoadPath], closeArray: false },
      this.scene,
    );
    roadRibbon.material = roadMat;
    roadRibbon.isPickable = false;
    roadRibbon.checkCollisions = false;
    this.meshes.push(roadRibbon);

    // Shoulders
    const leftShoulder = CreateRibbon(
      'vista-shoulder-left',
      { pathArray: [leftShoulderPath, leftRoadPath], closeArray: false },
      this.scene,
    );
    leftShoulder.material = shoulderMat;
    leftShoulder.isPickable = false;
    leftShoulder.checkCollisions = false;
    this.meshes.push(leftShoulder);

    const rightShoulder = CreateRibbon(
      'vista-shoulder-right',
      { pathArray: [rightRoadPath, rightShoulderPath], closeArray: false },
      this.scene,
    );
    rightShoulder.material = shoulderMat;
    rightShoulder.isPickable = false;
    rightShoulder.checkCollisions = false;
    this.meshes.push(rightShoulder);
  }

  /**
   * Dramatic landslide debris and heavy hazard roadblock at X = -62
   * visually explaining why the mountain approach is sealed off.
   */
  private buildLandslideBarricade(): void {
    const rockMat = new StandardMaterial('vista-rockfall-mat', this.scene);
    rockMat.diffuseColor = new Color3(0.15, 0.17, 0.2);
    rockMat.specularColor = new Color3(0.08, 0.08, 0.1);
    rockMat.fogEnabled = true;
    this.materials.push(rockMat);

    const barrierMat = new StandardMaterial('vista-hazard-mat', this.scene);
    barrierMat.diffuseColor = new Color3(0.75, 0.55, 0.15); // Industrial hazard yellow
    barrierMat.specularColor = new Color3(0.2, 0.2, 0.2);
    barrierMat.fogEnabled = true;
    this.materials.push(barrierMat);

    // Landslide debris: low-poly tumbled boulders blocking the road pass
    const boulderData = [
      { pos: new Vector3(-62.5, 1.2, -1.8), size: 2.8, rotY: 0.4 },
      { pos: new Vector3(-63.8, 1.8, 1.5), size: 3.4, rotY: 1.1 },
      { pos: new Vector3(-64.5, 1.0, -3.8), size: 2.4, rotY: 0.8 },
      { pos: new Vector3(-65.2, 2.2, 0.2), size: 4.1, rotY: 2.3 },
      { pos: new Vector3(-63.0, 0.8, 3.4), size: 2.1, rotY: 1.7 },
      { pos: new Vector3(-66.0, 1.5, -2.2), size: 3.0, rotY: 0.2 },
    ];

    for (let i = 0; i < boulderData.length; i++) {
      const b = boulderData[i];
      if (!b) continue;
      const rock = CreateBox(`vista-boulder-${i}`, { size: b.size }, this.scene);
      rock.position.copyFrom(b.pos);
      rock.rotation.y = b.rotY;
      rock.rotation.x = 0.2 * i;
      rock.rotation.z = -0.15 * i;
      rock.material = rockMat;
      rock.isPickable = false;
      rock.checkCollisions = false;
      this.meshes.push(rock);
    }

    // Heavy road barrier across the roadway
    const barrierBeam = CreateBox(
      'vista-roadblock-beam',
      { width: 0.5, height: 0.9, depth: 10.5 },
      this.scene,
    );
    barrierBeam.position.set(-61.2, 0.8, 0);
    barrierBeam.material = barrierMat;
    barrierBeam.isPickable = false;
    barrierBeam.checkCollisions = false;
    this.meshes.push(barrierBeam);

    // Hazard support stanchions
    for (const z of [-4, 0, 4]) {
      const post = CreateBox(
        `vista-barrier-post-${z}`,
        { width: 0.35, height: 1.6, depth: 0.35 },
        this.scene,
      );
      post.position.set(-61.2, 0.8, z);
      post.material = barrierMat;
      post.isPickable = false;
      post.checkCollisions = false;
      this.meshes.push(post);
    }
  }

  /**
   * Updates fog parameters (typically invoked during sky phase transitions).
   */
  setFogParameters(density: number, color: Color3): void {
    this.scene.fogDensity = density;
    this.scene.fogColor.copyFrom(color);
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.dispose();
    }
    this.meshes.length = 0;

    for (const mat of this.materials) {
      mat.dispose();
    }
    this.materials.length = 0;
  }
}
