/**
 * Renders one entry in the inventory viewer list.
 *
 * Returns a DOM element for inclusion in the viewer list. Stateless helper —
 * the viewer recreates item views when the inventory changes.
 */
import type { InventoryEntry } from '../../game/inventory/InventoryEntry';
import type { InventoryItemDefinition } from '../../game/inventory/InventoryItemDefinition';

export function buildInventoryItemElement(
  entry: InventoryEntry,
  def: InventoryItemDefinition | undefined,
): HTMLElement {
  const item = document.createElement('li');
  item.className = 'inv-viewer-item';

  const name = document.createElement('span');
  name.className = 'inv-viewer-item-name';
  name.textContent = def?.displayName ?? entry.itemId;

  const qty = document.createElement('span');
  qty.className = 'inv-viewer-item-qty';
  qty.textContent = entry.quantity > 1 ? `×${entry.quantity}` : '';
  qty.hidden = entry.quantity <= 1;

  item.append(name, qty);

  if (def?.description !== undefined) {
    const desc = document.createElement('p');
    desc.className = 'inv-viewer-item-desc';
    desc.textContent = def.description;
    item.append(desc);
  }

  return item;
}
