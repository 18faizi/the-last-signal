/**
 * Shared greybox material palette for the facility scene.
 *
 * All materials are created once and reused across builders to minimise
 * draw calls.  Dispose this object when the scene is torn down — it owns
 * the StandardMaterial instances.
 */
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';

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
}

export class FacilityMaterials {
  readonly palette: FacilityPalette;

  private readonly materials: StandardMaterial[];

  constructor(scene: Scene) {
    const make = (name: string, r: number, g: number, b: number): StandardMaterial => {
      const mat = new StandardMaterial(`fac-mat-${name}`, scene);
      mat.diffuseColor = new Color3(r, g, b);
      mat.specularColor = new Color3(0.05, 0.05, 0.05);
      return mat;
    };

    const concrete = make('concrete', 0.3, 0.31, 0.33);
    const metal = make('metal', 0.38, 0.4, 0.42);
    const wood = make('wood', 0.42, 0.35, 0.26);
    const exterior = make('exterior', 0.28, 0.3, 0.34);
    const ceiling = make('ceiling', 0.22, 0.23, 0.26);
    const tunnel = make('tunnel', 0.18, 0.2, 0.22);
    const highlight = make('highlight', 0.55, 0.72, 0.9);
    const ground = make('ground', 0.24, 0.25, 0.27);
    const fence = make('fence', 0.34, 0.36, 0.36);
    const equipment = make('equipment', 0.32, 0.36, 0.32);
    const floor = make('floor', 0.26, 0.27, 0.3);
    const stair = make('stair', 0.3, 0.32, 0.36);

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
    ];
  }

  dispose(): void {
    for (const mat of this.materials) {
      mat.dispose();
    }
    this.materials.length = 0;
  }
}
