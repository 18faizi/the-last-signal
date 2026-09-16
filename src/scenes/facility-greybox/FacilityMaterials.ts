/**
 * High-fidelity textured material palette for The Last Signal facility scene.
 *
 * Combines physical-looking procedural textures (weathered concrete, diamond plate,
 * corrugated sheet metal, packed snow asphalt, wood grain, hazard decals) with
 * normal/bump maps and specular highlights.
 */
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { TextureGenerator } from './materials/TextureGenerator';

export interface FacilityPalette {
  readonly concrete: StandardMaterial;
  readonly metal: StandardMaterial;
  readonly wood: StandardMaterial;
  readonly exterior: StandardMaterial;
  readonly ceiling: StandardMaterial;
  readonly tunnel: StandardMaterial;
  readonly highlight: StandardMaterial;
  readonly ground: StandardMaterial;
  readonly fence: StandardMaterial;
  readonly equipment: StandardMaterial;
  readonly floor: StandardMaterial;
  readonly stair: StandardMaterial;
  readonly hazardStripe: StandardMaterial;
  readonly diamondPlate: StandardMaterial;
  readonly corrugated: StandardMaterial;
  readonly brass: StandardMaterial;
  readonly glass: StandardMaterial;
}

export class FacilityMaterials {
  readonly palette: FacilityPalette;
  private readonly materials: StandardMaterial[];

  constructor(scene: Scene) {
    const make = (name: string, r: number, g: number, b: number, spec = 0.15): StandardMaterial => {
      const mat = new StandardMaterial(`fac-mat-${name}`, scene);
      mat.diffuseColor = new Color3(r, g, b);
      mat.specularColor = new Color3(spec, spec, spec);
      return mat;
    };

    // 1. Concrete with procedural grain, formwork seams, and subtle bump
    const concrete = make('concrete', 0.65, 0.67, 0.7, 0.1);
    const concreteTex = TextureGenerator.createConcreteTexture(scene, 512);
    concreteTex.uScale = 4;
    concreteTex.vScale = 4;
    concrete.diffuseTexture = concreteTex;
    const concreteBump = TextureGenerator.createBumpMap(scene, 'noise', 256);
    concreteBump.uScale = 4;
    concreteBump.vScale = 4;
    concrete.bumpTexture = concreteBump;

    // 2. Heavy industrial metal
    const metal = make('metal', 0.55, 0.58, 0.62, 0.45);
    const diamondTex = TextureGenerator.createDiamondPlateTexture(scene, 256);
    diamondTex.uScale = 6;
    diamondTex.vScale = 6;
    metal.diffuseTexture = diamondTex;

    // 3. Rich wood grain
    const wood = make('wood', 0.7, 0.6, 0.5, 0.2);
    const woodTex = TextureGenerator.createWoodTexture(scene, 256);
    woodTex.uScale = 2;
    woodTex.vScale = 2;
    wood.diffuseTexture = woodTex;

    // 4. Exterior corrugated siding
    const exterior = make('exterior', 0.5, 0.54, 0.6, 0.25);
    const corrugateTex = TextureGenerator.createCorrugatedMetalTexture(scene, 512);
    corrugateTex.uScale = 6;
    corrugateTex.vScale = 3;
    exterior.diffuseTexture = corrugateTex;

    // 5. Ceiling with conduit shadow
    const ceiling = make('ceiling', 0.25, 0.26, 0.3, 0.05);

    // 6. Tunnel weathered dark concrete
    const tunnel = make('tunnel', 0.35, 0.38, 0.42, 0.15);
    const tunnelTex = TextureGenerator.createConcreteTexture(scene, 512);
    tunnelTex.uScale = 2;
    tunnelTex.vScale = 8;
    tunnel.diffuseTexture = tunnelTex;

    // 7. Interactive highlight
    const highlight = make('highlight', 0.4, 0.7, 1.0, 0.6);
    highlight.emissiveColor = new Color3(0.1, 0.25, 0.45);

    // 8. Ground asphalt with packed snow patches
    const ground = make('ground', 0.6, 0.62, 0.65, 0.15);
    const groundTex = TextureGenerator.createCourtyardGroundTexture(scene, 512);
    groundTex.uScale = 12;
    groundTex.vScale = 12;
    ground.diffuseTexture = groundTex;

    // 9. Fence chainlink/mesh steel
    const fence = make('fence', 0.5, 0.52, 0.55, 0.3);

    // 10. Equipment rack painted matte olive/slate
    const equipment = make('equipment', 0.4, 0.46, 0.44, 0.3);

    // 11. Interior control room floor
    const floor = make('floor', 0.45, 0.48, 0.52, 0.3);
    const floorTex = TextureGenerator.createConcreteTexture(scene, 512);
    floorTex.uScale = 8;
    floorTex.vScale = 8;
    floor.diffuseTexture = floorTex;

    // 12. Stair diamond plate
    const stair = make('stair', 0.6, 0.62, 0.65, 0.4);
    stair.diffuseTexture = diamondTex;

    // 13. Hazard stripes for doorways & thresholds
    const hazardStripe = make('hazardStripe', 0.9, 0.8, 0.2, 0.3);
    const hazardTex = TextureGenerator.createHazardStripeTexture(scene, 256);
    hazardTex.uScale = 4;
    hazardTex.vScale = 1;
    hazardStripe.diffuseTexture = hazardTex;

    // 14. Diamond plate
    const diamondPlate = make('diamondPlate', 0.6, 0.62, 0.66, 0.5);
    diamondPlate.diffuseTexture = diamondTex;

    // 15. Corrugated sheet metal
    const corrugated = make('corrugated', 0.5, 0.53, 0.58, 0.3);
    corrugated.diffuseTexture = corrugateTex;

    // 16. Brass metal for keys & valve petcocks
    const brass = make('brass', 0.88, 0.75, 0.35, 0.8);
    brass.specularColor = new Color3(0.9, 0.85, 0.5);

    // 17. Security wired frosted glass
    const glass = make('glass', 0.75, 0.85, 0.9, 0.9);
    glass.alpha = 0.55;

    this.palette = {
      concrete,
      metal,
      wood,
      exterior,
      ceiling,
      tunnel,
      highlight,
      ground,
      fence,
      equipment,
      floor,
      stair,
      hazardStripe,
      diamondPlate,
      corrugated,
      brass,
      glass,
    };

    this.materials = [
      concrete,
      metal,
      wood,
      exterior,
      ceiling,
      tunnel,
      highlight,
      ground,
      fence,
      equipment,
      floor,
      stair,
      hazardStripe,
      diamondPlate,
      corrugated,
      brass,
      glass,
    ];
  }

  dispose(): void {
    for (const mat of this.materials) {
      mat.dispose();
    }
    this.materials.length = 0;
    TextureGenerator.clearCache();
  }
}
