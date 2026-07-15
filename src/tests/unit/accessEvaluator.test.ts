import { describe, expect, it } from 'vitest';
import { InventoryRegistry } from '../../game/inventory/InventoryRegistry';
import { InventoryService } from '../../game/inventory/InventoryService';
import { AccessEvaluator } from '../../game/access/AccessEvaluator';
import { allOf, anyOf, noRequirement, requireItem } from '../../game/access/AccessRequirement';
import { createLock } from '../../game/access/LockState';

function setup() {
  const reg = new InventoryRegistry();
  reg.register({
    id: 'key-a',
    displayName: 'Maintenance Key',
    category: 'key',
    consumptionPolicy: 'retain',
  });
  reg.register({
    id: 'card-b',
    displayName: 'Security Card',
    category: 'card',
    consumptionPolicy: 'retain',
  });
  reg.register({
    id: 'tool-c',
    displayName: 'Bypass Tool',
    category: 'tool',
    consumptionPolicy: 'consume-one',
    maxStack: 3,
  });
  const inv = new InventoryService(reg);
  const eval_ = new AccessEvaluator(inv, reg);
  return { reg, inv, eval_ };
}

describe('AccessEvaluator', () => {
  describe('NoRequirement', () => {
    it('always allows', () => {
      const { eval_ } = setup();
      const lock = { id: 'l', requirement: noRequirement() };
      const lockState = createLock('l');
      expect(eval_.evaluate(lock, lockState)).toMatchObject({ status: 'allowed' });
    });
  });

  describe('ItemRequirement', () => {
    it('denies when item not held', () => {
      const { eval_ } = setup();
      const lock = { id: 'l', requirement: requireItem('key-a'), lockedReason: 'REQUIRES KEY' };
      const lockState = createLock('l');
      const result = eval_.evaluate(lock, lockState);
      expect(result.status).toBe('denied');
      if (result.status === 'denied') {
        expect(result.userFacingReason).toBe('REQUIRES KEY');
        expect(result.missingItems).toContain('key-a');
      }
    });

    it('allows when item held', () => {
      const { inv, eval_ } = setup();
      inv.add('key-a');
      const lock = { id: 'l', requirement: requireItem('key-a') };
      const lockState = createLock('l');
      const result = eval_.evaluate(lock, lockState);
      expect(result.status).toBe('allowed');
    });

    it('plan contains retain step for retain policy', () => {
      const { inv, eval_ } = setup();
      inv.add('key-a');
      const lock = { id: 'l', requirement: requireItem('key-a') };
      const lockState = createLock('l');
      const result = eval_.evaluate(lock, lockState);
      if (result.status === 'allowed') {
        expect(result.consumptionPlan[0]).toMatchObject({ itemId: 'key-a', policy: 'retain' });
      }
    });
  });

  describe('AnyOf', () => {
    it('allows when at least one branch passes', () => {
      const { inv, eval_ } = setup();
      inv.add('card-b');
      const lock = {
        id: 'l',
        requirement: anyOf(requireItem('key-a'), requireItem('card-b')),
      };
      const lockState = createLock('l');
      expect(eval_.evaluate(lock, lockState)).toMatchObject({ status: 'allowed' });
    });

    it('denies when no branch passes', () => {
      const { eval_ } = setup();
      const lock = {
        id: 'l',
        requirement: anyOf(requireItem('key-a'), requireItem('card-b')),
        lockedReason: 'NEEDS KEY OR CARD',
      };
      const lockState = createLock('l');
      const result = eval_.evaluate(lock, lockState);
      expect(result.status).toBe('denied');
    });
  });

  describe('AllOf', () => {
    it('denies when any branch fails', () => {
      const { inv, eval_ } = setup();
      inv.add('key-a');
      const lock = {
        id: 'l',
        requirement: allOf(requireItem('key-a'), requireItem('card-b')),
      };
      const lockState = createLock('l');
      const result = eval_.evaluate(lock, lockState);
      expect(result.status).toBe('denied');
      if (result.status === 'denied') {
        expect(result.missingItems).toContain('card-b');
      }
    });

    it('allows when all branches pass', () => {
      const { inv, eval_ } = setup();
      inv.add('key-a');
      inv.add('card-b');
      const lock = {
        id: 'l',
        requirement: allOf(requireItem('key-a'), requireItem('card-b')),
      };
      const lockState = createLock('l');
      expect(eval_.evaluate(lock, lockState)).toMatchObject({ status: 'allowed' });
    });
  });

  describe('applyPlan', () => {
    it('unlocks and retains retain items', () => {
      const { inv, eval_ } = setup();
      inv.add('key-a');
      const lock = { id: 'l', requirement: requireItem('key-a') };
      const lockState = createLock('l');
      const result = eval_.evaluate(lock, lockState);
      if (result.status === 'allowed') {
        const applied = eval_.applyPlan(result.consumptionPlan, lockState);
        expect(applied).toBe(true);
        expect(lockState.value).toBe('unlocked');
        expect(inv.has('key-a')).toBe(true); // retained
      }
    });

    it('consumes consume-one items', () => {
      const { inv, eval_ } = setup();
      inv.add('tool-c', 2);
      const lock = {
        id: 'l',
        requirement: requireItem('tool-c', { consumptionPolicy: 'consume-one' }),
      };
      const lockState = createLock('l');
      const result = eval_.evaluate(lock, lockState);
      if (result.status === 'allowed') {
        eval_.applyPlan(result.consumptionPlan, lockState);
        expect(inv.getQuantity('tool-c')).toBe(1);
      }
    });

    it('already unlocked doors allow without consumption', () => {
      const setup_ = setup();
      const lock = { id: 'l', requirement: requireItem('key-a') };
      const lockState = createLock('l', 'unlocked');
      const result = setup_.eval_.evaluate(lock, lockState);
      expect(result.status).toBe('allowed');
      if (result.status === 'allowed') {
        expect(result.consumptionPlan).toHaveLength(0);
      }
    });

    it('returns false when item removed between evaluate and apply', () => {
      const { inv, eval_ } = setup();
      inv.add('key-a');
      const lock = { id: 'l', requirement: requireItem('key-a') };
      const lockState = createLock('l');
      const result = eval_.evaluate(lock, lockState);
      // Remove the item before applying.
      inv.remove('key-a');
      if (result.status === 'allowed') {
        const applied = eval_.applyPlan(result.consumptionPlan, lockState);
        expect(applied).toBe(false);
        expect(lockState.value).toBe('locked'); // unchanged
      }
    });
  });
});
