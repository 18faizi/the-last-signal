/**
 * Rendering and performance defaults for Milestone 0.1.
 *
 * These are deliberately conservative; the adaptive-quality system planned
 * for a later milestone will read and adjust them at runtime.
 */
export type GraphicsQualityPreset = 'low' | 'medium' | 'high';

export interface PerformanceConfig {
  readonly targetFps: number;
  /** Device pixel ratios above this are clamped to bound fill-rate cost. */
  readonly maxDevicePixelRatio: number;
  readonly initialGraphicsPreset: GraphicsQualityPreset;
  /** Interval (ms) between debug-overlay refreshes; the overlay never updates per frame. */
  readonly debugOverlayUpdateIntervalMs: number;
}

export const performanceConfig: PerformanceConfig = {
  targetFps: 60,
  maxDevicePixelRatio: 2,
  initialGraphicsPreset: 'high',
  debugOverlayUpdateIntervalMs: 250,
};

/**
 * Validates a performance configuration. Exists so tests (and later, user
 * settings import) can reject nonsensical values before they reach the
 * engine.
 */
export function validatePerformanceConfig(config: PerformanceConfig): string[] {
  const problems: string[] = [];
  if (!Number.isFinite(config.targetFps) || config.targetFps <= 0) {
    problems.push(`targetFps must be a positive number, got ${config.targetFps}`);
  }
  if (!Number.isFinite(config.maxDevicePixelRatio) || config.maxDevicePixelRatio < 1) {
    problems.push(`maxDevicePixelRatio must be >= 1, got ${config.maxDevicePixelRatio}`);
  }
  if (config.debugOverlayUpdateIntervalMs < 50) {
    problems.push(
      `debugOverlayUpdateIntervalMs must be >= 50 to avoid per-frame DOM churn, got ${config.debugOverlayUpdateIntervalMs}`,
    );
  }
  return problems;
}
