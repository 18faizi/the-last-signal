import { Engine } from '@babylonjs/core/Engines/engine';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import type { EnvironmentInfo } from '../../config/environment';
import type { PerformanceConfig } from '../../config/performanceConfig';
import { GameError } from '../errors/GameError';
import type { EngineCapabilities } from './EngineCapabilities';

export interface CreatedEngine {
  readonly engine: AbstractEngine;
  readonly capabilities: EngineCapabilities;
}

/**
 * Creates the Babylon engine, preferring WebGPU and falling back to WebGL.
 *
 * A failed WebGPU attempt is treated as recoverable: it is logged in
 * development and the factory proceeds to WebGL. Only when no backend can be
 * created does the factory throw an `engine-init` GameError.
 */
export class EngineFactory {
  private readonly environment: EnvironmentInfo;
  private readonly performance: PerformanceConfig;

  constructor(environment: EnvironmentInfo, performance: PerformanceConfig) {
    this.environment = environment;
    this.performance = performance;
  }

  async createEngine(canvas: HTMLCanvasElement): Promise<CreatedEngine> {
    const engineOptions = {
      antialias: true,
      adaptToDeviceRatio: false,
    };

    let engine: AbstractEngine | null = null;
    let backend: EngineCapabilities['backend'] = 'unknown';

    if (await this.isWebGpuAvailable()) {
      try {
        const webgpuEngine = new WebGPUEngine(canvas, engineOptions);
        await webgpuEngine.initAsync();
        engine = webgpuEngine;
        backend = 'webgpu';
      } catch (error) {
        if (this.environment.isDevelopment) {
          console.warn('[engine] WebGPU initialization failed, falling back to WebGL', error);
        }
      }
    }

    if (engine === null) {
      try {
        engine = new Engine(canvas, engineOptions.antialias, {
          adaptToDeviceRatio: engineOptions.adaptToDeviceRatio,
        });
        backend = 'webgl';
      } catch (error) {
        throw GameError.wrap('engine-init', error, 'Failed to create WebGL engine');
      }
    }

    this.applyPixelRatioCap(engine);

    if (this.environment.isDevelopment) {
      console.info(`[engine] rendering backend: ${backend}`);
    }

    return { engine, capabilities: this.readCapabilities(engine, backend) };
  }

  private async isWebGpuAvailable(): Promise<boolean> {
    if (!('gpu' in navigator)) {
      return false;
    }
    try {
      return await WebGPUEngine.IsSupportedAsync;
    } catch {
      return false;
    }
  }

  /**
   * Very high-DPI displays multiply fill-rate cost; rendering above the
   * configured cap has little visible benefit for this game's art style.
   */
  private applyPixelRatioCap(engine: AbstractEngine): void {
    const deviceRatio = window.devicePixelRatio || 1;
    const cappedRatio = Math.min(deviceRatio, this.performance.maxDevicePixelRatio);
    // Babylon expresses resolution as a scaling level: 1 = one engine pixel
    // per canvas CSS pixel, 0.5 = double resolution. Level = 1 / ratio.
    engine.setHardwareScalingLevel(1 / cappedRatio);
  }

  private readCapabilities(
    engine: AbstractEngine,
    backend: EngineCapabilities['backend'],
  ): EngineCapabilities {
    return {
      backend,
      hardwareScalingLevel: engine.getHardwareScalingLevel(),
      devicePixelRatio: window.devicePixelRatio || 1,
      userAgent: navigator.userAgent,
      renderWidth: engine.getRenderWidth(),
      renderHeight: engine.getRenderHeight(),
      physicsReady: false,
    };
  }
}
