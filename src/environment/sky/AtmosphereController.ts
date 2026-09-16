/**
 * Atmosphere & Sky Celestial Controller for The Last Signal.
 *
 * Implements a dynamic celestial skydome and environmental lighting controller supporting
 * three narrative sky phases:
 *  1. Dusk: Deep navy/orange horizon gradient, soft directional dusk lighting.
 *  2. NightClear: Crisp starfield texture, cold moonlight with soft shadows.
 *  3. SignalDistortion: Subtle unnatural auroral or static shimmer across the cloud deck.
 *
 * Features smooth interpolation between sky phases when triggered by the Event Director,
 * synchronizing sky gradients, directional moon/sun light, ambient hemi light, and EXP2 fog.
 */
import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import type { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import type { Observer } from '@babylonjs/core/Misc/observable';
import {
  type SkyPhase,
  type AtmospherePhaseConfig,
  type AtmosphereTransitionState,
  ATMOSPHERE_PHASE_PRESETS,
} from '../types';

export interface AtmosphereControllerOptions {
  readonly initialPhase?: SkyPhase;
  readonly moonLight?: DirectionalLight;
  readonly hemiLight?: HemisphericLight;
  readonly autoHookRenderObservable?: boolean;
}

export class AtmosphereController {
  readonly scene: Scene;
  private readonly skydome: Mesh;
  private readonly texture: DynamicTexture;
  private readonly material: StandardMaterial;

  private moonLight: DirectionalLight | null = null;
  private hemiLight: HemisphericLight | null = null;
  private renderObserver: Observer<Scene> | null = null;

  // Active interpolated values
  private currentZenithColor: Color3;
  private currentHorizonColor: Color3;
  private currentHazeColor: Color3;
  private currentFogColor: Color3;
  private currentFogDensity: number;
  private currentStarfieldAlpha: number;
  private currentShimmerIntensity: number;
  private currentShimmerSpeed: number;

  // Transition state
  private transitionState: AtmosphereTransitionState;
  private fromConfig: AtmospherePhaseConfig;
  private toConfig: AtmospherePhaseConfig;

  // Shimmer animation time
  private shimmerTimer = 0;
  private lastCanvasRedrawTime = 0;
  private isDisposed = false;

  // Cached starfield points for deterministic rendering
  private readonly stars: ReadonlyArray<{ x: number; y: number; r: number; alpha: number }>;

  constructor(scene: Scene, options: AtmosphereControllerOptions = {}) {
    this.scene = scene;
    const initialPhase = options.initialPhase ?? 'NightClear';
    const config = ATMOSPHERE_PHASE_PRESETS[initialPhase];

    this.fromConfig = config;
    this.toConfig = config;
    this.transitionState = {
      currentPhase: initialPhase,
      targetPhase: null,
      progress: 1.0,
      duration: 0,
    };

    // Initialize interpolated values
    this.currentZenithColor = config.zenithColor.clone();
    this.currentHorizonColor = config.horizonColor.clone();
    this.currentHazeColor = config.hazeColor.clone();
    this.currentFogColor = config.fog.color.clone();
    this.currentFogDensity = config.fog.density;
    this.currentStarfieldAlpha = config.starfieldAlpha;
    this.currentShimmerIntensity = config.shimmerIntensity;
    this.currentShimmerSpeed = config.shimmerSpeed;

    if (options.moonLight) {
      this.moonLight = options.moonLight;
    }
    if (options.hemiLight) {
      this.hemiLight = options.hemiLight;
    }

    // Configure scene fog
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = this.currentFogDensity;
    this.scene.fogColor = this.currentFogColor.clone();

    // 1. Skydome mesh
    this.skydome = CreateSphere(
      'atmosphere-skydome',
      { diameter: 600, segments: 24, slice: 0.55 },
      scene,
    );
    this.skydome.isPickable = false;
    this.skydome.checkCollisions = false;
    this.skydome.infiniteDistance = true;

    // 2. Pre-generate starfield
    const starList: Array<{ x: number; y: number; r: number; alpha: number }> = [];
    const texW = 1024;
    const texH = 512;
    for (let i = 0; i < 350; i++) {
      const sx = (Math.sin(i * 12.9898) * 0.5 + 0.5) * texW;
      const sy = (Math.sin(i * 78.233) * 0.5 + 0.5) * (texH * 0.72);
      const r = i % 10 === 0 ? 2.0 : 0.8 + (i % 5) * 0.2;
      const alpha = 0.35 + ((i * 17) % 65) / 100;
      starList.push({ x: sx, y: sy, r, alpha });
    }
    this.stars = starList;

    // 3. Dynamic celestial canvas texture
    this.texture = new DynamicTexture(
      'atmosphere-sky-tex',
      { width: texW, height: texH },
      scene,
      false,
    );

    // 4. Skydome material
    this.material = new StandardMaterial('atmosphere-skydome-mat', scene);
    this.material.emissiveTexture = this.texture;
    this.material.disableLighting = true;
    this.material.backFaceCulling = false;
    this.skydome.material = this.material;

    // Initial canvas render & light application
    this.applyLights(1.0);
    this.renderCanvas();

    // Optional render observer hook
    if (options.autoHookRenderObservable !== false) {
      this.renderObserver = scene.onBeforeRenderObservable.add(() => {
        const dt = scene.getEngine().getDeltaTime() * 0.001;
        this.update(dt);
        this.skydome.rotation.y += 0.00004;
      });
    }
  }

  get currentPhase(): SkyPhase {
    return this.transitionState.currentPhase;
  }

  get targetPhase(): SkyPhase | null {
    return this.transitionState.targetPhase;
  }

  get transitionProgress(): number {
    return this.transitionState.progress;
  }

  get isTransitioning(): boolean {
    return this.transitionState.targetPhase !== null && this.transitionState.progress < 1.0;
  }

  /**
   * Sets or binds lights to this atmosphere controller.
   */
  setLights(moon: DirectionalLight, hemi: HemisphericLight): void {
    this.moonLight = moon;
    this.hemiLight = hemi;
    this.applyLights(this.transitionState.progress);
  }

  /**
   * Immediately sets the atmosphere phase without interpolation.
   */
  setPhaseImmediate(phase: SkyPhase): void {
    const config = ATMOSPHERE_PHASE_PRESETS[phase];
    this.fromConfig = config;
    this.toConfig = config;
    this.transitionState = {
      currentPhase: phase,
      targetPhase: null,
      progress: 1.0,
      duration: 0,
    };

    this.currentZenithColor.copyFrom(config.zenithColor);
    this.currentHorizonColor.copyFrom(config.horizonColor);
    this.currentHazeColor.copyFrom(config.hazeColor);
    this.currentFogColor.copyFrom(config.fog.color);
    this.currentFogDensity = config.fog.density;
    this.currentStarfieldAlpha = config.starfieldAlpha;
    this.currentShimmerIntensity = config.shimmerIntensity;
    this.currentShimmerSpeed = config.shimmerSpeed;

    this.applyLights(1.0);
    this.renderCanvas();
  }

  /**
   * Initiates smooth interpolation to a target sky phase.
   *
   * @param targetPhase Target narrative phase ('Dusk', 'NightClear', 'SignalDistortion')
   * @param durationSeconds Transition duration in seconds (default: 3.0s)
   */
  transitionTo(targetPhase: SkyPhase, durationSeconds = 3.0): void {
    if (
      this.transitionState.currentPhase === targetPhase &&
      this.transitionState.targetPhase === null
    ) {
      return;
    }

    if (durationSeconds <= 0) {
      this.setPhaseImmediate(targetPhase);
      return;
    }

    // Capture current values as baseline for the transition
    this.fromConfig = {
      phase: this.transitionState.currentPhase,
      zenithColor: this.currentZenithColor.clone(),
      horizonColor: this.currentHorizonColor.clone(),
      hazeColor: this.currentHazeColor.clone(),
      directionalLight: {
        direction: this.moonLight
          ? this.moonLight.direction.clone()
          : this.fromConfig.directionalLight.direction,
        diffuse: this.moonLight
          ? this.moonLight.diffuse.clone()
          : this.fromConfig.directionalLight.diffuse,
        specular: this.moonLight
          ? this.moonLight.specular.clone()
          : this.fromConfig.directionalLight.specular,
        intensity: this.moonLight
          ? this.moonLight.intensity
          : this.fromConfig.directionalLight.intensity,
      },
      ambientLight: {
        diffuse: this.hemiLight
          ? this.hemiLight.diffuse.clone()
          : this.fromConfig.ambientLight.diffuse,
        groundColor: this.hemiLight
          ? this.hemiLight.groundColor.clone()
          : this.fromConfig.ambientLight.groundColor,
        intensity: this.hemiLight
          ? this.hemiLight.intensity
          : this.fromConfig.ambientLight.intensity,
      },
      fog: {
        mode: Scene.FOGMODE_EXP2,
        density: this.currentFogDensity,
        color: this.currentFogColor.clone(),
      },
      starfieldAlpha: this.currentStarfieldAlpha,
      shimmerIntensity: this.currentShimmerIntensity,
      shimmerSpeed: this.currentShimmerSpeed,
    };

    this.toConfig = ATMOSPHERE_PHASE_PRESETS[targetPhase];
    this.transitionState = {
      currentPhase: this.transitionState.currentPhase,
      targetPhase,
      progress: 0.0,
      duration: durationSeconds,
    };
  }

  /**
   * Advances interpolation and shimmer animation.
   */
  update(deltaSeconds: number): void {
    if (this.isDisposed) return;
    const dt = Math.max(deltaSeconds, 0);

    let needsCanvasRedraw = false;

    // 1. Advance phase transition if active
    if (this.transitionState.targetPhase !== null) {
      this.transitionState.progress += dt / this.transitionState.duration;

      if (this.transitionState.progress >= 1.0) {
        this.transitionState.progress = 1.0;
        this.transitionState.currentPhase = this.transitionState.targetPhase;
        this.transitionState.targetPhase = null;
      }

      const t = this.smoothStep(this.transitionState.progress);

      // Lerp colors & parameters
      Color3.LerpToRef(
        this.fromConfig.zenithColor,
        this.toConfig.zenithColor,
        t,
        this.currentZenithColor,
      );
      Color3.LerpToRef(
        this.fromConfig.horizonColor,
        this.toConfig.horizonColor,
        t,
        this.currentHorizonColor,
      );
      Color3.LerpToRef(
        this.fromConfig.hazeColor,
        this.toConfig.hazeColor,
        t,
        this.currentHazeColor,
      );
      Color3.LerpToRef(this.fromConfig.fog.color, this.toConfig.fog.color, t, this.currentFogColor);
      this.currentFogDensity = this.lerp(this.fromConfig.fog.density, this.toConfig.fog.density, t);
      this.currentStarfieldAlpha = this.lerp(
        this.fromConfig.starfieldAlpha,
        this.toConfig.starfieldAlpha,
        t,
      );
      this.currentShimmerIntensity = this.lerp(
        this.fromConfig.shimmerIntensity,
        this.toConfig.shimmerIntensity,
        t,
      );
      this.currentShimmerSpeed = this.lerp(
        this.fromConfig.shimmerSpeed,
        this.toConfig.shimmerSpeed,
        t,
      );

      // Apply to Babylon lights and scene fog
      this.applyLights(t);
      needsCanvasRedraw = true;
    }

    // 2. Advance shimmer timer if aurora/static is active
    if (this.currentShimmerIntensity > 0.02) {
      this.shimmerTimer += dt * this.currentShimmerSpeed;

      // Throttle dynamic texture redraw to ~24 fps for smooth aurora without GPU overhead
      const now = performance.now();
      if (now - this.lastCanvasRedrawTime >= 40) {
        needsCanvasRedraw = true;
        this.lastCanvasRedrawTime = now;
      }
    }

    if (needsCanvasRedraw) {
      this.renderCanvas();
    }
  }

  private applyLights(t: number): void {
    // Directional Light
    if (this.moonLight) {
      Color3.LerpToRef(
        this.fromConfig.directionalLight.diffuse,
        this.toConfig.directionalLight.diffuse,
        t,
        this.moonLight.diffuse,
      );
      Color3.LerpToRef(
        this.fromConfig.directionalLight.specular,
        this.toConfig.directionalLight.specular,
        t,
        this.moonLight.specular,
      );
      this.moonLight.intensity = this.lerp(
        this.fromConfig.directionalLight.intensity,
        this.toConfig.directionalLight.intensity,
        t,
      );
      Vector3.LerpToRef(
        this.fromConfig.directionalLight.direction,
        this.toConfig.directionalLight.direction,
        t,
        this.moonLight.direction,
      );
    }

    // Hemispheric Ambient Light
    if (this.hemiLight) {
      Color3.LerpToRef(
        this.fromConfig.ambientLight.diffuse,
        this.toConfig.ambientLight.diffuse,
        t,
        this.hemiLight.diffuse,
      );
      Color3.LerpToRef(
        this.fromConfig.ambientLight.groundColor,
        this.toConfig.ambientLight.groundColor,
        t,
        this.hemiLight.groundColor,
      );
      this.hemiLight.intensity = this.lerp(
        this.fromConfig.ambientLight.intensity,
        this.toConfig.ambientLight.intensity,
        t,
      );
    }

    // Scene Fog
    this.scene.fogDensity = this.currentFogDensity;
    this.scene.fogColor.copyFrom(this.currentFogColor);
  }

  /**
   * Redraws the dynamic celestial canvas texture.
   */
  private renderCanvas(): void {
    const ctx = this.texture.getContext() as CanvasRenderingContext2D | null;
    if (!ctx || typeof ctx.createLinearGradient !== 'function') {
      return;
    }

    const texW = 1024;
    const texH = 512;

    // 1. Sky gradient (Zenith -> Horizon -> Base)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, texH);
    skyGrad.addColorStop(0, this.currentZenithColor.toHexString());
    skyGrad.addColorStop(0.45, this.currentHazeColor.toHexString());
    skyGrad.addColorStop(0.85, this.currentHorizonColor.toHexString());
    skyGrad.addColorStop(1.0, this.currentFogColor.toHexString());

    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, texW, texH);

    // 2. Starfield
    if (this.currentStarfieldAlpha > 0.05) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < this.stars.length; i++) {
        const star = this.stars[i];
        if (!star) continue;
        ctx.globalAlpha = star.alpha * this.currentStarfieldAlpha;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
    }

    // 3. Auroral Curtain & Static Shimmer
    if (this.currentShimmerIntensity > 0.02) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.8, this.currentShimmerIntensity * 0.65);

      const auroraGrad = ctx.createLinearGradient(0, texH * 0.2, 0, texH * 0.7);
      if (
        this.transitionState.currentPhase === 'SignalDistortion' ||
        this.transitionState.targetPhase === 'SignalDistortion'
      ) {
        // Unnatural cyan-violet auroral static
        auroraGrad.addColorStop(0, 'rgba(168, 85, 247, 0)');
        auroraGrad.addColorStop(0.4, 'rgba(6, 182, 212, 0.7)');
        auroraGrad.addColorStop(0.7, 'rgba(16, 185, 129, 0.5)');
        auroraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        // Natural arctic green aurora
        auroraGrad.addColorStop(0, 'rgba(0, 255, 180, 0)');
        auroraGrad.addColorStop(0.5, 'rgba(40, 230, 160, 0.5)');
        auroraGrad.addColorStop(1, 'rgba(0, 100, 200, 0)');
      }

      ctx.fillStyle = auroraGrad;
      ctx.beginPath();
      ctx.moveTo(0, texH * 0.55);

      const time = this.shimmerTimer;
      for (let x = 0; x <= texW; x += 32) {
        const wave1 = Math.sin(x * 0.015 + time * 1.5) * 30;
        const wave2 = Math.cos(x * 0.03 - time * 2.2) * 18;
        const y = texH * 0.45 + wave1 + wave2;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(texW, texH * 0.75);
      ctx.lineTo(0, texH * 0.75);
      ctx.closePath();
      ctx.fill();

      // Additional signal interference scanline static for SignalDistortion
      if (this.currentShimmerIntensity > 0.4) {
        ctx.fillStyle = 'rgba(120, 240, 255, 0.12)';
        for (let sl = 0; sl < 5; sl++) {
          const sy = (Math.sin(time * 4 + sl * 1.7) * 0.5 + 0.5) * (texH * 0.6);
          ctx.fillRect(0, sy, texW, 3 + (sl % 3));
        }
      }

      ctx.restore();
    }

    // 4. Horizon haze blend
    const hazeGrad = ctx.createLinearGradient(0, texH * 0.85, 0, texH);
    hazeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    hazeGrad.addColorStop(1.0, this.currentFogColor.toHexString());
    ctx.fillStyle = hazeGrad;
    ctx.fillRect(0, texH * 0.85, texW, texH * 0.15);

    this.texture.update();
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private smoothStep(t: number): number {
    const clamped = Math.max(0, Math.min(1, t));
    return clamped * clamped * (3 - 2 * clamped);
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    if (this.renderObserver) {
      this.renderObserver.remove();
      this.renderObserver = null;
    }

    this.material.dispose();
    this.texture.dispose();
    this.skydome.dispose();
  }
}
