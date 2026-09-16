import { describe, it, expect } from 'vitest';
import {
  canTransitionChapter,
  assertChapterTransition,
  ALL_GAME_CHAPTERS,
} from '../../game/flow/GameChapter';
import { GameFlowState } from '../../game/flow/GameFlowState';

describe('GameChapter model', () => {
  it('defines 10 distinct chapters', () => {
    expect(ALL_GAME_CHAPTERS).toHaveLength(10);
  });

  it('allows forward progression along the critical path', () => {
    expect(canTransitionChapter('Arrival', 'CompoundEntry')).toBe(true);
    expect(canTransitionChapter('CompoundEntry', 'FacilityInvestigation')).toBe(true);
    expect(canTransitionChapter('FacilityInvestigation', 'PowerRestoration')).toBe(true);
    expect(canTransitionChapter('PowerRestoration', 'SignalDiscovery')).toBe(true);
    expect(canTransitionChapter('SignalDiscovery', 'SourceAnalysis')).toBe(true);
    expect(canTransitionChapter('SourceAnalysis', 'ThreatAftermath')).toBe(true);
    expect(canTransitionChapter('ThreatAftermath', 'FinalDecision')).toBe(true);
    expect(canTransitionChapter('FinalDecision', 'Ending')).toBe(true);
    expect(canTransitionChapter('Ending', 'PostCompletion')).toBe(true);
  });

  it('rejects illegal skipped transitions', () => {
    expect(canTransitionChapter('Arrival', 'PowerRestoration')).toBe(false);
    expect(canTransitionChapter('CompoundEntry', 'Ending')).toBe(false);
    expect(canTransitionChapter('Arrival', 'Arrival')).toBe(false);
    expect(() => assertChapterTransition('Arrival', 'Ending')).toThrow(
      'Illegal chapter transition',
    );
  });

  it('allows PostCompletion to restart to Arrival', () => {
    expect(canTransitionChapter('PostCompletion', 'Arrival')).toBe(true);
  });
});

describe('GameFlowState', () => {
  it('initializes in Arrival chapter with unstarted clock', () => {
    const flow = new GameFlowState();
    expect(flow.chapter).toBe('Arrival');
    expect(flow.isGameStarted).toBe(false);
    expect(flow.isFinalDecisionUnlocked).toBe(false);
    expect(flow.chosenEndingId).toBeNull();
  });

  it('starts game clock and ticks elapsed time', () => {
    const flow = new GameFlowState();
    flow.startGame();
    expect(flow.isGameStarted).toBe(true);
    flow.tick(1.5);
    flow.tick(2.0);
    expect(flow.elapsedTime).toBeCloseTo(3.5);
  });

  it('emits event on valid chapter transition', () => {
    const flow = new GameFlowState();
    const events: string[] = [];
    flow.subscribe((e) => {
      if (e.kind === 'ChapterChanged') {
        events.push(`${e.previousChapter}->${e.chapter}`);
      }
    });

    flow.advanceToChapter('CompoundEntry');
    expect(flow.chapter).toBe('CompoundEntry');
    expect(events).toEqual(['Arrival->CompoundEntry']);
  });

  it('unlocks final decision and chooses ending atomically', () => {
    const flow = new GameFlowState();
    flow.advanceToChapter('CompoundEntry');
    flow.advanceToChapter('FacilityInvestigation');
    flow.advanceToChapter('PowerRestoration');
    flow.advanceToChapter('SignalDiscovery');
    flow.advanceToChapter('SourceAnalysis');
    flow.advanceToChapter('ThreatAftermath');
    flow.advanceToChapter('FinalDecision');

    flow.unlockFinalDecision();
    expect(flow.isFinalDecisionUnlocked).toBe(true);

    flow.chooseEnding('ending-silence');
    expect(flow.chosenEndingId).toBe('ending-silence');
    expect(flow.chapter).toBe('Ending');

    // Duplicate choice is rejected
    expect(() => flow.chooseEnding('ending-response')).toThrow('Ending already chosen');
  });

  it('captures and restores snapshot cleanly', () => {
    const flow = new GameFlowState();
    flow.advanceToChapter('CompoundEntry');
    flow.syncObjectives(['obj-enter-compound'], ['obj-reach-station']);
    flow.unlockEnding('ending-silence');

    const snap = flow.getSnapshot();
    expect(snap.chapter).toBe('CompoundEntry');
    expect(snap.activeObjectiveIds).toEqual(['obj-enter-compound']);

    const fresh = new GameFlowState();
    fresh.restoreSnapshot(snap);
    expect(fresh.chapter).toBe('CompoundEntry');
    expect(fresh.getSnapshot().unlockedEndingIds).toContain('ending-silence');
  });

  it('resets back to initial Arrival state', () => {
    const flow = new GameFlowState();
    flow.startGame();
    flow.advanceToChapter('CompoundEntry');
    flow.reset();

    expect(flow.chapter).toBe('Arrival');
    expect(flow.isGameStarted).toBe(false);
    expect(flow.elapsedTime).toBe(0);
  });
});
