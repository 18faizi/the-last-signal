/** Stable identifier for an inventory item definition, e.g. 'maintenance_key'. */
export type InventoryItemId = string;

/** Non-empty, trimmed identifiers only — prevents silent lookup mismatches. */
export function isValidItemId(id: string): boolean {
  return typeof id === 'string' && id.trim().length > 0 && id === id.trim();
}
