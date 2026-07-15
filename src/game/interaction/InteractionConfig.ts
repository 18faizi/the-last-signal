/** Centralized interaction tuning. */
export interface InteractionConfig {
  /** Default maximum interaction distance in metres. */
  readonly interactionDistance: number;
  /** Raycast probe length (longer than interaction range, for debug/out-of-range detection). */
  readonly probeDistance: number;
  /** Focus loss grace period in seconds (focus-stability strategy). */
  readonly focusGraceSeconds: number;
  /** Development artificial async delay for the async test target (ms). */
  readonly devAsyncDelayMs: number;
}

export const DEFAULT_INTERACTION_CONFIG: InteractionConfig = {
  interactionDistance: 2.6,
  probeDistance: 8,
  focusGraceSeconds: 0.15,
  devAsyncDelayMs: 600,
};

export function validateInteractionConfig(config: InteractionConfig): string[] {
  const problems: string[] = [];
  if (config.interactionDistance <= 0) {
    problems.push('interactionDistance must be positive');
  }
  if (config.probeDistance < config.interactionDistance) {
    problems.push('probeDistance must be at least interactionDistance');
  }
  if (config.focusGraceSeconds < 0 || config.focusGraceSeconds > 1) {
    problems.push('focusGraceSeconds must be within [0, 1]');
  }
  return problems;
}
