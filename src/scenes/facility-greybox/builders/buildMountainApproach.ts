/**
 * Mountain Approach Builder.
 *
 * Implements the opening traversal path from spawn (X = -58) to the Perimeter Gate (X = -20).
 * Features:
 * 1. Contiguous, gapless solid road and shoulder foundation (X ∈ [-65, -19], Z ∈ [-12.5, 12.5]).
 * 2. Visual road demarcation: dark asphalt road surface with highway center stripes and snow berms.
 * 3. High-visibility wayfinding: reflective snow poles with orange reflectors every 10m.
 * 4. Abandoned hazard barrier arm at X = -38 with "STATION ECHO — AUTHORIZED PERSONNEL ONLY ->".
 * 5. Road-edge bollard lights guiding the player through the fog.
 * 6. Architectural entrance sign: "STATION ECHO - MAIN ENTRANCE".
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import type { FacilitySceneContext } from '../FacilitySceneContext';
import { buildUtilityTruck } from '../props/UtilityTruckBuilder';
import { SignageBuilder } from '../props/SignageBuilder';

export function buildMountainApproach(ctx: FacilitySceneContext): void {
  const { geo, scene, materials } = ctx;

  // =========================================================================
  // 1. Contiguous Solid Ground Foundation & Road Bed (X ∈ [-65, -19])
  // =========================================================================
  // Base sub-foundation slab: completely seals any possible under-void gaps
  geo.course.box('fac-approach-subfoundation', {
    width: 46,
    height: 1.0,
    depth: 26,
    position: new Vector3(-42, -0.6, 0),
    color: materials.palette.ground.diffuseColor,
  });

  // Dark asphalt roadbed (X ∈ [-65, -19], width 10, Z ∈ [-5, 5])
  const roadMat = new StandardMaterial('approach-dark-asphalt-mat', scene);
  roadMat.diffuseColor = new Color3(0.09, 0.11, 0.14); // Distinct dark asphalt
  roadMat.specularColor = new Color3(0.04, 0.05, 0.06);
  roadMat.roughness = 0.85;

  const roadMesh = geo.course.box('fac-approach-roadbed', {
    width: 46,
    height: 0.5,
    depth: 10,
    position: new Vector3(-42, -0.25, 0),
    color: roadMat.diffuseColor,
  });
  roadMesh.material = roadMat;

  // Road shoulders (compacted snow/gravel verges, Z ∈ [5, 12.5] and Z ∈ [-12.5, -5])
  const shoulderMat = new StandardMaterial('approach-snow-verge-mat', scene);
  shoulderMat.diffuseColor = new Color3(0.38, 0.44, 0.52); // Cold mountain gravel/ice
  shoulderMat.specularColor = new Color3(0.12, 0.14, 0.18);

  const northVerge = geo.course.box('fac-approach-verge-n', {
    width: 46,
    height: 0.5,
    depth: 7.5,
    position: new Vector3(-42, -0.25, 8.75),
    color: shoulderMat.diffuseColor,
  });
  northVerge.material = shoulderMat;

  const southVerge = geo.course.box('fac-approach-verge-s', {
    width: 46,
    height: 0.5,
    depth: 7.5,
    position: new Vector3(-42, -0.25, -8.75),
    color: shoulderMat.diffuseColor,
  });
  southVerge.material = shoulderMat;

  // Snow berm ridges lining the edge of the asphalt (Z = ±5.1)
  const snowBermMat = new StandardMaterial('approach-snow-berm-mat', scene);
  snowBermMat.diffuseColor = new Color3(0.78, 0.84, 0.92); // Clean polar snow
  snowBermMat.specularColor = new Color3(0.2, 0.25, 0.3);

  for (const z of [-5.1, 5.1]) {
    const berm = geo.course.box(`fac-approach-snow-berm-${z}`, {
      width: 46,
      height: 0.22,
      depth: 0.45,
      position: new Vector3(-42, 0.11, z),
      color: snowBermMat.diffuseColor,
    });
    berm.material = snowBermMat;
  }

  // Weathered road center line dashes (faded yellow highway marks)
  const stripeMat = new StandardMaterial('approach-center-stripe-mat', scene);
  stripeMat.diffuseColor = new Color3(0.72, 0.62, 0.22);
  stripeMat.emissiveColor = new Color3(0.15, 0.12, 0.05);

  for (let x = -61; x <= -21; x += 4) {
    const stripe = CreateBox(
      `approach-center-dash-${x}`,
      { width: 1.8, height: 0.02, depth: 0.22 },
      scene,
    );
    stripe.position.set(x, 0.015, 0);
    stripe.material = stripeMat;
    stripe.isPickable = false;
    stripe.checkCollisions = false;
  }

  // Embankment boundary walls (north and south sides) — solid static barriers
  geo.wall('approach-embank-n', {
    cx: -42,
    cy: 2.0,
    cz: 12.5,
    w: 46,
    h: 4.0,
    d: 0.8,
  });
  geo.wall('approach-embank-s', {
    cx: -42,
    cy: 2.0,
    cz: -12.5,
    w: 46,
    h: 4.0,
    d: 0.8,
  });

  // West backstop cliff behind spawn ($X = -64.5$)
  geo.wall('approach-cliff-west', {
    cx: -64.6,
    cy: 2.5,
    cz: 0,
    w: 0.8,
    h: 5.0,
    d: 25.5,
  });

  // =========================================================================
  // 2. Reflective Snow Trail Markers (Guide poles every 10 meters)
  // =========================================================================
  const poleMetalMat = new StandardMaterial('snow-pole-metal-mat', scene);
  poleMetalMat.diffuseColor = new Color3(0.18, 0.2, 0.22);

  const reflectorMat = new StandardMaterial('snow-pole-reflector-mat', scene);
  reflectorMat.diffuseColor = new Color3(1.0, 0.45, 0.05); // High-vis neon orange
  reflectorMat.emissiveColor = new Color3(0.65, 0.28, 0.02);

  const poleXCoords = [-56, -46, -36, -26];
  for (const x of poleXCoords) {
    for (const z of [-5.4, 5.4]) {
      // Main marker stake
      const pole = CreateCylinder(
        `snow-pole-${x}-${z}`,
        { height: 1.9, diameter: 0.08, tessellation: 8 },
        scene,
      );
      pole.position.set(x, 0.95, z);
      pole.material = poleMetalMat;
      pole.isPickable = false;
      pole.checkCollisions = false;

      // Reflective top bands
      for (const yOffset of [1.4, 1.65]) {
        const band = CreateCylinder(
          `snow-reflector-${x}-${z}-${yOffset}`,
          { height: 0.12, diameter: 0.095, tessellation: 8 },
          scene,
        );
        band.position.set(x, yOffset, z);
        band.material = reflectorMat;
        band.isPickable = false;
        band.checkCollisions = false;
      }
    }
  }

  // =========================================================================
  // 3. Abandoned Perimeter Barrier Arm (X = -38) with Directional Sign
  // =========================================================================
  const hazardBarrierMat = new StandardMaterial('hazard-barrier-arm-mat', scene);
  hazardBarrierMat.diffuseColor = new Color3(0.85, 0.2, 0.15); // Hazard red/white
  hazardBarrierMat.specularColor = new Color3(0.3, 0.3, 0.3);

  // Stanchion post on south shoulder
  const stanchion = geo.course.box('approach-barrier-stanchion', {
    width: 0.5,
    height: 1.4,
    depth: 0.5,
    position: new Vector3(-38, 0.7, -4.8),
    color: materials.palette.metal.diffuseColor,
  });
  stanchion.isPickable = false;

  // Horizontal striped barrier arm spanning road
  const arm = geo.course.box('approach-barrier-arm', {
    width: 0.18,
    height: 0.28,
    depth: 7.2,
    position: new Vector3(-38, 1.1, -1.2),
    color: hazardBarrierMat.diffuseColor,
  });
  arm.material = hazardBarrierMat;

  // Warning sign on barrier
  const signage = new SignageBuilder(scene);
  signage.createSign({
    id: 'approach-hazard-barrier-sign',
    text: 'STATION ECHO',
    subtext: 'AUTHORIZED PERSONNEL ONLY →',
    position: new Vector3(-37.88, 1.1, -1.2),
    rotationY: -Math.PI / 2, // Facing approaching player (+X)
    width: 2.2,
    height: 0.65,
    accentColor: '#f59e0b',
    arrow: 'right',
  });

  // =========================================================================
  // 4. Road-Edge Low Bollard Guide Lights (Subtle breadcrumb lights)
  // =========================================================================
  const bollardCoords = [
    new Vector3(-48, 0, 5.3),
    new Vector3(-36, 0, -5.3),
    new Vector3(-25, 0, 5.3),
  ];

  const bollardMat = new StandardMaterial('approach-bollard-mat', scene);
  bollardMat.diffuseColor = new Color3(0.2, 0.22, 0.25);

  const bollardGlassMat = new StandardMaterial('approach-bollard-glass-mat', scene);
  bollardGlassMat.diffuseColor = new Color3(1.0, 0.75, 0.35);
  bollardGlassMat.emissiveColor = new Color3(1.0, 0.6, 0.2);

  for (let i = 0; i < bollardCoords.length; i++) {
    const pos = bollardCoords[i];
    if (!pos) continue;

    // Bollard post
    const bollard = CreateCylinder(
      `approach-bollard-${i}`,
      { height: 0.9, diameter: 0.2, tessellation: 12 },
      scene,
    );
    bollard.position.set(pos.x, 0.45, pos.z);
    bollard.material = bollardMat;
    bollard.isPickable = false;
    bollard.checkCollisions = false;

    // Glowing head
    const glowHead = CreateCylinder(
      `approach-bollard-glow-${i}`,
      { height: 0.18, diameter: 0.21, tessellation: 12 },
      scene,
    );
    glowHead.position.set(pos.x, 0.8, pos.z);
    glowHead.material = bollardGlassMat;
    glowHead.isPickable = false;
    glowHead.checkCollisions = false;

    // Low-intensity point light illuminating road curve
    const light = new PointLight(
      `approach-bollard-light-${i}`,
      new Vector3(pos.x, 0.9, pos.z),
      scene,
    );
    light.diffuse = new Color3(1.0, 0.7, 0.3);
    light.intensity = 0.45;
    light.range = 7.5;
  }

  // =========================================================================
  // 5. Approach Entrance Signage & Props
  // =========================================================================
  signage.createSign({
    id: 'approach-main-entrance-sign',
    text: 'STATION ECHO - MAIN ENTRANCE',
    subtext: 'PERIMETER SECURITY CHECKPOINT AHEAD',
    position: new Vector3(-54, 2.4, 12.0),
    rotationY: 0,
    width: 4.8,
    height: 1.2,
    accentColor: '#38bdf8',
  });

  // Concrete road barriers along the north edge near gate
  for (let i = 0; i < 4; i++) {
    geo.course.box(`fac-barrier-${i}`, {
      width: 0.6,
      height: 0.8,
      depth: 2,
      position: new Vector3(-24 + i * 2.5, 0.4, 6),
      color: materials.palette.concrete.diffuseColor,
    });
  }

  // Abandoned utility truck prop at approach boundary (with inspectable cab clue)
  buildUtilityTruck(ctx, new Vector3(-53, 0, 7.5));

  // =========================================================================
  // 6. Spawn Checkpoint Trigger
  // =========================================================================
  ctx.triggerVolumes.add({
    id: 'trig-approach-spawn',
    aabb: { minX: -65, minY: -2, minZ: -12, maxX: -30, maxY: 6, maxZ: 12 },
    repeatable: false,
    onEnter: () => {
      ctx.checkpointRegistry.activate('fg-cp-spawn');
      ctx.facilityState.recordZoneDiscovered('fg-zone-approach');
    },
  });
}
