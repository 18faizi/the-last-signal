import { describe, expect, it } from 'vitest';
import { InventoryRegistry } from '../../game/inventory/InventoryRegistry';
import { InventoryService } from '../../game/inventory/InventoryService';
import { AccessEvaluator } from '../../game/access/AccessEvaluator';
import { allOf, anyOf, requireItem, requirePower } from '../../game/access/AccessRequirement';
import { createLock } from '../../game/access/LockState';
import { asPowerCircuitId } from '../../game/power/PowerCircuitId';
import type { PowerAccessQuery } from '../../game/access/PowerAccessQuery';

const TUNNEL_CIRCUIT = asPowerCircuitId('tunnel');

function setup(energizedCircuits: Set<string> = new Set()) {
  const reg = new InventoryRegistry();
  reg.register({
    id: 'card',
    displayName: 'Maintenance Card',
    category: 'card',
    consumptionPolicy: 'retain',
  });
  const inv = new InventoryService(reg);
  const powerQuery: PowerAccessQuery = {
    isCircuitEnergized: (circuitId) => energizedCircuits.has(circuitId),
  };
  const evaluator = new AccessEvaluator(inv, reg, powerQuery);
  return { reg, inv, evaluator };
}

describe('AccessEvaluator — power requirement', () => {
  it('denies when the circuit is not energized', () => {
    const { evaluator } = setup();
    const lock = { id: 'l', requirement: requirePower(TUNNEL_CIRCUIT) };
    const result = evaluator.evaluate(lock, createLock('l'));
    expect(result.status).toBe('denied');
  });

  it('allows once the circuit is energized, with an empty consumption plan', () => {
    const { evaluator } = setup(new Set([TUNNEL_CIRCUIT]));
    const lock = { id: 'l', requirement: requirePower(TUNNEL_CIRCUIT) };
    const result = evaluator.evaluate(lock, createLock('l'));
    expect(result.status).toBe('allowed');
    if (result.status === 'allowed') {
      expect(result.consumptionPlan).toEqual([]);
    }
  });

  it('fails safe (denies) when no PowerAccessQuery is configured at all', () => {
    const reg = new InventoryRegistry();
    const inv = new InventoryService(reg);
    const evaluator = new AccessEvaluator(inv, reg); // no power query
    const lock = { id: 'l', requirement: requirePower(TUNNEL_CIRCUIT) };
    const result = evaluator.evaluate(lock, createLock('l'));
    expect(result.status).toBe('denied');
  });

  it('AllOf: combined item + power requirement needs both — this is the tunnel maintenance door pattern', () => {
    const lock = {
      id: 'l',
      requirement: allOf(requireItem('card'), requirePower(TUNNEL_CIRCUIT)),
    };

    // Neither item nor power: denied.
    const { evaluator: neither } = setup();
    expect(neither.evaluate(lock, createLock('l')).status).toBe('denied');

    // Item only, power still missing: denied.
    const { evaluator: itemOnly, inv: itemOnlyInv } = setup();
    itemOnlyInv.add('card');
    expect(itemOnly.evaluate(lock, createLock('l')).status).toBe('denied');

    // Power only, item still missing: denied.
    const { evaluator: powerOnly } = setup(new Set([TUNNEL_CIRCUIT]));
    expect(powerOnly.evaluate(lock, createLock('l')).status).toBe('denied');

    // Both present: allowed.
    const { evaluator: both, inv: bothInv } = setup(new Set([TUNNEL_CIRCUIT]));
    bothInv.add('card');
    expect(both.evaluate(lock, createLock('l')).status).toBe('allowed');
  });

  it('AnyOf: item alone is sufficient even when power is unavailable', () => {
    const { reg, inv } = setup();
    const evaluator = new AccessEvaluator(inv, reg, { isCircuitEnergized: () => false });
    const lock = {
      id: 'l',
      requirement: anyOf(requireItem('card'), requirePower(TUNNEL_CIRCUIT)),
    };
    inv.add('card');
    const result = evaluator.evaluate(lock, createLock('l'));
    expect(result.status).toBe('allowed');
  });

  it('applyPlan for a power-only requirement does not touch inventory and unlocks the lock', () => {
    const { evaluator } = setup(new Set([TUNNEL_CIRCUIT]));
    const lock = { id: 'l', requirement: requirePower(TUNNEL_CIRCUIT) };
    const lockState = createLock('l');
    const result = evaluator.evaluate(lock, lockState);
    expect(result.status).toBe('allowed');
    if (result.status === 'allowed') {
      const applied = evaluator.applyPlan(result.consumptionPlan, lockState);
      expect(applied).toBe(true);
      expect(lockState.value).toBe('unlocked');
    }
  });
});
