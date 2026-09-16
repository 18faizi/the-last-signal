/**
 * Milestone 1.0 — Objective Controller.
 *
 * Manages active and completed objectives, sub-steps, state transitions,
 * snapshot capture/restore, and event subscriptions.
 */

import {
  type ObjectiveControllerSnapshot,
  type ObjectiveDefinition,
  type ObjectiveSnapshot,
  type ObjectiveState,
  type ObjectiveStep,
} from './ObjectiveTypes';
import { OBJECTIVE_CATALOG } from './objectiveCatalog';

export type ObjectiveEventListener = (
  event:
    | { type: 'activated'; objective: ObjectiveRuntimeState }
    | { type: 'completed'; objective: ObjectiveRuntimeState }
    | { type: 'failed'; objective: ObjectiveRuntimeState }
    | { type: 'stepCompleted'; objective: ObjectiveRuntimeState; stepId: string }
    | { type: 'stateChanged'; objective: ObjectiveRuntimeState },
) => void;

export interface ObjectiveRuntimeState {
  readonly definition: ObjectiveDefinition;
  state: ObjectiveState;
  activatedAt?: number | undefined;
  completedAt?: number | undefined;
  steps: ObjectiveStep[];
}

export class ObjectiveController {
  private readonly objectives = new Map<string, ObjectiveRuntimeState>();
  private activeObjectiveId: string | null = null;
  private readonly history: string[] = [];
  private readonly listeners = new Set<ObjectiveEventListener>();

  constructor(customCatalog: readonly ObjectiveDefinition[] = OBJECTIVE_CATALOG) {
    for (const def of customCatalog) {
      const steps: ObjectiveStep[] = def.steps
        ? def.steps.map((s) => ({ ...s, completed: false }))
        : [];
      this.objectives.set(def.id, {
        definition: def,
        state: 'hidden',
        steps,
      });
    }
  }

  public subscribe(listener: ObjectiveEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(
    event:
      | { type: 'activated'; objective: ObjectiveRuntimeState }
      | { type: 'completed'; objective: ObjectiveRuntimeState }
      | { type: 'failed'; objective: ObjectiveRuntimeState }
      | { type: 'stepCompleted'; objective: ObjectiveRuntimeState; stepId: string }
      | { type: 'stateChanged'; objective: ObjectiveRuntimeState },
  ): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[ObjectiveController] Listener error:', err);
      }
    }
  }

  public activateObjective(id: string, timestamp: number = Date.now()): boolean {
    const obj = this.objectives.get(id);
    if (!obj) {
      console.warn(`[ObjectiveController] Objective ${id} not found.`);
      return false;
    }
    if (obj.state === 'active') {
      return true;
    }
    if (obj.state === 'completed') {
      return false;
    }

    // If another non-optional objective was active, mark it superseded or keep optional separate
    if (this.activeObjectiveId && this.activeObjectiveId !== id) {
      const current = this.objectives.get(this.activeObjectiveId);
      if (current && !current.definition.isOptional && !obj.definition.isOptional) {
        if (current.state === 'active') {
          current.state = 'superseded';
          this.notify({ type: 'stateChanged', objective: current });
        }
      }
    }

    obj.state = 'active';
    obj.activatedAt = timestamp;
    if (!obj.definition.isOptional) {
      this.activeObjectiveId = id;
    }
    this.history.push(id);

    this.notify({ type: 'activated', objective: obj });
    return true;
  }

  public completeObjective(id: string, timestamp: number = Date.now()): boolean {
    const obj = this.objectives.get(id);
    if (!obj) return false;
    if (obj.state === 'completed') return true;

    // Mark any unfinished steps as completed
    for (const s of obj.steps) {
      s.completed = true;
    }

    obj.state = 'completed';
    obj.completedAt = timestamp;

    if (this.activeObjectiveId === id) {
      this.activeObjectiveId = null;
    }

    this.notify({ type: 'completed', objective: obj });
    return true;
  }

  public failObjective(id: string): boolean {
    const obj = this.objectives.get(id);
    if (!obj || obj.state === 'completed') return false;

    obj.state = 'failed';
    if (this.activeObjectiveId === id) {
      this.activeObjectiveId = null;
    }

    this.notify({ type: 'failed', objective: obj });
    return true;
  }

  public completeStep(objectiveId: string, stepId: string): boolean {
    const obj = this.objectives.get(objectiveId);
    if (!obj) return false;

    const step = obj.steps.find((s) => s.id === stepId);
    if (!step || step.completed) return false;

    step.completed = true;
    this.notify({ type: 'stepCompleted', objective: obj, stepId });

    // Check if all steps are completed
    if (obj.steps.length > 0 && obj.steps.every((s) => s.completed)) {
      this.completeObjective(objectiveId);
    }
    return true;
  }

  public getActiveObjective(): ObjectiveRuntimeState | null {
    if (!this.activeObjectiveId) return null;
    return this.objectives.get(this.activeObjectiveId) ?? null;
  }

  public getObjective(id: string): ObjectiveRuntimeState | null {
    return this.objectives.get(id) ?? null;
  }

  public getAllObjectives(): readonly ObjectiveRuntimeState[] {
    return Array.from(this.objectives.values());
  }

  public getCompletedObjectives(): readonly ObjectiveRuntimeState[] {
    return Array.from(this.objectives.values()).filter((o) => o.state === 'completed');
  }

  public isCompleted(id: string): boolean {
    return this.objectives.get(id)?.state === 'completed';
  }

  public captureSnapshot(): ObjectiveControllerSnapshot {
    const objectives: Record<string, ObjectiveSnapshot> = {};
    for (const [id, state] of this.objectives) {
      const stepProgress: Record<string, boolean> = {};
      for (const step of state.steps) {
        stepProgress[step.id] = step.completed;
      }
      objectives[id] = {
        id,
        state: state.state,
        activatedAt: state.activatedAt,
        completedAt: state.completedAt,
        stepProgress,
      };
    }

    return {
      activeObjectiveId: this.activeObjectiveId,
      objectives,
      history: [...this.history],
    };
  }

  public restoreSnapshot(snapshot: ObjectiveControllerSnapshot): void {
    this.activeObjectiveId = snapshot.activeObjectiveId;
    this.history.length = 0;
    this.history.push(...snapshot.history);

    for (const [id, saved] of Object.entries(snapshot.objectives)) {
      const current = this.objectives.get(id);
      if (current) {
        current.state = saved.state;
        current.activatedAt = saved.activatedAt;
        current.completedAt = saved.completedAt;
        for (const step of current.steps) {
          if (step.id in saved.stepProgress) {
            step.completed = saved.stepProgress[step.id] ?? false;
          }
        }
      }
    }
  }

  public reset(): void {
    this.activeObjectiveId = null;
    this.history.length = 0;
    for (const obj of this.objectives.values()) {
      obj.state = 'hidden';
      obj.activatedAt = undefined;
      obj.completedAt = undefined;
      for (const step of obj.steps) {
        step.completed = false;
      }
    }
  }
}
