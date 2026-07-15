/**
 * Coarse grouping for inventory items.
 *
 * Used by the inventory viewer to sort and label items. Milestone 0.4
 * introduces two categories; future milestones will extend the union.
 */
export type ItemCategory = 'key' | 'card' | 'tool' | 'document' | 'misc';

export const ITEM_CATEGORY_LABELS: Readonly<Record<ItemCategory, string>> = {
  key: 'KEYS',
  card: 'ACCESS CARDS',
  tool: 'TOOLS',
  document: 'DOCUMENTS',
  misc: 'MISC',
};
