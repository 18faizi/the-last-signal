import { describe, expect, it } from 'vitest';
import { validateFacilityData } from '../../game/facility/FacilityValidator';
import type { FacilityValidationInput } from '../../game/facility/FacilityValidator';

const BASE_INPUT: FacilityValidationInput = {
  zones: [
    {
      id: 'zone-a',
      label: 'Zone A',
      isKeyZone: true,
      aabb: { minX: 0, minY: 0, minZ: 0, maxX: 10, maxY: 5, maxZ: 10 },
    },
  ],
  checkpoints: [
    {
      id: 'cp-spawn',
      label: 'Spawn',
      spawnPosition: { x: 0, y: 0, z: 0 },
      spawnYaw: 0,
    },
  ],
  teleports: [
    {
      id: 'tp-start',
      label: 'Start',
      position: { x: 0, y: 0, z: 0 },
      yaw: 0,
    },
  ],
  registeredItemIds: ['item-key', 'item-card'],
  doorRequiredItemIds: ['item-key'],
  pickupPlacements: [],
  doorGrants: [],
};

describe('validateFacilityData', () => {
  it('returns empty array for valid input', () => {
    expect(validateFacilityData(BASE_INPUT)).toEqual([]);
  });

  it('reports duplicate zone id', () => {
    const input: FacilityValidationInput = {
      ...BASE_INPUT,
      zones: [
        ...BASE_INPUT.zones,
        {
          id: 'zone-a', // duplicate
          label: 'Zone A Duplicate',
          isKeyZone: false,
          aabb: { minX: 0, minY: 0, minZ: 0, maxX: 5, maxY: 5, maxZ: 5 },
        },
      ],
    };
    const problems = validateFacilityData(input);
    expect(problems.some((p) => p.includes('Duplicate') && p.includes('zone:zone-a'))).toBe(true);
  });

  it('reports duplicate checkpoint id', () => {
    const input: FacilityValidationInput = {
      ...BASE_INPUT,
      checkpoints: [
        ...BASE_INPUT.checkpoints,
        { id: 'cp-spawn', label: 'Dupe CP', spawnPosition: { x: 1, y: 0, z: 0 }, spawnYaw: 0 },
      ],
    };
    const problems = validateFacilityData(input);
    expect(problems.some((p) => p.includes('Duplicate') && p.includes('checkpoint:cp-spawn'))).toBe(
      true,
    );
  });

  it('reports duplicate teleport id', () => {
    const input: FacilityValidationInput = {
      ...BASE_INPUT,
      teleports: [
        ...BASE_INPUT.teleports,
        { id: 'tp-start', label: 'Dupe TP', position: { x: 0, y: 0, z: 0 }, yaw: 0 },
      ],
    };
    const problems = validateFacilityData(input);
    expect(problems.some((p) => p.includes('Duplicate') && p.includes('teleport:tp-start'))).toBe(
      true,
    );
  });

  it('reports unknown item id in door lock requirement', () => {
    const input: FacilityValidationInput = {
      ...BASE_INPUT,
      doorRequiredItemIds: ['item-key', 'item-unknown'],
    };
    const problems = validateFacilityData(input);
    expect(problems.some((p) => p.includes('unknown item id') && p.includes('item-unknown'))).toBe(
      true,
    );
  });

  it('does not report known item ids as unknown', () => {
    const problems = validateFacilityData(BASE_INPUT);
    expect(problems.some((p) => p.includes('item-key'))).toBe(false);
  });

  it('detects softlock when item is behind its own door', () => {
    const input: FacilityValidationInput = {
      ...BASE_INPUT,
      pickupPlacements: [{ pickupId: 'pickup-key', itemId: 'item-key', zoneId: 'zone-a' }],
      doorGrants: [
        { doorId: 'door-to-zone-a', requiredItemId: 'item-key', grantsZoneId: 'zone-a' },
      ],
    };
    const problems = validateFacilityData(input);
    expect(problems.some((p) => p.toLowerCase().includes('softlock'))).toBe(true);
  });

  it('does not flag softlock when item is in a different zone', () => {
    const input: FacilityValidationInput = {
      ...BASE_INPUT,
      zones: [
        ...BASE_INPUT.zones,
        {
          id: 'zone-b',
          label: 'Zone B',
          isKeyZone: false,
          aabb: { minX: 10, minY: 0, minZ: 0, maxX: 20, maxY: 5, maxZ: 10 },
        },
      ],
      pickupPlacements: [{ pickupId: 'pickup-key', itemId: 'item-key', zoneId: 'zone-b' }],
      doorGrants: [
        { doorId: 'door-to-zone-a', requiredItemId: 'item-key', grantsZoneId: 'zone-a' },
      ],
    };
    const problems = validateFacilityData(input);
    expect(problems.some((p) => p.toLowerCase().includes('softlock'))).toBe(false);
  });

  it('reports unknown zone reference in pickup placements', () => {
    const input: FacilityValidationInput = {
      ...BASE_INPUT,
      pickupPlacements: [
        { pickupId: 'pickup-a', itemId: 'item-key', zoneId: 'zone-does-not-exist' },
      ],
    };
    const problems = validateFacilityData(input);
    expect(problems.some((p) => p.includes('zone-does-not-exist'))).toBe(true);
  });

  it('allows empty zoneId in pickup placement (no zone membership tracked)', () => {
    const input: FacilityValidationInput = {
      ...BASE_INPUT,
      pickupPlacements: [{ pickupId: 'pickup-a', itemId: 'item-key', zoneId: '' }],
    };
    const problems = validateFacilityData(input);
    // Empty zoneId is explicitly skipped in the validator.
    expect(problems.filter((p) => p.includes('pickup-a'))).toHaveLength(0);
  });

  it('returns multiple problems for multiple issues', () => {
    const input: FacilityValidationInput = {
      zones: [],
      checkpoints: [],
      teleports: [],
      registeredItemIds: [],
      doorRequiredItemIds: ['unknown-1', 'unknown-2'],
      pickupPlacements: [],
      doorGrants: [],
    };
    const problems = validateFacilityData(input);
    expect(problems.length).toBeGreaterThanOrEqual(2);
  });
});
