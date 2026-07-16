import { describe, expect, it } from 'vitest';
import {
  canTransitionGeneratorState,
  isGeneratorRunning,
  tryTransitionGeneratorState,
} from '../../game/generator/GeneratorState';

describe('GeneratorState transitions', () => {
  it('allows the documented forward chain', () => {
    expect(canTransitionGeneratorState('Offline', 'InspectionRequired')).toBe(true);
    expect(canTransitionGeneratorState('InspectionRequired', 'NotReady')).toBe(true);
    expect(canTransitionGeneratorState('NotReady', 'ReadyToStart')).toBe(true);
    expect(canTransitionGeneratorState('ReadyToStart', 'Cranking')).toBe(true);
    expect(canTransitionGeneratorState('Cranking', 'RunningUnstable')).toBe(true);
    expect(canTransitionGeneratorState('RunningUnstable', 'Running')).toBe(true);
    expect(canTransitionGeneratorState('Running', 'Stopping')).toBe(true);
    expect(canTransitionGeneratorState('Stopping', 'Offline')).toBe(true);
  });

  it('rejects illegal jumps', () => {
    expect(canTransitionGeneratorState('Offline', 'Running')).toBe(false);
    expect(canTransitionGeneratorState('NotReady', 'Cranking')).toBe(false);
    expect(canTransitionGeneratorState('Running', 'ReadyToStart')).toBe(false);
    expect(canTransitionGeneratorState('Fault', 'Running')).toBe(false);
  });

  it('allows recovery paths: Cranking → ReadyToStart (cancelled), any running state → Fault', () => {
    expect(canTransitionGeneratorState('Cranking', 'ReadyToStart')).toBe(true);
    expect(canTransitionGeneratorState('Cranking', 'Fault')).toBe(true);
    expect(canTransitionGeneratorState('RunningUnstable', 'Fault')).toBe(true);
    expect(canTransitionGeneratorState('Running', 'Fault')).toBe(true);
    expect(canTransitionGeneratorState('Fault', 'Offline')).toBe(true);
  });

  it('tryTransitionGeneratorState returns null on same-state and illegal transitions', () => {
    expect(tryTransitionGeneratorState('Offline', 'Offline')).toBeNull();
    expect(tryTransitionGeneratorState('Offline', 'Running')).toBeNull();
    expect(tryTransitionGeneratorState('Offline', 'InspectionRequired')).toBe('InspectionRequired');
  });

  it('isGeneratorRunning is true only for RunningUnstable/Running', () => {
    expect(isGeneratorRunning('RunningUnstable')).toBe(true);
    expect(isGeneratorRunning('Running')).toBe(true);
    expect(isGeneratorRunning('Offline')).toBe(false);
    expect(isGeneratorRunning('ReadyToStart')).toBe(false);
  });
});
