/**
 * Milestone 1.0 — Context-Sensitive Hint System Types.
 */

export type HintTier = 'None' | 'Subtle' | 'Directional' | 'Specific';

export interface ObjectiveHintDefinition {
  readonly objectiveId: string;
  readonly subtle: string;
  readonly directional: string;
  readonly specific: string;
}

export interface HintControllerConfig {
  readonly subtleDelaySeconds: number;
  readonly directionalDelaySeconds: number;
  readonly specificDelaySeconds: number;
  readonly devSpeedupMultiplier?: number;
}

export interface HintSnapshot {
  readonly activeObjectiveId: string | null;
  readonly currentTier: HintTier;
  readonly elapsedSinceProgressSeconds: number;
  readonly lastHintText: string | null;
}
