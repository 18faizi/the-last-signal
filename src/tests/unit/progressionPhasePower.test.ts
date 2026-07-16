import { describe, expect, it } from 'vitest';
import {
  canAdvancePhase,
  comparePhase,
  isPhaseComplete,
  tryAdvancePhase,
} from '../../game/facility/ProgressionPhase';
import { FacilityRuntimeState } from '../../game/facility/FacilityRuntimeState';

describe('ProgressionPhase — Milestone 0.6 power chain', () => {
  it('extends GreyboxComplete with a new linear chain', () => {
    expect(canAdvancePhase('GreyboxComplete', 'GeneratorStarted')).toBe(true);
    expect(canAdvancePhase('GeneratorStarted', 'MainPowerAvailable')).toBe(true);
    expect(canAdvancePhase('MainPowerAvailable', 'ControlRoomPowered')).toBe(true);
    expect(canAdvancePhase('ControlRoomPowered', 'ReceiverActivated')).toBe(true);
    expect(canAdvancePhase('ReceiverActivated', 'PowerNetworkOperational')).toBe(true);
  });

  it('rejects skipping ahead in the power chain', () => {
    expect(canAdvancePhase('GreyboxComplete', 'PowerNetworkOperational')).toBe(false);
    expect(canAdvancePhase('GreyboxComplete', 'ControlRoomPowered')).toBe(false);
  });

  it('PowerNetworkOperational is terminal (no successors)', () => {
    expect(tryAdvancePhase('PowerNetworkOperational', 'GreyboxComplete')).toBeNull();
  });

  it('comparePhase orders the power chain after GreyboxComplete', () => {
    expect(comparePhase('GeneratorStarted', 'GreyboxComplete')).toBeGreaterThan(0);
    expect(comparePhase('PowerNetworkOperational', 'RooftopAccessed')).toBeGreaterThan(0);
  });

  it('isPhaseComplete still recognizes only GreyboxComplete (M0.5 contract unchanged)', () => {
    expect(isPhaseComplete('GreyboxComplete')).toBe(true);
    expect(isPhaseComplete('PowerNetworkOperational')).toBe(false);
  });

  it('existing M0.5 forward chain to GreyboxComplete is unaffected by the extension', () => {
    let phase: Parameters<typeof tryAdvancePhase>[0] = 'Approach';
    const chain = [
      'SecurityCheckpoint',
      'CompoundEntered',
      'ControlBuildingReached',
      'GeneratorAccessed',
      'TunnelAccessed',
      'StaffQuartersReached',
      'SupervisorOfficeReached',
      'RooftopAccessed',
      'GreyboxComplete',
    ] as const;
    for (const next of chain) {
      const result = tryAdvancePhase(phase, next);
      expect(result).toBe(next);
      phase = next;
    }
    expect(phase).toBe('GreyboxComplete');
  });
});

describe('FacilityRuntimeState — power progression via tryAdvancePhase', () => {
  it('isComplete (M0.5 flag) latches true at GreyboxComplete and stays true through the power chain', () => {
    const state = new FacilityRuntimeState();
    for (const next of [
      'SecurityCheckpoint',
      'CompoundEntered',
      'ControlBuildingReached',
      'GeneratorAccessed',
      'TunnelAccessed',
      'StaffQuartersReached',
      'SupervisorOfficeReached',
      'RooftopAccessed',
      'GreyboxComplete',
    ] as const) {
      state.tryAdvancePhase(next);
    }
    expect(state.isComplete).toBe(true);

    state.tryAdvancePhase('GeneratorStarted');
    state.tryAdvancePhase('MainPowerAvailable');
    expect(state.progressionPhase).toBe('MainPowerAvailable');
    expect(state.isComplete).toBe(true); // still true — latched at GreyboxComplete
  });

  it('rejects advancing into the power chain before GreyboxComplete is reached', () => {
    const state = new FacilityRuntimeState();
    expect(state.tryAdvancePhase('GeneratorStarted')).toBe(false);
    expect(state.progressionPhase).toBe('Approach');
  });
});
