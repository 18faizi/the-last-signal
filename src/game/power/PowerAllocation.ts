/**
 * Pure allocation planning: validate a requested circuit state change fully
 * before PowerNetwork mutates anything.
 *
 * validateAllocation() never mutates its inputs. PowerNetwork applies the
 * returned plan atomically — either the whole plan lands (state + capacity +
 * events) or nothing does. This guarantees no circuit is ever left
 * "partially energized".
 */
import type { PowerCircuitDefinition } from './PowerCircuit';
import type { CircuitEffectiveState, CircuitRequestedState } from './PowerCircuitState';
import type { PowerSourceDefinition } from './PowerSource';
import type { PowerSourceId } from './PowerSourceId';
import type { PowerSourceState } from './PowerSourceState';
import { canFitAdditionalCost, remainingCapacity } from './PowerCapacity';
import type { PowerErrorCode } from './PowerError';

export interface AllocationContext {
  readonly source: PowerSourceDefinition;
  readonly sourceState: PowerSourceState;
  readonly circuit: PowerCircuitDefinition;
  readonly currentEffective: CircuitEffectiveState;
  readonly currentSourceId: PowerSourceId | null;
}

export interface AllocationPlan {
  readonly circuitId: PowerCircuitDefinition['id'];
  readonly sourceId: PowerSourceId | null;
  readonly newRequested: CircuitRequestedState;
  readonly newEffective: CircuitEffectiveState;
  /** Signed change to the source's allocatedCapacity once applied. */
  readonly capacityDelta: number;
  /** Source whose capacity is freed, when switching sources or turning off. */
  readonly freedFromSourceId: PowerSourceId | null;
  readonly freedCapacity: number;
}

export type AllocationValidationResult =
  | { readonly ok: true; readonly plan: AllocationPlan }
  | { readonly ok: false; readonly code: PowerErrorCode; readonly reason: string };

export function validateAllocation(
  ctx: AllocationContext,
  desired: CircuitRequestedState,
): AllocationValidationResult {
  const alreadyOnThisSource =
    ctx.currentEffective === 'energized' && ctx.currentSourceId === ctx.source.id;

  if (desired === 'off') {
    return {
      ok: true,
      plan: {
        circuitId: ctx.circuit.id,
        sourceId: null,
        newRequested: 'off',
        newEffective: 'de-energized',
        capacityDelta: 0,
        freedFromSourceId: alreadyOnThisSource ? ctx.source.id : ctx.currentSourceId,
        freedCapacity: ctx.currentEffective === 'energized' ? ctx.circuit.capacityCost : 0,
      },
    };
  }

  // desired === 'on'
  if (ctx.sourceState.availability !== 'available') {
    return {
      ok: false,
      code: 'source-unavailable',
      reason: `${ctx.source.displayName.toUpperCase()} IS NOT AVAILABLE`,
    };
  }
  if (!ctx.circuit.eligibleSourceIds.includes(ctx.source.id)) {
    return {
      ok: false,
      code: 'source-ineligible',
      reason: `${ctx.circuit.displayName.toUpperCase()} CANNOT BE POWERED FROM ${ctx.source.displayName.toUpperCase()}`,
    };
  }

  if (alreadyOnThisSource) {
    // No-op: already on and sourced from the same source.
    return {
      ok: true,
      plan: {
        circuitId: ctx.circuit.id,
        sourceId: ctx.source.id,
        newRequested: 'on',
        newEffective: 'energized',
        capacityDelta: 0,
        freedFromSourceId: null,
        freedCapacity: 0,
      },
    };
  }

  const additionalCost = ctx.circuit.capacityCost;
  const remaining = remainingCapacity(ctx.source.maxCapacity, ctx.sourceState.allocatedCapacity);
  if (!canFitAdditionalCost(additionalCost, remaining)) {
    return {
      ok: false,
      code: 'insufficient-capacity',
      reason: `INSUFFICIENT CAPACITY: NEED ${additionalCost}, HAVE ${remaining}`,
    };
  }

  const wasEnergizedElsewhere = ctx.currentEffective === 'energized';
  return {
    ok: true,
    plan: {
      circuitId: ctx.circuit.id,
      sourceId: ctx.source.id,
      newRequested: 'on',
      newEffective: 'energized',
      capacityDelta: additionalCost,
      freedFromSourceId: wasEnergizedElsewhere ? ctx.currentSourceId : null,
      freedCapacity: wasEnergizedElsewhere ? ctx.circuit.capacityCost : 0,
    },
  };
}
