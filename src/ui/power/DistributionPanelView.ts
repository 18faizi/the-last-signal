/**
 * Full-screen accessible distribution panel dialog.
 *
 * DOM/accessibility structure follows InventoryViewer.ts: role=dialog,
 * aria-modal, focus moves to the close button on open, Escape closes, focus
 * returns to the canvas on close. Purely DOM-based; no Babylon objects.
 * Re-rendered on open and after every circuit toggle so the displayed
 * requested/effective state and remaining capacity never go stale.
 *
 * Close-callback wiring follows DocumentReaderView.ts instead of
 * InventoryViewer.ts: this view's own close() only tears down the DOM — it
 * never invokes the stored callback itself. Escape/the close button invoke
 * the callback (supplied by the owning session as `() => session.close()`),
 * and the session's close() is what calls back into `view.close(canvas)`.
 * This one-directional flow avoids re-entrant close() calls.
 */
import type { Disposable } from '../../app/lifecycle/Disposable';
import type { DistributionPanelData } from '../../game/electrical/DistributionPanelController';

export type CircuitToggleHandler = (circuitId: string) => string | null;

export class DistributionPanelView implements Disposable {
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly list: HTMLElement;
  private readonly rejectionBanner: HTMLElement;
  private readonly closeButton: HTMLButtonElement;

  private isOpenFlag = false;
  private onCloseCallback: (() => void) | null = null;
  private escapeHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly getData: () => DistributionPanelData,
    private readonly onToggle: CircuitToggleHandler,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'distribution-panel-viewer';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Distribution Panel');
    this.root.hidden = true;

    this.panel = document.createElement('div');
    this.panel.className = 'power-panel';

    const header = document.createElement('div');
    header.className = 'power-panel-header';
    const title = document.createElement('h2');
    title.className = 'power-panel-title';
    title.textContent = 'DISTRIBUTION PANEL';
    this.closeButton = document.createElement('button');
    this.closeButton.className = 'power-panel-close';
    this.closeButton.type = 'button';
    this.closeButton.textContent = 'CLOSE [ESC]';
    this.closeButton.addEventListener('click', () => this.onCloseCallback?.());
    header.append(title, this.closeButton);

    this.summary = document.createElement('div');
    this.summary.className = 'power-panel-summary';

    this.rejectionBanner = document.createElement('div');
    this.rejectionBanner.className = 'power-panel-rejection';
    this.rejectionBanner.hidden = true;

    this.list = document.createElement('ul');
    this.list.className = 'power-panel-list';
    this.list.setAttribute('role', 'list');

    this.panel.append(header, this.summary, this.rejectionBanner, this.list);
    this.root.append(this.panel);
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return this.isOpenFlag;
  }

  open(onClose: () => void): void {
    if (this.isOpenFlag) return;
    this.isOpenFlag = true;
    this.onCloseCallback = onClose;
    this.render();
    this.root.hidden = false;
    this.closeButton.focus();

    this.escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        this.onCloseCallback?.();
      }
    };
    document.addEventListener('keydown', this.escapeHandler);
  }

  close(returnFocusTo: HTMLElement): void {
    if (!this.isOpenFlag) return;
    this.isOpenFlag = false;
    this.root.hidden = true;
    if (this.escapeHandler !== null) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }
    // Note: unlike InventoryViewer, close() does not invoke onCloseCallback —
    // it is invoked exactly once by the escape/close-button handlers, which
    // call out to the owning session's own close() (mirrors
    // DocumentReaderView + DocumentController's split responsibility so a
    // caller-initiated close() never re-enters the callback).
    this.onCloseCallback = null;
    returnFocusTo.focus();
  }

  dispose(): void {
    if (this.escapeHandler !== null) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }
    this.root.remove();
  }

  // ----- private -----------------------------------------------------------

  private render(): void {
    const data = this.getData();

    this.summary.textContent = '';
    const genRow = document.createElement('p');
    genRow.textContent = `GENERATOR: ${data.generatorAvailable ? 'ONLINE' : 'OFFLINE'} — ${data.generatorAllocated}/${data.generatorCapacity} UNITS ALLOCATED`;
    const battRow = document.createElement('p');
    battRow.textContent = `EMERGENCY BATTERY: ${data.batteryAvailable ? 'ONLINE' : 'OFFLINE'} — ${data.batteryAllocated}/${data.batteryCapacity} UNITS ALLOCATED`;
    this.summary.append(genRow, battRow);

    this.list.textContent = '';
    for (const row of data.rows) {
      const item = document.createElement('li');
      item.className = 'power-panel-row';

      const label = document.createElement('div');
      label.className = 'power-panel-row-label';
      label.textContent = `${row.displayName} (cost ${row.capacityCost})`;

      const desc = document.createElement('div');
      desc.className = 'power-panel-row-desc';
      desc.textContent = row.description;

      const status = document.createElement('div');
      status.className = 'power-panel-row-status';
      status.textContent = `REQUESTED: ${row.requested.toUpperCase()} · EFFECTIVE: ${row.effective.toUpperCase()} · BREAKER: ${row.breakerState.toUpperCase()}`;

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'power-panel-row-toggle';
      toggle.textContent = row.requested === 'on' ? 'TURN OFF' : 'TURN ON';
      toggle.addEventListener('click', () => {
        const rejection = this.onToggle(row.circuitId);
        this.showRejection(rejection);
        this.render();
      });

      item.append(label, desc, status, toggle);
      this.list.append(item);
    }
  }

  private showRejection(reason: string | null): void {
    if (reason === null) {
      this.rejectionBanner.hidden = true;
      this.rejectionBanner.textContent = '';
      return;
    }
    this.rejectionBanner.hidden = false;
    this.rejectionBanner.textContent = reason;
  }
}
