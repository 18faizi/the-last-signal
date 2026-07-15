import { describe, expect, it } from 'vitest';
import { InventoryRegistry } from '../../game/inventory/InventoryRegistry';

describe('InventoryRegistry', () => {
  it('registers and retrieves a definition', () => {
    const reg = new InventoryRegistry();
    reg.register({ id: 'key-a', displayName: 'Key A', category: 'key' });
    expect(reg.get('key-a')).toMatchObject({ displayName: 'Key A' });
  });

  it('throws on duplicate id', () => {
    const reg = new InventoryRegistry();
    reg.register({ id: 'key-a', displayName: 'Key A', category: 'key' });
    expect(() => reg.register({ id: 'key-a', displayName: 'Key A 2', category: 'key' })).toThrow(
      'duplicate item id',
    );
  });

  it('throws on invalid id (empty string)', () => {
    const reg = new InventoryRegistry();
    expect(() => reg.register({ id: '', displayName: 'Bad', category: 'key' })).toThrow(
      'invalid item id',
    );
  });

  it('throws on id with leading whitespace', () => {
    const reg = new InventoryRegistry();
    expect(() => reg.register({ id: ' key', displayName: 'Bad', category: 'key' })).toThrow(
      'invalid item id',
    );
  });

  it('getAll returns all registered items', () => {
    const reg = new InventoryRegistry();
    reg.register({ id: 'key-a', displayName: 'Key A', category: 'key' });
    reg.register({ id: 'card-b', displayName: 'Card B', category: 'card' });
    expect(reg.getAll()).toHaveLength(2);
  });

  it('clear removes all registrations', () => {
    const reg = new InventoryRegistry();
    reg.register({ id: 'key-a', displayName: 'Key A', category: 'key' });
    reg.clear();
    expect(reg.get('key-a')).toBeUndefined();
    expect(reg.getAll()).toHaveLength(0);
  });
});
