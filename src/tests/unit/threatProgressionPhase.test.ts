import { describe, expect, it } from 'vitest';
import {
  canAdvanceThreatPhase,
  compareThreatPhase,
  isThreatFoundationComplete,
  tryAdvanceThreatPhase,
  type ThreatProgressionPhase,
} from '../../game/threat/ThreatProgressionPhase';
import { ThreatRuntimeState } from '../../game/threat/ThreatRuntimeState';

const FULL_CHAIN: readonly ThreatProgressionPhase[] = [
  'Inactive',
  'AntennaAftermathPending',
  'FirstManifestation',
  'DisturbanceSequence',
  'InvestigationActive',
  'StealthRequired',
  'PlayerDetected',
  'PursuitActive',
  'SafeZoneReached',
  'EncounterResolved',
  'ThreatFoundationComplete',
];

describe('ThreatProgressionPhase — the fifth separate chain', () => {
  it('advances strictly linearly through the whole chain', () => {
    FULL_CHAIN.slice(0, -1).forEach((phase, i) => {
      expect(canAdvanceThreatPhase(phase, FULL_CHAIN[i + 1] as ThreatProgressionPhase)).toBe(true);
    });
  });

  it('rejects skipping phases (Inactive can never jump to PursuitActive)', () => {
    expect(canAdvanceThreatPhase('Inactive', 'PursuitActive')).toBe(false);
    expect(canAdvanceThreatPhase('Inactive', 'ThreatFoundationComplete')).toBe(false);
    expect(canAdvanceThreatPhase('FirstManifestation', 'StealthRequired')).toBe(false);
  });

  it('rejects moving backwards', () => {
    expect(canAdvanceThreatPhase('StealthRequired', 'InvestigationActive')).toBe(false);
    expect(canAdvanceThreatPhase('ThreatFoundationComplete', 'Inactive')).toBe(false);
  });

  it('is monotonic: tryAdvance returns null for no-ops and illegal targets', () => {
    expect(tryAdvanceThreatPhase('Inactive', 'Inactive')).toBeNull();
    expect(tryAdvanceThreatPhase('Inactive', 'SafeZoneReached')).toBeNull();
    expect(tryAdvanceThreatPhase('Inactive', 'AntennaAftermathPending')).toBe(
      'AntennaAftermathPending',
    );
  });

  it('compareThreatPhase orders the chain', () => {
    expect(compareThreatPhase('Inactive', 'PlayerDetected')).toBeLessThan(0);
    expect(compareThreatPhase('PursuitActive', 'FirstManifestation')).toBeGreaterThan(0);
    expect(compareThreatPhase('StealthRequired', 'StealthRequired')).toBe(0);
  });

  it('ThreatFoundationComplete is terminal', () => {
    expect(isThreatFoundationComplete('ThreatFoundationComplete')).toBe(true);
    expect(isThreatFoundationComplete('EncounterResolved')).toBe(false);
    for (const to of FULL_CHAIN) {
      expect(canAdvanceThreatPhase('ThreatFoundationComplete', to)).toBe(false);
    }
  });
});

describe('ThreatRuntimeState — coarse event bookkeeping', () => {
  it('tracks phase advances and rejects skips', () => {
    const s = new ThreatRuntimeState();
    expect(s.threatPhase).toBe('Inactive');
    expect(s.tryAdvancePhase('FirstManifestation')).toBe(false);
    expect(s.tryAdvancePhase('AntennaAftermathPending')).toBe(true);
    expect(s.tryAdvancePhase('FirstManifestation')).toBe(true);
    expect(s.threatPhase).toBe('FirstManifestation');
  });

  it('records director events idempotently', () => {
    const s = new ThreatRuntimeState();
    const events: string[] = [];
    s.subscribe((e) => events.push(e.kind));
    s.recordEventCompleted('ev-a');
    s.recordEventCompleted('ev-a');
    expect(s.hasCompletedEvent('ev-a')).toBe(true);
    expect(events.filter((k) => k === 'director-event-completed')).toHaveLength(1);
  });

  it('encounter completion is one-shot per encounter id', () => {
    const s = new ThreatRuntimeState();
    const events: string[] = [];
    s.subscribe((e) => events.push(e.kind));
    s.recordEncounterStarted('enc-1');
    expect(s.activeEncounterId).toBe('enc-1');
    s.recordEncounterCompleted('enc-1');
    s.recordEncounterCompleted('enc-1');
    expect(s.hasCompletedEncounter('enc-1')).toBe(true);
    expect(s.activeEncounterId).toBeNull();
    expect(events.filter((k) => k === 'encounter-completed')).toHaveLength(1);
  });

  it('counts encounter resets and withdrawals', () => {
    const s = new ThreatRuntimeState();
    s.recordEncounterStarted('enc-1');
    s.recordEncounterReset('enc-1');
    s.recordEncounterReset('enc-1');
    s.recordThreatWithdrawn();
    expect(s.encounterResetCount).toBe(2);
    expect(s.getSnapshot().threatWithdrawnCount).toBe(1);
    // A reset does NOT clear the active encounter (the player retries it).
    expect(s.activeEncounterId).toBe('enc-1');
  });

  it('records manifestations, hiding spots and safe zone once each', () => {
    const s = new ThreatRuntimeState();
    s.recordManifestationSeen('m-1');
    s.recordManifestationSeen('m-1');
    s.recordHidingSpotDiscovered('h-1');
    s.recordSafeZoneReached();
    s.recordSafeZoneReached();
    const snap = s.getSnapshot();
    expect(snap.manifestationsSeen).toEqual(['m-1']);
    expect(snap.hidingSpotsDiscovered).toEqual(['h-1']);
    expect(snap.safeZoneReached).toBe(true);
  });

  it('reset() restores everything and preserves listeners', () => {
    const s = new ThreatRuntimeState();
    let resets = 0;
    s.subscribe((e) => {
      if (e.kind === 'reset') resets++;
    });
    s.tryAdvancePhase('AntennaAftermathPending');
    s.recordEncounterStarted('enc-1');
    s.recordEventCompleted('ev-a');
    s.reset();
    expect(s.threatPhase).toBe('Inactive');
    expect(s.activeEncounterId).toBeNull();
    expect(s.hasCompletedEvent('ev-a')).toBe(false);
    expect(s.encounterResetCount).toBe(0);
    expect(resets).toBe(1);
  });
});
