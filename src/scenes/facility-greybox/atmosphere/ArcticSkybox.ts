/**
 * Arctic Night Skybox & Atmosphere for The Last Signal.
 *
 * Implements a celestial skydome featuring a deep polar night gradient,
 * procedural starfield with twinkling magnitude, distant mountain silhouettes,
 * an ethereal Aurora Borealis ribbon, and matching atmospheric height fog.
 */
import { Scene } from '@babylonjs/core/scene';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Observer } from '@babylonjs/core/Misc/observable';

export class ArcticSkybox {
  private readonly skydome: Mesh;
  private readonly texture: DynamicTexture;
  private readonly material: StandardMaterial;
  private renderObserver: Observer<Scene> | null = null;

  constructor(scene: Scene) {
    // 1. Atmosphere height fog
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.007;
    scene.fogColor = new Color3(0.06, 0.09, 0.14);

    // 2. Skydome mesh
    this.skydome = CreateSphere(
      'arctic-skydome',
      { diameter: 600, segments: 24, slice: 0.55 },
      scene,
    );
    this.skydome.isPickable = false;
    this.skydome.infiniteDistance = true;

    // 3. Dynamic celestial canvas texture
    const texW = 1024;
    const texH = 512;
    this.texture = new DynamicTexture(
      'arctic-sky-tex',
      { width: texW, height: texH },
      scene,
      false,
    );
    const ctx = this.texture.getContext() as CanvasRenderingContext2D;

    // Polar night sky gradient (Zenith to Horizon)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, texH);
    skyGrad.addColorStop(0, '#020408'); // Deep space zenith
    skyGrad.addColorStop(0.35, '#060b14');
    skyGrad.addColorStop(0.7, '#0b1624');
    skyGrad.addColorStop(0.9, '#122235'); // Horizon haze
    skyGrad.addColorStop(1, '#080d16');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, texW, texH);

    // Procedural Aurora Borealis curtain
    ctx.save();
    ctx.filter = 'blur(14px)';
    ctx.globalAlpha = 0.35;
    const auroraGrad = ctx.createLinearGradient(0, texH * 0.3, 0, texH * 0.7);
    auroraGrad.addColorStop(0, 'rgba(0, 255, 180, 0)');
    auroraGrad.addColorStop(0.5, 'rgba(40, 230, 160, 0.6)');
    auroraGrad.addColorStop(0.8, 'rgba(60, 140, 220, 0.4)');
    auroraGrad.addColorStop(1, 'rgba(0, 100, 200, 0)');

    ctx.fillStyle = auroraGrad;
    ctx.beginPath();
    ctx.moveTo(0, texH * 0.55);
    for (let x = 0; x <= texW; x += 40) {
      const wave = Math.sin(x * 0.012) * 35 + Math.cos(x * 0.024) * 20;
      ctx.lineTo(x, texH * 0.5 + wave);
    }
    ctx.lineTo(texW, texH * 0.8);
    ctx.lineTo(0, texH * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Procedural Stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 350; i++) {
      const sx = Math.random() * texW;
      const sy = Math.random() * (texH * 0.75); // Upper sky
      const r = Math.random() < 0.9 ? Math.random() * 1.2 + 0.5 : Math.random() * 2.2 + 1.2;
      const alpha = Math.random() * 0.7 + 0.3;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Distant jagged Arctic mountain ridge silhouette along horizon
    ctx.fillStyle = '#05080e';
    ctx.beginPath();
    ctx.moveTo(0, texH);
    ctx.lineTo(0, texH * 0.82);
    for (let mx = 0; mx <= texW; mx += 16) {
      const peak = Math.sin(mx * 0.02) * 22 + Math.cos(mx * 0.045) * 14 + Math.sin(mx * 0.1) * 6;
      ctx.lineTo(mx, texH * 0.84 - peak);
    }
    ctx.lineTo(texW, texH);
    ctx.closePath();
    ctx.fill();

    this.texture.update();

    // 4. Skydome material
    this.material = new StandardMaterial('arctic-skydome-mat', scene);
    this.material.emissiveTexture = this.texture;
    this.material.disableLighting = true;
    this.material.backFaceCulling = false;
    this.skydome.material = this.material;

    // Subtle slow rotation around Y
    this.renderObserver = scene.onBeforeRenderObservable.add(() => {
      this.skydome.rotation.y += 0.00004;
    });
  }

  dispose(): void {
    if (this.renderObserver) {
      this.renderObserver.remove();
      this.renderObserver = null;
    }
    this.material.dispose();
    this.texture.dispose();
    this.skydome.dispose();
  }
}
