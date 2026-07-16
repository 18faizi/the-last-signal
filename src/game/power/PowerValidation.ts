/**
 * Development-time validator for power network data integrity.
 *
 * Mirrors FacilityValidator.ts's contract: pure function taking plain
 * definition arrays, returning human-readable problem strings. Designed to
 * run once at scene-creation time; an empty array means the data is valid.
 */
import type { PowerSourceDefinition } from './PowerSource';
import type { PowerCircuitDefinition } from './PowerCircuit';
import type { PowerLoadDefinition } from './PowerLoad';

export interface PowerValidationInput {
  readonly sources: readonly PowerSourceDefinition[];
  readonly circuits: readonly PowerCircuitDefinition[];
  readonly loads: readonly PowerLoadDefinition[];
}

export function validatePowerNetworkData(input: PowerValidationInput): string[] {
  const problems: string[] = [];

  // 1. Duplicate ids within each namespace.
  const sourceIds = new Set<string>();
  for (const s of input.sources) {
    if (sourceIds.has(s.id)) problems.push(`Duplicate power source id "${s.id}"`);
    sourceIds.add(s.id);
    if (s.maxCapacity <= 0) problems.push(`Power source "${s.id}" has non-positive maxCapacity`);
  }

  const circuitIds = new Set<string>();
  for (const c of input.circuits) {
    if (circuitIds.has(c.id)) problems.push(`Duplicate power circuit id "${c.id}"`);
    circuitIds.add(c.id);
    if (c.capacityCost <= 0) {
      problems.push(`Power circuit "${c.id}" has non-positive capacityCost`);
    }
    if (c.eligibleSourceIds.length === 0) {
      problems.push(`Power circuit "${c.id}" has no eligible sources — can never be energized`);
    }
    for (const sourceId of c.eligibleSourceIds) {
      if (!sourceIds.has(sourceId)) {
        problems.push(`Power circuit "${c.id}" references unknown source "${sourceId}"`);
      }
    }
    if (c.emergencyEligible) {
      const battery = input.sources.find((s) => s.kind === 'emergency-battery');
      if (battery !== undefined && c.capacityCost > battery.maxCapacity) {
        problems.push(
          `Power circuit "${c.id}" is marked emergencyEligible but its cost (${c.capacityCost}) ` +
            `exceeds the emergency battery's capacity (${battery.maxCapacity})`,
        );
      }
    }
  }

  const loadIds = new Set<string>();
  for (const l of input.loads) {
    if (loadIds.has(l.id)) problems.push(`Duplicate power load id "${l.id}"`);
    loadIds.add(l.id);
    if (!circuitIds.has(l.circuitId)) {
      problems.push(`Power load "${l.id}" references unknown circuit "${l.circuitId}"`);
    }
  }

  // 2. Capacity sanity: total possible simultaneous cost vs generator capacity.
  //    Not an error — the milestone intentionally makes the sum exceed capacity
  //    to force trade-offs — but flag a circuit costing more than any single
  //    source can ever supply, which would be unwinnable.
  for (const c of input.circuits) {
    const maxEligibleCapacity = Math.max(
      0,
      ...c.eligibleSourceIds
        .map((id) => input.sources.find((s) => s.id === id)?.maxCapacity ?? 0)
        .filter((v) => v > 0),
    );
    if (maxEligibleCapacity > 0 && c.capacityCost > maxEligibleCapacity) {
      problems.push(
        `Power circuit "${c.id}" costs ${c.capacityCost}, more than any eligible source can ever supply (${maxEligibleCapacity}) — unwinnable`,
      );
    }
  }

  return problems;
}
