/**
 * Unit tests for FinalDecisionController, EndingSequenceController, and RestartController.
 */

import { describe, expect, it, vi } from 'vitest';
import { FinalDecisionController } from '../../game/decision/FinalDecisionController';
import { EndingSequenceController } from '../../game/endings/EndingSequenceController';
import { RestartController } from '../../game/flow/RestartController';
import { NarrativeFactRegistry } from '../../game/narrative/NarrativeFactRegistry';

describe('FinalDecisionController', () => {
  it('allows SILENCE pathway unconditionally', () => {
    const narrative = new NarrativeFactRegistry();
    const decision = new FinalDecisionController(narrative);

    const check = decision.checkPrerequisites('SILENCE');
    expect(check.available).toBe(true);
    expect(check.missingPrerequisites.length).toBe(0);

    const selected = decision.selectPathway('SILENCE');
    expect(selected).toBe(true);
    expect(decision.getSelectedPathway()).toBe('SILENCE');

    const confirmed = decision.confirmSelectedPathway();
    expect(confirmed).toBe('SILENCE');
    expect(decision.getConfirmedPathway()).toBe('SILENCE');
  });

  it('blocks RESPONSE until prerequisites are met in NarrativeFactRegistry', () => {
    const narrative = new NarrativeFactRegistry();
    const decision = new FinalDecisionController(narrative);

    // Initial check: missing both facts
    const initialCheck = decision.checkPrerequisites('RESPONSE');
    expect(initialCheck.available).toBe(false);
    expect(initialCheck.missingPrerequisites.length).toBe(2);

    expect(decision.selectPathway('RESPONSE')).toBe(false);

    // Unlock one prerequisite
    narrative.unlockFact('FirstTransmissionDecoded');
    const midCheck = decision.checkPrerequisites('RESPONSE');
    expect(midCheck.available).toBe(false);
    expect(midCheck.missingPrerequisites.length).toBe(1);

    // Unlock both prerequisites
    narrative.unlockFact('AntennaAligned');
    const finalCheck = decision.checkPrerequisites('RESPONSE');
    expect(finalCheck.available).toBe(true);
    expect(decision.selectPathway('RESPONSE')).toBe(true);
  });

  it('blocks ARCHIVE until source analysis and archive document are discovered', () => {
    const narrative = new NarrativeFactRegistry();
    const decision = new FinalDecisionController(narrative);

    expect(decision.checkPrerequisites('ARCHIVE').available).toBe(false);

    narrative.unlockFact('LocalLoopResultRevealed');
    narrative.unlockFact('ArchiveEvidenceDiscovered');

    expect(decision.checkPrerequisites('ARCHIVE').available).toBe(true);
    expect(decision.selectPathway('ARCHIVE')).toBe(true);
  });

  it('handles cancellation and reset correctly', () => {
    const narrative = new NarrativeFactRegistry();
    const decision = new FinalDecisionController(narrative);

    decision.selectPathway('SILENCE');
    expect(decision.getSelectedPathway()).toBe('SILENCE');

    decision.cancelSelection();
    expect(decision.getSelectedPathway()).toBeNull();
  });
});

describe('EndingSequenceController', () => {
  it('progresses through sequence phases and finishes on skip', () => {
    const sequence = new EndingSequenceController({
      initiatingDurationMs: 100,
      executionDurationMs: 100,
      epilogueDurationMs: 100,
    });
    const listener = vi.fn();
    sequence.subscribe(listener);

    expect(sequence.getCurrentPhase()).toBe('idle');
    sequence.startEnding('RESPONSE');

    expect(sequence.getCurrentPhase()).toBe('initiating');
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'initiating', pathway: 'RESPONSE' }),
    );

    sequence.skipToCompletion();
    expect(sequence.getCurrentPhase()).toBe('completed');
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'completed', pathway: 'RESPONSE', progress: 1.0 }),
    );
  });
});

describe('RestartController', () => {
  it('resets all registered systems and fires restart callback', () => {
    const restartCtrl = new RestartController();
    const mockSystem1 = { reset: vi.fn() };
    const mockSystem2 = { reset: vi.fn() };
    const onRestart = vi.fn();

    restartCtrl.registerSystem(mockSystem1);
    restartCtrl.registerSystem(mockSystem2);
    restartCtrl.setRestartCallback(onRestart);

    restartCtrl.restart();

    expect(mockSystem1.reset).toHaveBeenCalledTimes(1);
    expect(mockSystem2.reset).toHaveBeenCalledTimes(1);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
