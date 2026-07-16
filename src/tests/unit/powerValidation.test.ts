import { describe, expect, it } from 'vitest';
import {
  validatePowerNetworkData,
  type PowerValidationInput,
} from '../../game/power/PowerValidation';
import { asPowerSourceId } from '../../game/power/PowerSourceId';
import { asPowerCircuitId } from '../../game/power/PowerCircuitId';
import { asPowerLoadId } from '../../game/power/PowerLoadId';
import type { PowerCircuitDefinition } from '../../game/power/PowerCircuit';
import type { PowerLoadDefinition } from '../../game/power/PowerLoad';

const GEN = asPowerSourceId('gen');
const BATT = asPowerSourceId('batt');
const C1 = asPowerCircuitId('c1');

function buildData(
  circuitOverrides: Partial<PowerCircuitDefinition> = {},
  loadOverrides: Partial<PowerLoadDefinition> = {},
): PowerValidationInput {
  const circuit: PowerCircuitDefinition = {
    id: C1,
    displayName: 'C1',
    capacityCost: 4,
    priority: 5,
    description: 'd',
    eligibleSourceIds: [GEN],
    emergencyEligible: false,
    ...circuitOverrides,
  };
  const load: PowerLoadDefinition = {
    id: asPowerLoadId('l1'),
    circuitId: C1,
    displayName: 'L1',
    ...loadOverrides,
  };
  return {
    sources: [
      { id: GEN, kind: 'generator', displayName: 'Generator', maxCapacity: 10, priority: 10 },
      { id: BATT, kind: 'emergency-battery', displayName: 'Battery', maxCapacity: 2, priority: 1 },
    ],
    circuits: [circuit],
    loads: [load],
  };
}

describe('validatePowerNetworkData', () => {
  it('returns no problems for valid data', () => {
    expect(validatePowerNetworkData(buildData())).toEqual([]);
  });

  it('flags a circuit with no eligible sources', () => {
    const problems = validatePowerNetworkData(buildData({ eligibleSourceIds: [] }));
    expect(problems.some((p) => p.includes('no eligible sources'))).toBe(true);
  });

  it('flags a circuit referencing an unknown source', () => {
    const problems = validatePowerNetworkData(
      buildData({ eligibleSourceIds: [asPowerSourceId('ghost')] }),
    );
    expect(problems.some((p) => p.includes('unknown source'))).toBe(true);
  });

  it('flags a load referencing an unknown circuit', () => {
    const problems = validatePowerNetworkData(
      buildData({}, { circuitId: asPowerCircuitId('ghost-circuit') }),
    );
    expect(problems.some((p) => p.includes('unknown circuit'))).toBe(true);
  });

  it('flags an emergencyEligible circuit costing more than the battery capacity', () => {
    const problems = validatePowerNetworkData(
      buildData({ emergencyEligible: true, eligibleSourceIds: [GEN, BATT], capacityCost: 5 }),
    );
    expect(problems.some((p) => p.includes('emergencyEligible'))).toBe(true);
  });

  it('flags a circuit costing more than any eligible source could ever supply', () => {
    const problems = validatePowerNetworkData(buildData({ capacityCost: 999 }));
    expect(problems.some((p) => p.includes('unwinnable'))).toBe(true);
  });

  it('flags duplicate ids', () => {
    const data = buildData();
    const duplicateGenerator = {
      id: GEN,
      kind: 'generator' as const,
      displayName: 'Generator',
      maxCapacity: 10,
      priority: 10,
    };
    const duplicated: PowerValidationInput = {
      ...data,
      sources: [...data.sources, duplicateGenerator],
    };
    const problems = validatePowerNetworkData(duplicated);
    expect(problems.some((p) => p.includes('Duplicate power source id'))).toBe(true);
  });
});
