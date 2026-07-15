import { describe, expect, it, vi } from 'vitest';
import { InventoryRegistry } from '../../game/inventory/InventoryRegistry';
import { InventoryService } from '../../game/inventory/InventoryService';
import type { InventoryEvent } from '../../game/inventory/InventoryEvent';

function makeRegistry(): InventoryRegistry {
  const reg = new InventoryRegistry();
  reg.register({
    id: 'key-a',
    displayName: 'Key A',
    category: 'key',
    consumptionPolicy: 'retain',
  });
  reg.register({
    id: 'card-b',
    displayName: 'Card B',
    category: 'card',
    consumptionPolicy: 'retain',
  });
  reg.register({
    id: 'tool-c',
    displayName: 'Tool C',
    category: 'tool',
    consumptionPolicy: 'consume-one',
    maxStack: 3,
  });
  return reg;
}

describe('InventoryService', () => {
  it('starts empty', () => {
    const svc = new InventoryService(makeRegistry());
    expect(svc.getSnapshot().itemTypeCount).toBe(0);
    expect(svc.has('key-a')).toBe(false);
  });

  it('add increases quantity and emits item-added', () => {
    const svc = new InventoryService(makeRegistry());
    const events: InventoryEvent[] = [];
    svc.subscribe((e) => events.push(e));

    svc.add('key-a');
    expect(svc.getQuantity('key-a')).toBe(1);
    expect(svc.has('key-a')).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'item-added', itemId: 'key-a', quantity: 1 });
  });

  it('subsequent add to existing item emits quantity-changed', () => {
    const svc = new InventoryService(makeRegistry());
    const events: InventoryEvent[] = [];
    svc.subscribe((e) => events.push(e));

    svc.add('tool-c');
    svc.add('tool-c');
    expect(events[1]).toMatchObject({ kind: 'quantity-changed', itemId: 'tool-c', newQuantity: 2 });
  });

  it('respects maxStack', () => {
    const svc = new InventoryService(makeRegistry());
    svc.add('tool-c', 10); // maxStack is 3
    expect(svc.getQuantity('tool-c')).toBe(3);
  });

  it('remove decreases quantity and emits item-removed', () => {
    const svc = new InventoryService(makeRegistry());
    svc.add('key-a');
    const events: InventoryEvent[] = [];
    svc.subscribe((e) => events.push(e));

    svc.remove('key-a');
    expect(svc.has('key-a')).toBe(false);
    expect(events[0]).toMatchObject({ kind: 'item-removed', itemId: 'key-a', totalQuantity: 0 });
  });

  it('remove from non-existent item is no-op', () => {
    const svc = new InventoryService(makeRegistry());
    const listener = vi.fn();
    svc.subscribe(listener);
    svc.remove('key-a');
    expect(listener).not.toHaveBeenCalled();
  });

  it('removeAll removes all units', () => {
    const svc = new InventoryService(makeRegistry());
    svc.add('tool-c', 3);
    svc.removeAll('tool-c');
    expect(svc.has('tool-c')).toBe(false);
  });

  it('reset clears everything and emits inventory-reset', () => {
    const svc = new InventoryService(makeRegistry());
    svc.add('key-a');
    svc.add('card-b');
    const events: InventoryEvent[] = [];
    svc.subscribe((e) => events.push(e));

    svc.reset();
    expect(svc.getSnapshot().itemTypeCount).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'inventory-reset' });
  });

  it('snapshot has() and getQuantity() are accurate', () => {
    const svc = new InventoryService(makeRegistry());
    svc.add('tool-c', 2);
    const snap = svc.getSnapshot();
    expect(snap.has('tool-c')).toBe(true);
    expect(snap.getQuantity('tool-c')).toBe(2);
    expect(snap.has('key-a')).toBe(false);
    expect(snap.getQuantity('key-a')).toBe(0);
  });

  it('throws on unknown item id', () => {
    const svc = new InventoryService(makeRegistry());
    expect(() => svc.add('non-existent')).toThrow('unknown item id');
  });

  it('unsubscribe stops listener', () => {
    const svc = new InventoryService(makeRegistry());
    const listener = vi.fn();
    const unsub = svc.subscribe(listener);
    unsub();
    svc.add('key-a');
    expect(listener).not.toHaveBeenCalled();
  });
});
