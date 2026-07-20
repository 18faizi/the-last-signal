import { describe, expect, it } from 'vitest';
import { validateThreatDefinition } from '../../game/threat/ThreatValidation';
import type { ThreatDefinition } from '../../game/threat/ThreatDefinition';
import {
  FACILITY_THREAT_DEFINITION,
  FACILITY_THREAT_GRAPH,
  FACILITY_SAFE_ZONES,
  FACILITY_HIDING_SPOTS,
} from '../../scenes/facility-greybox/threat/facilityThreatDefinitions';
import { FACILITY_ZONES } from '../../scenes/facility-greybox/facilityZoneDefinitions';
import { FACILITY_CHECKPOINTS } from '../../scenes/facility-greybox/facilityCheckpointDefinitions';
import { ALL_DOOR_DEFS } from '../../scenes/facility-greybox/facilityDoorDefinitions';

const CTX = {
  graph: FACILITY_THREAT_GRAPH,
  zoneIds: FACILITY_ZONES.map((z) => z.id),
  safeZoneIds: FACILITY_SAFE_ZONES.map((z) => z.id),
  hidingSpotIds: FACILITY_HIDING_SPOTS.map((h) => h.id),
  checkpointIds: FACILITY_CHECKPOINTS.map((c) => c.id),
  doorIds: ALL_DOOR_DEFS.map((d) => d.id),
};

describe('ThreatValidation — authored facility data', () => {
  it('the shipped facility threat definition validates cleanly', () => {
    expect(validateThreatDefinition(FACILITY_THREAT_DEFINITION, CTX)).toEqual([]);
  });

  it('the encounter checkpoint exists', () => {
    expect(CTX.checkpointIds).toContain('fg-cp-encounter-start');
  });

  it('pursuit speed never outruns the player sprint (5.4 m/s)', () => {
    expect(FACILITY_THREAT_DEFINITION.movement.pursuitSpeed).toBeLessThan(5.4);
    expect(FACILITY_THREAT_DEFINITION.movement.pursuitSpeed).toBeGreaterThan(3.2);
  });

  it('safe zones never overlap the threat nav graph nodes', () => {
    for (const node of FACILITY_THREAT_GRAPH.nodes) {
      for (const zone of FACILITY_SAFE_ZONES) {
        const a = zone.aabb;
        const inside =
          node.position.x >= a.minX &&
          node.position.x <= a.maxX &&
          node.position.y >= a.minY &&
          node.position.y <= a.maxY &&
          node.position.z >= a.minZ &&
          node.position.z <= a.maxZ;
        expect(inside).toBe(false);
      }
    }
  });
});

describe('ThreatValidation — problem detection', () => {
  function mutate(overrides: (def: ThreatDefinition) => ThreatDefinition): string[] {
    return validateThreatDefinition(overrides(FACILITY_THREAT_DEFINITION), CTX);
  }

  it('flags an unknown home node', () => {
    const problems = mutate((d) => ({ ...d, homeNodeId: 'ghost-node' }));
    expect(problems.some((p) => p.includes('homeNodeId'))).toBe(true);
  });

  it('flags unknown allowed zones and safe zones', () => {
    expect(
      mutate((d) => ({ ...d, allowedZoneIds: [...d.allowedZoneIds, 'ghost-zone'] })).some((p) =>
        p.includes('ghost-zone'),
      ),
    ).toBe(true);
    expect(
      mutate((d) => ({ ...d, safeZoneIds: ['ghost-safe'] })).some((p) => p.includes('ghost-safe')),
    ).toBe(true);
  });

  it('flags nav nodes outside the allowed zone set', () => {
    const problems = mutate((d) => ({ ...d, allowedZoneIds: ['fg-zone-control-room'] }));
    expect(problems.some((p) => p.includes('outside the allowed set'))).toBe(true);
  });

  it('flags disordered movement multipliers', () => {
    const problems = mutate((d) => ({
      ...d,
      vision: { ...d.vision, crouchMultiplier: 2 },
    }));
    expect(problems.some((p) => p.includes('sprint >= walk >= crouch'))).toBe(true);
  });

  it('flags disordered suspicion thresholds and decay rates', () => {
    expect(
      mutate((d) => ({
        ...d,
        suspicion: { ...d.suspicion, suspiciousThreshold: 0.9 },
      })).some((p) => p.includes('suspicious < investigate')),
    ).toBe(true);
    expect(
      mutate((d) => ({
        ...d,
        suspicion: { ...d.suspicion, detectionDecayAfterLosBreakPerSecond: 5 },
      })).some((p) => p.includes('slower')),
    ).toBe(true);
  });

  it('flags non-positive movement values', () => {
    const problems = mutate((d) => ({
      ...d,
      movement: { ...d.movement, captureRadius: 0 },
    }));
    expect(problems.some((p) => p.includes('captureRadius'))).toBe(true);
  });
});
