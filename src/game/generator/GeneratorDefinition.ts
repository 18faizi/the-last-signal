/** Static, tunable generator timing/config values. */
export interface GeneratorDefinition {
  readonly id: string;
  readonly displayName: string;
  /** Seconds the starter control must be held to complete a crank attempt. */
  readonly startupHoldSeconds: number;
  /** Seconds spent in RunningUnstable before settling into Running. */
  readonly warmUpSeconds: number;
  /** Seconds spent in Stopping before reaching Offline. */
  readonly stopDownSeconds: number;
}

export const DEFAULT_GENERATOR_DEFINITION: GeneratorDefinition = {
  id: 'fg-generator-main',
  displayName: 'Facility Generator',
  startupHoldSeconds: 2,
  warmUpSeconds: 5,
  stopDownSeconds: 1,
};
