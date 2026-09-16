// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { AtmosphereController } from '../sky/AtmosphereController';
import { HorizonBackdrop } from '../vista/HorizonBackdrop';
import { ATMOSPHERE_PHASE_PRESETS } from '../types';

describe('AtmosphereController', () => {
  let scene: Scene;
  let moonLight: DirectionalLight;
  let hemiLight: HemisphericLight;

  beforeEach(() => {
    const mockGradient = {
      addColorStop: vi.fn(),
    };
    const mockCtx = {
      createLinearGradient: vi.fn(() => mockGradient),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillStyle: '',
      globalAlpha: 1.0,
      filter: '',
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx as unknown as RenderingContext,
    );

    scene = new Scene(new NullEngine());
    moonLight = new DirectionalLight('test-moon', new Vector3(0, -1, 0), scene);
    hemiLight = new HemisphericLight('test-hemi', new Vector3(0, 1, 0), scene);
  });

  it('initializes with default NightClear phase and configures EXP2 fog', () => {
    const controller = new AtmosphereController(scene, {
      initialPhase: 'NightClear',
      moonLight,
      hemiLight,
      autoHookRenderObservable: false,
    });

    expect(controller.currentPhase).toBe('NightClear');
    expect(controller.targetPhase).toBeNull();
    expect(controller.isTransitioning).toBe(false);
    expect(controller.transitionProgress).toBe(1.0);

    // Fog verification
    expect(scene.fogMode).toBe(Scene.FOGMODE_EXP2);
    expect(scene.fogDensity).toBeCloseTo(ATMOSPHERE_PHASE_PRESETS.NightClear.fog.density, 4);
    expect(scene.fogColor.r).toBeCloseTo(ATMOSPHERE_PHASE_PRESETS.NightClear.fog.color.r, 2);

    // Light verification
    expect(moonLight.intensity).toBeCloseTo(
      ATMOSPHERE_PHASE_PRESETS.NightClear.directionalLight.intensity,
      2,
    );
    expect(hemiLight.intensity).toBeCloseTo(
      ATMOSPHERE_PHASE_PRESETS.NightClear.ambientLight.intensity,
      2,
    );

    controller.dispose();
  });

  it('supports custom initial phase (Dusk)', () => {
    const controller = new AtmosphereController(scene, {
      initialPhase: 'Dusk',
      moonLight,
      hemiLight,
      autoHookRenderObservable: false,
    });

    expect(controller.currentPhase).toBe('Dusk');
    expect(moonLight.intensity).toBeCloseTo(
      ATMOSPHERE_PHASE_PRESETS.Dusk.directionalLight.intensity,
      2,
    );

    controller.dispose();
  });

  it('smoothly interpolates between sky phases over duration', () => {
    const controller = new AtmosphereController(scene, {
      initialPhase: 'NightClear',
      moonLight,
      hemiLight,
      autoHookRenderObservable: false,
    });

    // Start transition to SignalDistortion over 2.0 seconds
    controller.transitionTo('SignalDistortion', 2.0);

    expect(controller.isTransitioning).toBe(true);
    expect(controller.targetPhase).toBe('SignalDistortion');
    expect(controller.transitionProgress).toBe(0.0);

    // Advance 1.0 second (50% progress)
    controller.update(1.0);
    expect(controller.isTransitioning).toBe(true);
    expect(controller.transitionProgress).toBeCloseTo(0.5, 2);

    const initialMoonIntensity = ATMOSPHERE_PHASE_PRESETS.NightClear.directionalLight.intensity;
    const targetMoonIntensity =
      ATMOSPHERE_PHASE_PRESETS.SignalDistortion.directionalLight.intensity;
    expect(moonLight.intensity).toBeGreaterThan(initialMoonIntensity);
    expect(moonLight.intensity).toBeLessThan(targetMoonIntensity);

    // Advance remaining 1.0 second (100% progress)
    controller.update(1.0);
    expect(controller.isTransitioning).toBe(false);
    expect(controller.currentPhase).toBe('SignalDistortion');
    expect(controller.targetPhase).toBeNull();
    expect(controller.transitionProgress).toBe(1.0);
    expect(moonLight.intensity).toBeCloseTo(targetMoonIntensity, 2);

    controller.dispose();
  });

  it('transitions immediately when duration is 0', () => {
    const controller = new AtmosphereController(scene, {
      initialPhase: 'NightClear',
      moonLight,
      hemiLight,
      autoHookRenderObservable: false,
    });

    controller.transitionTo('Dusk', 0);
    expect(controller.currentPhase).toBe('Dusk');
    expect(controller.isTransitioning).toBe(false);
    expect(moonLight.intensity).toBeCloseTo(
      ATMOSPHERE_PHASE_PRESETS.Dusk.directionalLight.intensity,
      2,
    );

    controller.dispose();
  });

  it('handles immediate phase set via setPhaseImmediate', () => {
    const controller = new AtmosphereController(scene, {
      initialPhase: 'NightClear',
      moonLight,
      hemiLight,
      autoHookRenderObservable: false,
    });

    controller.setPhaseImmediate('SignalDistortion');
    expect(controller.currentPhase).toBe('SignalDistortion');
    expect(controller.isTransitioning).toBe(false);

    controller.dispose();
  });

  it('ignores transitionTo when already on the requested phase and not transitioning', () => {
    const controller = new AtmosphereController(scene, {
      initialPhase: 'NightClear',
      moonLight,
      hemiLight,
      autoHookRenderObservable: false,
    });

    controller.transitionTo('NightClear', 2.0);
    expect(controller.isTransitioning).toBe(false);
    expect(controller.targetPhase).toBeNull();

    controller.dispose();
  });

  it('allows interrupting an in-flight transition with a new target phase', () => {
    const controller = new AtmosphereController(scene, {
      initialPhase: 'NightClear',
      moonLight,
      hemiLight,
      autoHookRenderObservable: false,
    });

    // Begin transition towards Dusk
    controller.transitionTo('Dusk', 2.0);
    controller.update(0.5); // 25% towards Dusk
    expect(controller.targetPhase).toBe('Dusk');

    // Switch mid-transition to SignalDistortion
    controller.transitionTo('SignalDistortion', 1.0);
    expect(controller.targetPhase).toBe('SignalDistortion');
    expect(controller.transitionProgress).toBe(0.0);

    // Complete the new transition
    controller.update(1.0);
    expect(controller.currentPhase).toBe('SignalDistortion');
    expect(controller.isTransitioning).toBe(false);

    controller.dispose();
  });

  it('cleans up all resources on dispose without throwing', () => {
    const controller = new AtmosphereController(scene, {
      initialPhase: 'NightClear',
      moonLight,
      hemiLight,
      autoHookRenderObservable: true,
    });

    expect(() => {
      controller.dispose();
    }).not.toThrow();

    // Calling update after dispose should safely no-op
    expect(() => {
      controller.update(0.016);
    }).not.toThrow();
  });
});

describe('HorizonBackdrop', () => {
  let scene: Scene;

  beforeEach(() => {
    scene = new Scene(new NullEngine());
  });

  it('constructs low-poly distant mountain rings and road without physics colliders', () => {
    const backdrop = new HorizonBackdrop(scene, {
      ringRadius: 250,
      segments: 32,
    });

    // Fog should be initialized to EXP2
    expect(scene.fogMode).toBe(Scene.FOGMODE_EXP2);
    expect(scene.fogDensity).toBeCloseTo(0.007, 3);

    // Every mesh created must have checkCollisions = false and isPickable = false
    const meshes = scene.meshes;
    expect(meshes.length).toBeGreaterThan(0);

    for (const mesh of meshes) {
      expect(mesh.checkCollisions).toBe(false);
      expect(mesh.isPickable).toBe(false);
    }

    backdrop.dispose();
  });

  it('allows dynamically updating fog parameters', () => {
    const backdrop = new HorizonBackdrop(scene);

    backdrop.setFogParameters(0.012, new Color3(0.1, 0.2, 0.3));
    expect(scene.fogDensity).toBeCloseTo(0.012, 4);
    expect(scene.fogColor.r).toBeCloseTo(0.1, 2);
    expect(scene.fogColor.g).toBeCloseTo(0.2, 2);
    expect(scene.fogColor.b).toBeCloseTo(0.3, 2);

    backdrop.dispose();
  });

  it('disposes cleanly without throwing', () => {
    const backdrop = new HorizonBackdrop(scene);

    expect(() => {
      backdrop.dispose();
    }).not.toThrow();
  });
});
