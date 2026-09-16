/**
 * Milestone 1.0 — Objective System Types & Definitions.
 *
 * Provides typed definitions for chapters, primary/secondary objectives,
 * categories, states, and lifecycle event callbacks.
 */

export type ObjectiveCategory =
  'Explore' | 'Access' | 'Restore' | 'Investigate' | 'Operate' | 'Survive' | 'Decide' | 'Optional';

export type ObjectiveState =
  'hidden' | 'available' | 'active' | 'completed' | 'failed' | 'superseded';

export interface ObjectiveStep {
  readonly id: string;
  readonly description: string;
  completed: boolean;
}

export interface ObjectiveDefinition {
  readonly id: string;
  readonly chapterId: string;
  readonly title: string;
  readonly description: string;
  readonly category: ObjectiveCategory;
  readonly isOptional?: boolean;
  readonly hintText?: string;
  readonly steps?: readonly ObjectiveStep[];
}

export interface ObjectiveSnapshot {
  readonly id: string;
  readonly state: ObjectiveState;
  readonly activatedAt?: number | undefined;
  readonly completedAt?: number | undefined;
  readonly stepProgress: Record<string, boolean>;
}

export interface ObjectiveControllerSnapshot {
  readonly activeObjectiveId: string | null;
  readonly objectives: Record<string, ObjectiveSnapshot>;
  readonly history: readonly string[];
}
