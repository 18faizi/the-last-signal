/**
 * Type contracts and presets for the Atmosphere, Sky, and Horizon Vista System.
 *
 * Supports three narrative sky phases:
 *  - Dusk: Deep navy/orange horizon gradient, soft directional dusk light.
 *  - NightClear: Crisp starfield, cold moon directional light with soft shadows.
 *  - SignalDistortion: Eerie auroral and static shimmer across the celestial canvas.
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export type SkyPhase = 'Dusk' | 'NightClear' | 'SignalDistortion';

export interface DirectionalLightConfig {
  readonly direction: Vector3;
  readonly diffuse: Color3;
  readonly specular: Color3;
  readonly intensity: number;
}

export interface AmbientLightConfig {
  readonly diffuse: Color3;
  readonly groundColor: Color3;
  readonly intensity: number;
}

export interface FogConfig {
  readonly mode: number;
  readonly density: number;
  readonly color: Color3;
}

export interface AtmospherePhaseConfig {
  readonly phase: SkyPhase;
  readonly zenithColor: Color3;
  readonly horizonColor: Color3;
  readonly hazeColor: Color3;
  readonly directionalLight: DirectionalLightConfig;
  readonly ambientLight: AmbientLightConfig;
  readonly fog: FogConfig;
  readonly starfieldAlpha: number;
  readonly shimmerIntensity: number;
  readonly shimmerSpeed: number;
}

export interface AtmosphereTransitionState {
  currentPhase: SkyPhase;
  targetPhase: SkyPhase | null;
  progress: number;
  duration: number;
}

export interface HorizonBackdropConfig {
  readonly ringRadius?: number;
  readonly segments?: number;
  readonly baseHeight?: number;
  readonly peakHeight?: number;
  readonly roadLength?: number;
  readonly mountainBaseColor?: Color3;
  readonly mountainPeakColor?: Color3;
}

/**
 * Authored presets for the three narrative sky phases.
 */
export const ATMOSPHERE_PHASE_PRESETS: Record<SkyPhase, AtmospherePhaseConfig> = {
  Dusk: {
    phase: 'Dusk',
    zenithColor: new Color3(0.02, 0.04, 0.09), // Deep navy zenith
    horizonColor: new Color3(0.68, 0.28, 0.12), // Deep orange/amber horizon
    hazeColor: new Color3(0.35, 0.18, 0.12),
    directionalLight: {
      direction: new Vector3(-0.6, -0.7, 0.4).normalize(),
      diffuse: new Color3(0.92, 0.62, 0.4), // Warm dusk directional
      specular: new Color3(0.5, 0.35, 0.2),
      intensity: 0.72,
    },
    ambientLight: {
      diffuse: new Color3(0.35, 0.42, 0.55),
      groundColor: new Color3(0.12, 0.08, 0.06),
      intensity: 0.38,
    },
    fog: {
      mode: 2, // Scene.FOGMODE_EXP2
      density: 0.006,
      color: new Color3(0.18, 0.11, 0.1),
    },
    starfieldAlpha: 0.15, // Barely visible through twilight
    shimmerIntensity: 0.0,
    shimmerSpeed: 0.0,
  },
  NightClear: {
    phase: 'NightClear',
    zenithColor: new Color3(0.01, 0.02, 0.04), // Deep space zenith
    horizonColor: new Color3(0.07, 0.13, 0.21), // Polar blue horizon
    hazeColor: new Color3(0.04, 0.07, 0.12),
    directionalLight: {
      direction: new Vector3(-0.4, -1.0, 0.3).normalize(),
      diffuse: new Color3(0.75, 0.85, 0.95), // Cold silver moonlight
      specular: new Color3(0.4, 0.5, 0.6),
      intensity: 0.65,
    },
    ambientLight: {
      diffuse: new Color3(0.5, 0.65, 0.85),
      groundColor: new Color3(0.08, 0.1, 0.14),
      intensity: 0.42,
    },
    fog: {
      mode: 2, // Scene.FOGMODE_EXP2
      density: 0.007,
      color: new Color3(0.06, 0.09, 0.14),
    },
    starfieldAlpha: 0.9, // Crisp starfield
    shimmerIntensity: 0.1, // Very subtle natural aurora
    shimmerSpeed: 1.0,
  },
  SignalDistortion: {
    phase: 'SignalDistortion',
    zenithColor: new Color3(0.03, 0.02, 0.07), // Deep corrupted violet/black
    horizonColor: new Color3(0.12, 0.25, 0.28), // Unnatural cyan/green-tinted glow
    hazeColor: new Color3(0.08, 0.16, 0.18),
    directionalLight: {
      direction: new Vector3(-0.35, -0.95, 0.35).normalize(),
      diffuse: new Color3(0.65, 0.92, 0.88), // Unsettling pale cyan moonlight
      specular: new Color3(0.5, 0.7, 0.6),
      intensity: 0.75,
    },
    ambientLight: {
      diffuse: new Color3(0.45, 0.6, 0.7),
      groundColor: new Color3(0.07, 0.12, 0.14),
      intensity: 0.48,
    },
    fog: {
      mode: 2, // Scene.FOGMODE_EXP2
      density: 0.0085,
      color: new Color3(0.07, 0.12, 0.15),
    },
    starfieldAlpha: 0.6,
    shimmerIntensity: 0.85, // Heavy unnatural static and auroral ripple
    shimmerSpeed: 3.2,
  },
};
