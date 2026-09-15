/**
 * GameFlowState orchestration layer (Milestone 1.0).
 *
 * Coordinates chapter-level progression, critical-path flow, ending selection,
 * and completion state without duplicating individual domain internals.
 */
import { type GameChapter, canTransitionChapter, assertChapterTransition } from './GameChapter';

export interface GameFlowSnapshot {
  readonly chapter: GameChapter;
  readonly activeObjectiveIds: readonly string[];
  readonly completedObjectiveIds: readonly string[];
  readonly unlockedEndingIds: readonly string[];
  readonly chosenEndingId: string | null;
  readonly gameCompleted: boolean;
}

export interface GameCompletionState {
  readonly gameStarted: boolean;
  readonly startTimeSeconds: number | null;
  readonly currentChapter: GameChapter;
  readonly finalDecisionUnlocked: boolean;
  readonly endingChosen: string | null;
  readonly endingCompleted: boolean;
  readonly postEndingActive: boolean;
  readonly completionTimestamp: number | null;
  readonly elapsedDurationSeconds: number;
}

export type GameFlowEvent =
  | {
      readonly kind: 'ChapterChanged';
      readonly chapter: GameChapter;
      readonly previousChapter: GameChapter;
    }
  | { readonly kind: 'FinalDecisionUnlocked' }
  | { readonly kind: 'EndingUnlocked'; readonly endingId: string }
  | { readonly kind: 'EndingChosen'; readonly endingId: string }
  | { readonly kind: 'EndingSequenceCompleted'; readonly endingId: string }
  | { readonly kind: 'PostCompletionEntered' }
  | { readonly kind: 'FlowReset' };

export type GameFlowListener = (event: GameFlowEvent) => void;

export class GameFlowState {
  private currentChapter: GameChapter = 'Arrival';
  private gameStarted = false;
  private startTimeSeconds: number | null = null;
  private elapsedSeconds = 0;
  private finalDecisionUnlocked = false;
  private _unlockedEndings = new Set<string>();
  private chosenEnding: string | null = null;
  private endingCompleted = false;
  private postEndingActive = false;
  private completionTimestamp: number | null = null;

  private activeObjectiveIds: string[] = [];
  private completedObjectiveIds: string[] = [];

  private readonly listeners = new Set<GameFlowListener>();

  get chapter(): GameChapter {
    return this.currentChapter;
  }

  get currentChapterId(): GameChapter {
    return this.currentChapter;
  }

  get isGameStarted(): boolean {
    return this.gameStarted;
  }

  get isFinalDecisionUnlocked(): boolean {
    return this.finalDecisionUnlocked;
  }

  get chosenEndingId(): string | null {
    return this.chosenEnding;
  }

  get isEndingCompleted(): boolean {
    return this.endingCompleted;
  }

  get isPostEndingActive(): boolean {
    return this.postEndingActive;
  }

  get elapsedTime(): number {
    return this.elapsedSeconds;
  }

  get elapsedPlaytimeSeconds(): number {
    return this.elapsedSeconds;
  }

  get unlockedEndingsList(): readonly string[] {
    return Array.from(this._unlockedEndings);
  }

  get unlockedEndings(): readonly string[] {
    return Array.from(this._unlockedEndings);
  }

  startGame(): void {
    if (this.gameStarted) return;
    this.gameStarted = true;
    this.startTimeSeconds = 0;
    this.elapsedSeconds = 0;
  }

  tick(deltaSeconds: number): void {
    if (!this.gameStarted || this.endingCompleted) return;
    this.elapsedSeconds += Math.max(0, deltaSeconds);
  }

  updatePlaytime(deltaSeconds: number): void {
    this.tick(deltaSeconds);
  }

  advanceToChapter(target: GameChapter): void {
    if (this.currentChapter === target) return;
    assertChapterTransition(this.currentChapter, target);
    const prev = this.currentChapter;
    this.currentChapter = target;
    this.emit({ kind: 'ChapterChanged', chapter: target, previousChapter: prev });
  }

  transitionChapter(target: GameChapter): void {
    this.advanceToChapter(target);
  }

  forceChapter(target: GameChapter): void {
    if (this.currentChapter === target) return;
    const prev = this.currentChapter;
    this.currentChapter = target;
    this.emit({ kind: 'ChapterChanged', chapter: target, previousChapter: prev });
  }

  canAdvanceTo(target: GameChapter): boolean {
    return canTransitionChapter(this.currentChapter, target);
  }

  unlockFinalDecision(): void {
    if (this.finalDecisionUnlocked) return;
    this.finalDecisionUnlocked = true;
    this.emit({ kind: 'FinalDecisionUnlocked' });
  }

  unlockEnding(endingId: string): void {
    if (this._unlockedEndings.has(endingId)) return;
    this._unlockedEndings.add(endingId);
    this.emit({ kind: 'EndingUnlocked', endingId });
  }

  chooseEnding(endingId: string): void {
    if (this.chosenEnding !== null) {
      throw new Error(`Ending already chosen: ${this.chosenEnding}`);
    }
    this.chosenEnding = endingId;
    this.advanceToChapter('Ending');
    this.emit({ kind: 'EndingChosen', endingId });
  }

  completeEnding(): void {
    if (this.endingCompleted) return;
    this.endingCompleted = true;
    this.completionTimestamp = Date.now();
    if (this.chosenEnding !== null) {
      this.emit({ kind: 'EndingSequenceCompleted', endingId: this.chosenEnding });
    }
  }

  enterPostCompletion(): void {
    if (this.postEndingActive) return;
    this.postEndingActive = true;
    this.advanceToChapter('PostCompletion');
    this.emit({ kind: 'PostCompletionEntered' });
  }

  syncObjectives(active: readonly string[], completed: readonly string[]): void {
    this.activeObjectiveIds = [...active];
    this.completedObjectiveIds = [...completed];
  }

  recordEndingChoice(endingId: string): void {
    this.chosenEnding = endingId;
  }

  captureSnapshot(): GameFlowSnapshot {
    return this.getSnapshot();
  }

  getSnapshot(): GameFlowSnapshot {
    return {
      chapter: this.currentChapter,
      activeObjectiveIds: [...this.activeObjectiveIds],
      completedObjectiveIds: [...this.completedObjectiveIds],
      unlockedEndingIds: Array.from(this._unlockedEndings),
      chosenEndingId: this.chosenEnding,
      gameCompleted: this.endingCompleted,
    };
  }

  getCompletionState(): GameCompletionState {
    return {
      gameStarted: this.gameStarted,
      startTimeSeconds: this.startTimeSeconds,
      currentChapter: this.currentChapter,
      finalDecisionUnlocked: this.finalDecisionUnlocked,
      endingChosen: this.chosenEnding,
      endingCompleted: this.endingCompleted,
      postEndingActive: this.postEndingActive,
      completionTimestamp: this.completionTimestamp,
      elapsedDurationSeconds: this.elapsedSeconds,
    };
  }

  restoreSnapshot(snapshot: GameFlowSnapshot): void {
    this.currentChapter = snapshot.chapter;
    this.activeObjectiveIds = [...snapshot.activeObjectiveIds];
    this.completedObjectiveIds = [...snapshot.completedObjectiveIds];
    this._unlockedEndings = new Set(snapshot.unlockedEndingIds);
    this.chosenEnding = snapshot.chosenEndingId;
    this.endingCompleted = snapshot.gameCompleted;
  }

  reset(): void {
    this.currentChapter = 'Arrival';
    this.gameStarted = false;
    this.startTimeSeconds = null;
    this.elapsedSeconds = 0;
    this.finalDecisionUnlocked = false;
    this._unlockedEndings.clear();
    this.chosenEnding = null;
    this.endingCompleted = false;
    this.postEndingActive = false;
    this.completionTimestamp = null;
    this.activeObjectiveIds = [];
    this.completedObjectiveIds = [];
    this.emit({ kind: 'FlowReset' });
  }

  subscribe(listener: GameFlowListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: GameFlowEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[GameFlowState] Listener threw:', err);
      }
    }
  }
}
