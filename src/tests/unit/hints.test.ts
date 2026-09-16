/**
 * Unit tests for HintController.
 */

import { describe, expect, it, vi } from 'vitest';
import { HintController } from '../../game/hints/HintController';
import type { ObjectiveHintDefinition } from '../../game/hints/HintTypes';

const testHints: ObjectiveHintDefinition[] = [
  {
    objectiveId: 'obj-test',
    subtle: 'Look around the room.',
    directional: 'Go toward the green door.',
    specific: 'Press E on the green door keycard reader.',
  },
];

describe('HintController', () => {
  it('starts at Tier None with 0 elapsed time', () => {
    const controller = new HintController(
      { subtleDelaySeconds: 10, directionalDelaySeconds: 20, specificDelaySeconds: 30 },
      testHints,
    );
    expect(controller.getCurrentTier()).toBe('None');
    expect(controller.getElapsedSeconds()).toBe(0);
    expect(controller.getLastHintText()).toBeNull();
  });

  it('escalates tiers as time elapses', () => {
    const controller = new HintController(
      { subtleDelaySeconds: 10, directionalDelaySeconds: 20, specificDelaySeconds: 30 },
      testHints,
    );
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.setActiveObjective('obj-test');

    // 5 seconds: still None
    controller.update(5);
    expect(controller.getCurrentTier()).toBe('None');

    // 10 seconds: reaches Subtle
    controller.update(5);
    expect(controller.getCurrentTier()).toBe('Subtle');
    expect(controller.getLastHintText()).toBe('Look around the room.');
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'hintTierChanged', tier: 'Subtle' }),
    );

    // 20 seconds: reaches Directional
    controller.update(10);
    expect(controller.getCurrentTier()).toBe('Directional');
    expect(controller.getLastHintText()).toBe('Go toward the green door.');

    // 30 seconds: reaches Specific
    controller.update(10);
    expect(controller.getCurrentTier()).toBe('Specific');
    expect(controller.getLastHintText()).toBe('Press E on the green door keycard reader.');
  });

  it('resets timer and tier on notifyProgress()', () => {
    const controller = new HintController(
      { subtleDelaySeconds: 10, directionalDelaySeconds: 20, specificDelaySeconds: 30 },
      testHints,
    );
    controller.setActiveObjective('obj-test');
    controller.update(25);
    expect(controller.getCurrentTier()).toBe('Directional');

    controller.notifyProgress();
    expect(controller.getElapsedSeconds()).toBe(0);
    expect(controller.getCurrentTier()).toBe('None');
    expect(controller.getLastHintText()).toBeNull();
  });

  it('supports speedup multiplier for testing and fast pacing', () => {
    const controller = new HintController(
      {
        subtleDelaySeconds: 10,
        directionalDelaySeconds: 20,
        specificDelaySeconds: 30,
        devSpeedupMultiplier: 10,
      },
      testHints,
    );
    controller.setActiveObjective('obj-test');
    controller.update(1.0); // 1.0 * 10 = 10 elapsed
    expect(controller.getCurrentTier()).toBe('Subtle');
  });

  it('captures and restores snapshots', () => {
    const controller = new HintController(
      { subtleDelaySeconds: 10, directionalDelaySeconds: 20, specificDelaySeconds: 30 },
      testHints,
    );
    controller.setActiveObjective('obj-test');
    controller.update(22);

    const snapshot = controller.captureSnapshot();
    expect(snapshot.activeObjectiveId).toBe('obj-test');
    expect(snapshot.currentTier).toBe('Directional');
    expect(snapshot.elapsedSinceProgressSeconds).toBe(22);

    const fresh = new HintController(
      { subtleDelaySeconds: 10, directionalDelaySeconds: 20, specificDelaySeconds: 30 },
      testHints,
    );
    fresh.restoreSnapshot(snapshot);

    expect(fresh.getCurrentTier()).toBe('Directional');
    expect(fresh.getElapsedSeconds()).toBe(22);
  });
});
