import { describe, expect, it } from 'vitest';
import {
  ALL_THREAT_STATES,
  canTransitionThreatState,
  isThreatActive,
  isThreatPerceiving,
  tryTransitionThreatState,
  type ThreatState,
} from '../../game/threat/ThreatState';

describe('ThreatState — valid transitions', () => {
  it('activation always passes through Manifesting or Unaware', () => {
    expect(canTransitionThreatState('Dormant', 'Manifesting')).toBe(true);
    expect(canTransitionThreatState('Dormant', 'Unaware')).toBe(true);
  });

  it('Manifesting resolves only to Observing or Inactive (plus Fault)', () => {
    expect(canTransitionThreatState('Manifesting', 'Observing')).toBe(true);
    expect(canTransitionThreatState('Manifesting', 'Inactive')).toBe(true);
    for (const to of ALL_THREAT_STATES) {
      if (to === 'Observing' || to === 'Inactive' || to === 'Fault' || to === 'Manifesting')
        continue;
      expect(canTransitionThreatState('Manifesting', to)).toBe(false);
    }
  });

  it('supports the full escalation chain Unaware -> Suspicious -> Investigating -> Searching -> Pursuing', () => {
    expect(canTransitionThreatState('Unaware', 'Suspicious')).toBe(true);
    expect(canTransitionThreatState('Suspicious', 'Investigating')).toBe(true);
    expect(canTransitionThreatState('Investigating', 'Searching')).toBe(true);
    expect(canTransitionThreatState('Searching', 'Pursuing')).toBe(true);
  });

  it('Pursuing is reachable only from perceiving/escalated states', () => {
    const legalSources = ALL_THREAT_STATES.filter((from) =>
      canTransitionThreatState(from, 'Pursuing'),
    );
    expect(legalSources.sort()).toEqual(['Investigating', 'Searching', 'Suspicious'].sort());
  });

  it('de-escalation returns Suspicious -> Unaware', () => {
    expect(canTransitionThreatState('Suspicious', 'Unaware')).toBe(true);
  });

  it('Withdrawing ends only at Dormant or Inactive (plus Fault)', () => {
    expect(canTransitionThreatState('Withdrawing', 'Dormant')).toBe(true);
    expect(canTransitionThreatState('Withdrawing', 'Inactive')).toBe(true);
    for (const to of ALL_THREAT_STATES) {
      if (to === 'Dormant' || to === 'Inactive' || to === 'Fault' || to === 'Withdrawing') continue;
      expect(canTransitionThreatState('Withdrawing', to)).toBe(false);
    }
  });

  it('every active state can reach Fault', () => {
    for (const from of ALL_THREAT_STATES) {
      if (from === 'Inactive' || from === 'Fault') continue;
      expect(canTransitionThreatState(from, 'Fault')).toBe(true);
    }
  });
});

describe('ThreatState — invalid transitions', () => {
  it('Dormant can never jump straight to Pursuing', () => {
    expect(canTransitionThreatState('Dormant', 'Pursuing')).toBe(false);
    expect(tryTransitionThreatState('Dormant', 'Pursuing')).toBeNull();
  });

  it('Dormant cannot jump to Investigating/Searching/LostTarget', () => {
    expect(canTransitionThreatState('Dormant', 'Investigating')).toBe(false);
    expect(canTransitionThreatState('Dormant', 'Searching')).toBe(false);
    expect(canTransitionThreatState('Dormant', 'LostTarget')).toBe(false);
  });

  it('LostTarget is reachable only from Pursuing or Searching', () => {
    const sources = ALL_THREAT_STATES.filter((from) =>
      canTransitionThreatState(from, 'LostTarget'),
    );
    expect(sources.sort()).toEqual(['Pursuing', 'Searching'].sort());
  });

  it('Fault never silently resumes — it has zero successors', () => {
    for (const to of ALL_THREAT_STATES) {
      expect(canTransitionThreatState('Fault', to)).toBe(false);
    }
  });

  it('Inactive is terminal until a full reset', () => {
    for (const to of ALL_THREAT_STATES) {
      expect(canTransitionThreatState('Inactive', to)).toBe(false);
    }
  });

  it('self-transitions are rejected by tryTransitionThreatState', () => {
    for (const state of ALL_THREAT_STATES) {
      expect(tryTransitionThreatState(state, state)).toBeNull();
    }
  });
});

describe('ThreatState — activity/perception classification', () => {
  it('Dormant/Inactive/Fault are inactive (zero per-frame work)', () => {
    const inactive: ThreatState[] = ['Dormant', 'Inactive', 'Fault'];
    for (const state of inactive) {
      expect(isThreatActive(state)).toBe(false);
    }
    for (const state of ALL_THREAT_STATES) {
      if (!inactive.includes(state)) expect(isThreatActive(state)).toBe(true);
    }
  });

  it('Manifesting and Withdrawing never perceive', () => {
    expect(isThreatPerceiving('Manifesting')).toBe(false);
    expect(isThreatPerceiving('Withdrawing')).toBe(false);
    expect(isThreatPerceiving('Unaware')).toBe(true);
    expect(isThreatPerceiving('Pursuing')).toBe(true);
  });
});
