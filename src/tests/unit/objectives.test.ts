/**
 * Unit tests for ObjectiveController.
 */

import { describe, expect, it, vi } from 'vitest';
import { ObjectiveController } from '../../game/objectives/ObjectiveController';
import type { ObjectiveDefinition } from '../../game/objectives/ObjectiveTypes';

const testCatalog: ObjectiveDefinition[] = [
  {
    id: 'obj-test-1',
    chapterId: 'ch-test',
    title: 'Test Objective 1',
    description: 'First test objective description',
    category: 'Explore',
  },
  {
    id: 'obj-test-2',
    chapterId: 'ch-test',
    title: 'Test Objective 2',
    description: 'Second test objective with steps',
    category: 'Operate',
    steps: [
      { id: 'step-a', description: 'Step A', completed: false },
      { id: 'step-b', description: 'Step B', completed: false },
    ],
  },
  {
    id: 'obj-test-opt',
    chapterId: 'ch-test',
    title: 'Optional Objective',
    description: 'Bonus lore',
    category: 'Optional',
    isOptional: true,
  },
];

describe('ObjectiveController', () => {
  it('initializes all objectives to hidden', () => {
    const controller = new ObjectiveController(testCatalog);
    expect(controller.getActiveObjective()).toBeNull();
    const all = controller.getAllObjectives();
    expect(all.length).toBe(3);
    expect(all.every((o) => o.state === 'hidden')).toBe(true);
  });

  it('activates an objective and notifies listeners', () => {
    const controller = new ObjectiveController(testCatalog);
    const listener = vi.fn();
    controller.subscribe(listener);

    const activated = controller.activateObjective('obj-test-1', 1000);
    expect(activated).toBe(true);

    const active = controller.getActiveObjective();
    expect(active?.definition.id).toBe('obj-test-1');
    expect(active?.state).toBe('active');
    expect(active?.activatedAt).toBe(1000);

    expect(listener).toHaveBeenCalledWith({
      type: 'activated',
      objective: active,
    });
  });

  it('completes an objective and clears active reference', () => {
    const controller = new ObjectiveController(testCatalog);
    controller.activateObjective('obj-test-1', 1000);
    controller.completeObjective('obj-test-1', 2000);

    expect(controller.isCompleted('obj-test-1')).toBe(true);
    expect(controller.getActiveObjective()).toBeNull();
    const completed = controller.getCompletedObjectives();
    expect(completed.length).toBe(1);
    expect(completed[0]?.completedAt).toBe(2000);
  });

  it('handles multi-step objectives and auto-completes when all steps are done', () => {
    const controller = new ObjectiveController(testCatalog);
    controller.activateObjective('obj-test-2', 1000);

    const step1Done = controller.completeStep('obj-test-2', 'step-a');
    expect(step1Done).toBe(true);
    expect(controller.isCompleted('obj-test-2')).toBe(false);

    const step2Done = controller.completeStep('obj-test-2', 'step-b');
    expect(step2Done).toBe(true);
    expect(controller.isCompleted('obj-test-2')).toBe(true);
    expect(controller.getActiveObjective()).toBeNull();
  });

  it('captures and restores snapshots correctly', () => {
    const controller = new ObjectiveController(testCatalog);
    controller.activateObjective('obj-test-2', 1000);
    controller.completeStep('obj-test-2', 'step-a');

    const snapshot = controller.captureSnapshot();
    expect(snapshot.activeObjectiveId).toBe('obj-test-2');
    expect(snapshot.objectives['obj-test-2']?.stepProgress['step-a']).toBe(true);
    expect(snapshot.objectives['obj-test-2']?.stepProgress['step-b']).toBe(false);

    // Create a new controller and restore
    const freshController = new ObjectiveController(testCatalog);
    freshController.restoreSnapshot(snapshot);

    const restoredActive = freshController.getActiveObjective();
    expect(restoredActive?.definition.id).toBe('obj-test-2');
    expect(restoredActive?.steps.find((s) => s.id === 'step-a')?.completed).toBe(true);
    expect(restoredActive?.steps.find((s) => s.id === 'step-b')?.completed).toBe(false);
  });

  it('resets all objectives back to initial state', () => {
    const controller = new ObjectiveController(testCatalog);
    controller.activateObjective('obj-test-1');
    controller.completeObjective('obj-test-1');
    expect(controller.isCompleted('obj-test-1')).toBe(true);

    controller.reset();
    expect(controller.getActiveObjective()).toBeNull();
    expect(controller.isCompleted('obj-test-1')).toBe(false);
    expect(controller.getAllObjectives().every((o) => o.state === 'hidden')).toBe(true);
  });
});
