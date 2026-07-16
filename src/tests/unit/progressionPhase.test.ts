import { describe, expect, it } from 'vitest';
import {
  canAdvancePhase,
  tryAdvancePhase,
  comparePhase,
  isPhaseComplete,
  type ProgressionPhase,
} from '../../game/facility/ProgressionPhase';

describe('ProgressionPhase', () => {
  // ----- canAdvancePhase ---------------------------------------------------

  it('allows Approach → SecurityCheckpoint', () => {
    expect(canAdvancePhase('Approach', 'SecurityCheckpoint')).toBe(true);
  });

  it('does not allow Approach → ControlBuildingReached (skip)', () => {
    expect(canAdvancePhase('Approach', 'ControlBuildingReached')).toBe(false);
  });

  it('allows CompoundEntered → ControlBuildingReached or GeneratorAccessed (branch)', () => {
    expect(canAdvancePhase('CompoundEntered', 'ControlBuildingReached')).toBe(true);
    expect(canAdvancePhase('CompoundEntered', 'GeneratorAccessed')).toBe(true);
  });

  it('allows bidirectional between ControlBuildingReached and GeneratorAccessed', () => {
    expect(canAdvancePhase('ControlBuildingReached', 'GeneratorAccessed')).toBe(true);
    expect(canAdvancePhase('GeneratorAccessed', 'ControlBuildingReached')).toBe(true);
  });

  it('does not allow GreyboxComplete → any other phase', () => {
    const phases: ProgressionPhase[] = [
      'Approach',
      'SecurityCheckpoint',
      'CompoundEntered',
      'ControlBuildingReached',
      'GeneratorAccessed',
      'TunnelAccessed',
    ];
    for (const p of phases) {
      expect(canAdvancePhase('GreyboxComplete', p)).toBe(false);
    }
  });

  it('does not allow same-phase transition', () => {
    expect(canAdvancePhase('Approach', 'Approach')).toBe(false);
  });

  // ----- tryAdvancePhase ---------------------------------------------------

  it('returns the new phase on valid transition', () => {
    expect(tryAdvancePhase('Approach', 'SecurityCheckpoint')).toBe('SecurityCheckpoint');
  });

  it('returns null for no-op (current === target)', () => {
    expect(tryAdvancePhase('Approach', 'Approach')).toBeNull();
  });

  it('returns null for invalid transition', () => {
    expect(tryAdvancePhase('Approach', 'GreyboxComplete')).toBeNull();
  });

  it('returns null for backward transition', () => {
    expect(tryAdvancePhase('CompoundEntered', 'Approach')).toBeNull();
  });

  it('processes full linear path from Approach to GreyboxComplete', () => {
    const path: ProgressionPhase[] = [
      'Approach',
      'SecurityCheckpoint',
      'CompoundEntered',
      'ControlBuildingReached',
      'GeneratorAccessed',
      'TunnelAccessed',
      'StaffQuartersReached',
      'SupervisorOfficeReached',
      'RooftopAccessed',
      'GreyboxComplete',
    ];
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i] as ProgressionPhase;
      const to = path[i + 1] as ProgressionPhase;
      expect(tryAdvancePhase(from, to)).toBe(to);
    }
  });

  // ----- comparePhase ------------------------------------------------------

  it('comparePhase returns positive when a is later', () => {
    expect(comparePhase('CompoundEntered', 'Approach')).toBeGreaterThan(0);
  });

  it('comparePhase returns negative when a is earlier', () => {
    expect(comparePhase('Approach', 'GreyboxComplete')).toBeLessThan(0);
  });

  it('comparePhase returns 0 for equal phases', () => {
    expect(comparePhase('TunnelAccessed', 'TunnelAccessed')).toBe(0);
  });

  // ----- isPhaseComplete ---------------------------------------------------

  it('isPhaseComplete returns true only for GreyboxComplete', () => {
    expect(isPhaseComplete('GreyboxComplete')).toBe(true);
    expect(isPhaseComplete('RooftopAccessed')).toBe(false);
    expect(isPhaseComplete('Approach')).toBe(false);
  });
});
