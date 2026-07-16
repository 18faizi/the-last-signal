import { describe, expect, it } from 'vitest';
import { validateAllocation, type AllocationContext } from '../../game/power/PowerAllocation';
import { asPowerSourceId } from '../../game/power/PowerSourceId';
import { asPowerCircuitId } from '../../game/power/PowerCircuitId';
import { createPowerSourceState } from '../../game/power/PowerSourceState';

const SRC = asPowerSourceId('s');
const CIRCUIT = asPowerCircuitId('c');

function ctx(
  overrides: {
    allocated?: number;
    availability?: 'offline' | 'available';
    eligible?: boolean;
  } = {},
): AllocationContext {
  const sourceState = createPowerSourceState(SRC);
  sourceState.availability = overrides.availability ?? 'available';
  sourceState.allocatedCapacity = overrides.allocated ?? 0;
  return {
    source: {
      id: SRC,
      kind: 'generator' as const,
      displayName: 'Src',
      maxCapacity: 10,
      priority: 1,
    },
    sourceState,
    circuit: {
      id: CIRCUIT,
      displayName: 'C',
      capacityCost: 4,
      priority: 1,
      description: 'd',
      eligibleSourceIds: overrides.eligible === false ? [] : [SRC],
      emergencyEligible: false,
    },
    currentEffective: 'de-energized' as const,
    currentSourceId: null,
  };
}

describe('validateAllocation', () => {
  it('allows turning off unconditionally', () => {
    const result = validateAllocation(ctx(), 'off');
    expect(result.ok).toBe(true);
  });

  it('rejects turning on when the source is offline', () => {
    const result = validateAllocation(ctx({ availability: 'offline' }), 'on');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('source-unavailable');
  });

  it('rejects turning on when the circuit is not eligible for the source', () => {
    const result = validateAllocation(ctx({ eligible: false }), 'on');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('source-ineligible');
  });

  it('rejects turning on when capacity is insufficient', () => {
    const result = validateAllocation(ctx({ allocated: 8 }), 'on'); // 2 free, needs 4
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('insufficient-capacity');
  });

  it('produces a plan with the correct capacityDelta when it fits', () => {
    const result = validateAllocation(ctx({ allocated: 3 }), 'on');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.capacityDelta).toBe(4);
      expect(result.plan.sourceId).toBe(SRC);
      expect(result.plan.newEffective).toBe('energized');
    }
  });

  it('is a no-op plan (zero delta) when already energized from the same source', () => {
    const already: AllocationContext = {
      ...ctx(),
      currentEffective: 'energized',
      currentSourceId: SRC,
    };
    const result = validateAllocation(already, 'on');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.capacityDelta).toBe(0);
    }
  });

  it('never mutates its inputs', () => {
    const input = ctx({ allocated: 3 });
    const snapshotBefore = JSON.stringify(input.sourceState);
    validateAllocation(input, 'on');
    expect(JSON.stringify(input.sourceState)).toBe(snapshotBefore);
  });
});
