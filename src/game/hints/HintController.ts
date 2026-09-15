/**
 * Milestone 1.0 — Context-Sensitive Hint Controller.
 *
 * Tracks player struggle / inactivity duration and provides escalating hints
 * (None -> Subtle -> Directional -> Specific). Automatically resets on progress.
 */

import {
  type HintControllerConfig,
  type HintSnapshot,
  type HintTier,
  type ObjectiveHintDefinition,
} from './HintTypes';
import { HINT_CATALOG } from './hintCatalog';

export type HintEventListener = (event: {
  type: 'hintTierChanged' | 'hintRevealed';
  tier: HintTier;
  text: string | null;
  objectiveId: string | null;
}) => void;

const DEFAULT_CONFIG: HintControllerConfig = {
  subtleDelaySeconds: 60,
  directionalDelaySeconds: 120,
  specificDelaySeconds: 180,
  devSpeedupMultiplier: 1.0,
};

export class HintController {
  private readonly config: HintControllerConfig;
  private readonly hints = new Map<string, ObjectiveHintDefinition>();
  private activeObjectiveId: string | null = null;
  private currentTier: HintTier = 'None';
  private elapsedSeconds = 0;
  private lastHintText: string | null = null;
  private readonly listeners = new Set<HintEventListener>();

  constructor(
    config: Partial<HintControllerConfig> = {},
    customCatalog: readonly ObjectiveHintDefinition[] = HINT_CATALOG,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    for (const hint of customCatalog) {
      this.hints.set(hint.objectiveId, hint);
    }
  }

  public subscribe(listener: HintEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(type: 'hintTierChanged' | 'hintRevealed'): void {
    const payload = {
      type,
      tier: this.currentTier,
      text: this.lastHintText,
      objectiveId: this.activeObjectiveId,
    };
    for (const listener of this.listeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error('[HintController] Listener error:', err);
      }
    }
  }

  public setActiveObjective(objectiveId: string | null): void {
    if (this.activeObjectiveId === objectiveId) return;
    this.activeObjectiveId = objectiveId;
    this.resetTimer();
  }

  public notifyProgress(): void {
    this.resetTimer();
  }

  public resetTimer(): void {
    this.elapsedSeconds = 0;
    if (this.currentTier !== 'None') {
      this.currentTier = 'None';
      this.lastHintText = null;
      this.notify('hintTierChanged');
    }
  }

  public update(deltaSeconds: number): void {
    if (!this.activeObjectiveId) return;
    const speedup = this.config.devSpeedupMultiplier ?? 1.0;
    this.elapsedSeconds += deltaSeconds * speedup;

    const previousTier = this.currentTier;
    if (this.elapsedSeconds >= this.config.specificDelaySeconds) {
      this.currentTier = 'Specific';
    } else if (this.elapsedSeconds >= this.config.directionalDelaySeconds) {
      this.currentTier = 'Directional';
    } else if (this.elapsedSeconds >= this.config.subtleDelaySeconds) {
      this.currentTier = 'Subtle';
    } else {
      this.currentTier = 'None';
    }

    if (this.currentTier !== previousTier) {
      this.lastHintText = this.resolveHintText(this.currentTier);
      this.notify('hintTierChanged');
    }
  }

  public requestCurrentHint(): string | null {
    if (!this.activeObjectiveId) return null;
    const hintDef = this.hints.get(this.activeObjectiveId);
    if (!hintDef) return null;

    // Return the highest unlocked tier, or subtle if none yet unlocked
    const tier = this.currentTier === 'None' ? 'Subtle' : this.currentTier;
    const text = this.resolveHintText(tier);
    this.lastHintText = text;
    this.notify('hintRevealed');
    return text;
  }

  private resolveHintText(tier: HintTier): string | null {
    if (!this.activeObjectiveId || tier === 'None') return null;
    const def = this.hints.get(this.activeObjectiveId);
    if (!def) return null;

    switch (tier) {
      case 'Subtle':
        return def.subtle;
      case 'Directional':
        return def.directional;
      case 'Specific':
        return def.specific;
      default:
        return null;
    }
  }

  public getCurrentTier(): HintTier {
    return this.currentTier;
  }

  public getElapsedSeconds(): number {
    return this.elapsedSeconds;
  }

  public getLastHintText(): string | null {
    return this.lastHintText;
  }

  public captureSnapshot(): HintSnapshot {
    return {
      activeObjectiveId: this.activeObjectiveId,
      currentTier: this.currentTier,
      elapsedSinceProgressSeconds: this.elapsedSeconds,
      lastHintText: this.lastHintText,
    };
  }

  public restoreSnapshot(snapshot: HintSnapshot): void {
    this.activeObjectiveId = snapshot.activeObjectiveId;
    this.currentTier = snapshot.currentTier;
    this.elapsedSeconds = snapshot.elapsedSinceProgressSeconds;
    this.lastHintText = snapshot.lastHintText;
  }

  public reset(): void {
    this.activeObjectiveId = null;
    this.currentTier = 'None';
    this.elapsedSeconds = 0;
    this.lastHintText = null;
  }
}
