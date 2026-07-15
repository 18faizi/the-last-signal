import { describe, expect, it } from 'vitest';
import { allOf, anyOf, noRequirement, requireItem } from '../../game/access/AccessRequirement';

describe('AccessRequirement helpers', () => {
  it('noRequirement has kind none', () => {
    expect(noRequirement()).toMatchObject({ kind: 'none' });
  });

  it('requireItem has kind item with the given itemId', () => {
    const req = requireItem('key-a');
    expect(req).toMatchObject({ kind: 'item', itemId: 'key-a' });
  });

  it('requireItem supports count and consumptionPolicy overrides', () => {
    const req = requireItem('tool-c', { count: 2, consumptionPolicy: 'consume-one' });
    expect(req.count).toBe(2);
    expect(req.consumptionPolicy).toBe('consume-one');
  });

  it('anyOf wraps children', () => {
    const req = anyOf(requireItem('key-a'), requireItem('card-b'));
    expect(req.kind).toBe('any-of');
    expect(req.children).toHaveLength(2);
  });

  it('allOf wraps children', () => {
    const req = allOf(requireItem('key-a'), requireItem('card-b'));
    expect(req.kind).toBe('all-of');
    expect(req.children).toHaveLength(2);
  });
});
