/**
 * Ambient Courtyard Weather & Snow Particle System for The Last Signal.
 *
 * Simulates gentle drifting snowflakes and blowing Arctic ice dust
 * across outdoor facility areas (courtyard, perimeter gate, antenna deck).
 */
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';

export class CourtyardWeather {
  private readonly particleSystem: ParticleSystem;
  private readonly particleTexture: DynamicTexture;

  constructor(scene: Scene) {
    // 1. Procedural circular soft snowflake texture
    this.particleTexture = new DynamicTexture(
      'snowflake-particle-tex',
      { width: 64, height: 64 },
      scene,
      false,
    );
    const ctx = this.particleTexture.getContext() as CanvasRenderingContext2D;
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.4, 'rgba(230, 240, 255, 0.7)');
    grad.addColorStop(1, 'rgba(200, 220, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();
    this.particleTexture.update();

    // 2. Particle system
    this.particleSystem = new ParticleSystem('arctic-snow', 800, scene);
    this.particleSystem.particleTexture = this.particleTexture;

    // Emitter volume covering courtyard and facility grounds
    this.particleSystem.emitter = new Vector3(0, 14, 0);
    this.particleSystem.minEmitBox = new Vector3(-35, 0, -35);
    this.particleSystem.maxEmitBox = new Vector3(45, 2, 35);

    this.particleSystem.color1 = new Color4(0.9, 0.95, 1.0, 0.6);
    this.particleSystem.color2 = new Color4(0.8, 0.88, 0.98, 0.4);
    this.particleSystem.colorDead = new Color4(0.8, 0.9, 1.0, 0.0);

    this.particleSystem.minSize = 0.06;
    this.particleSystem.maxSize = 0.18;

    this.particleSystem.minLifeTime = 4.5;
    this.particleSystem.maxLifeTime = 8.0;

    this.particleSystem.emitRate = 120;
    this.particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;

    this.particleSystem.gravity = new Vector3(-0.4, -1.8, 0.6);
    this.particleSystem.direction1 = new Vector3(-1, -1.5, 0.8);
    this.particleSystem.direction2 = new Vector3(-0.3, -2.5, 0.3);

    this.particleSystem.minAngularSpeed = -0.5;
    this.particleSystem.maxAngularSpeed = 0.5;

    this.particleSystem.start();
  }

  dispose(): void {
    this.particleSystem.stop();
    this.particleSystem.dispose();
    this.particleTexture.dispose();
  }
}
