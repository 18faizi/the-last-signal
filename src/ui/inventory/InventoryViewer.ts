/**
 * Tab-key inventory viewer overlay (z-index 27).
 *
 * Displays all held items grouped by category. Opens on Tab press in gameplay
 * mode; closes on Tab again or Escape. Uses an input lock while open.
 *
 * Purely DOM-based; no Babylon objects. Accessible: role=dialog,
 * aria-modal=true, focus managed on open/close.
 */
import type { Disposable } from '../../app/lifecycle/Disposable';
import type { InventoryService } from '../../game/inventory/InventoryService';
import type { InventoryRegistry } from '../../game/inventory/InventoryRegistry';
import { ITEM_CATEGORY_LABELS } from '../../game/inventory/ItemCategory';
import { buildInventoryItemElement } from './InventoryItemView';

export class InventoryViewer implements Disposable {
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly list: HTMLElement;
  private readonly closeButton: HTMLButtonElement;

  private isOpen = false;
  private onCloseCallback: (() => void) | null = null;
  private escapeHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly inventory: InventoryService,
    private readonly registry: InventoryRegistry,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'inventory-viewer';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Inventory');
    this.root.hidden = true;

    this.panel = document.createElement('div');
    this.panel.className = 'inv-viewer-panel';

    const header = document.createElement('div');
    header.className = 'inv-viewer-header';

    const title = document.createElement('h2');
    title.className = 'inv-viewer-title';
    title.textContent = 'INVENTORY';

    this.closeButton = document.createElement('button');
    this.closeButton.className = 'inv-viewer-close';
    this.closeButton.textContent = 'CLOSE [TAB]';
    this.closeButton.type = 'button';
    this.closeButton.addEventListener('click', () => this.close());

    header.append(title, this.closeButton);

    this.list = document.createElement('ul');
    this.list.className = 'inv-viewer-list';
    this.list.setAttribute('role', 'list');

    this.panel.append(header, this.list);
    this.root.append(this.panel);
    parent.append(this.root);
  }

  open(onClose?: () => void): void {
    if (this.isOpen) {
      return;
    }
    this.isOpen = true;
    this.onCloseCallback = onClose ?? null;
    this.render();
    this.root.hidden = false;
    this.closeButton.focus();

    this.escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Tab') {
        e.preventDefault();
        this.close();
      }
    };
    document.addEventListener('keydown', this.escapeHandler);
  }

  close(): void {
    if (!this.isOpen) {
      return;
    }
    this.isOpen = false;
    this.root.hidden = true;
    if (this.escapeHandler !== null) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }
    this.onCloseCallback?.();
    this.onCloseCallback = null;
  }

  get open_(): boolean {
    return this.isOpen;
  }

  dispose(): void {
    this.close();
    this.root.remove();
  }

  // ----- private ---------------------------------------------------------

  private render(): void {
    this.list.textContent = '';
    const snapshot = this.inventory.getSnapshot();

    if (snapshot.itemTypeCount === 0) {
      const empty = document.createElement('li');
      empty.className = 'inv-viewer-empty';
      empty.textContent = 'No items';
      this.list.append(empty);
      return;
    }

    // Group by category.
    const groups = new Map<string, Array<(typeof snapshot.entries)[number]>>();
    for (const entry of snapshot.entries) {
      const def = this.registry.get(entry.itemId);
      const categoryLabel = def !== undefined ? ITEM_CATEGORY_LABELS[def.category] : 'MISC';
      const groupKey = categoryLabel;
      let group = groups.get(groupKey);
      if (group === undefined) {
        group = [];
        groups.set(groupKey, group);
      }
      group.push(entry);
    }

    for (const [groupLabel, entries] of groups) {
      const section = document.createElement('li');
      section.className = 'inv-viewer-category';

      const categoryTitle = document.createElement('h3');
      categoryTitle.className = 'inv-viewer-category-title';
      categoryTitle.textContent = groupLabel;
      section.append(categoryTitle);

      const itemList = document.createElement('ul');
      itemList.className = 'inv-viewer-items';
      for (const entry of entries) {
        const def = this.registry.get(entry.itemId);
        itemList.append(buildInventoryItemElement(entry, def));
      }
      section.append(itemList);
      this.list.append(section);
    }
  }
}
