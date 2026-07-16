/**
 * Compact facility power-status board widget.
 *
 * A small always-a-little-visible DOM readout (not a full dialog) shown once
 * the player has discovered the generator hall — it reflects the facility's
 * circuit energization at a glance. Deliberately simple: no DynamicTexture,
 * no 3D geometry, just a fixed-position DOM corner widget updated on power
 * events (never per-frame).
 */
import type { Disposable } from '../../app/lifecycle/Disposable';
import type { PowerNetwork } from '../../game/power/PowerNetwork';

export class PowerStatusView implements Disposable {
  private readonly root: HTMLElement;
  private readonly content: HTMLElement;
  private readonly unsubscribe: () => void;
  private visible = false;

  constructor(parent: HTMLElement, network: PowerNetwork) {
    this.root = document.createElement('div');
    this.root.id = 'power-status-view';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-label', 'Facility power status');
    this.root.hidden = true;
    Object.assign(this.root.style, {
      position: 'fixed',
      bottom: '16px',
      left: '16px',
      background: 'rgba(10, 14, 10, 0.82)',
      border: '1px solid #2a3a2a',
      borderRadius: '3px',
      padding: '6px 10px',
      zIndex: '7000',
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#9fd39f',
      pointerEvents: 'none',
    });

    this.content = document.createElement('div');
    this.root.append(this.content);
    parent.append(this.root);

    this.unsubscribe = network.subscribe(() => this.refresh(network));
    this.refresh(network);
  }

  show(network: PowerNetwork): void {
    this.visible = true;
    this.root.hidden = false;
    this.refresh(network);
  }

  hide(): void {
    this.visible = false;
    this.root.hidden = true;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  dispose(): void {
    this.unsubscribe();
    this.root.remove();
  }

  private refresh(network: PowerNetwork): void {
    if (!this.visible) return;
    const snap = network.getSnapshot();
    const energized = snap.circuits.filter((c) => c.effective === 'energized').length;
    const lines = [`FACILITY POWER — ${energized}/${snap.circuits.length} CIRCUITS ONLINE`];
    for (const source of snap.sources) {
      lines.push(
        `  ${source.displayName.toUpperCase()}: ${source.availability.toUpperCase()} (${source.allocatedCapacity}/${source.maxCapacity})`,
      );
    }
    this.content.textContent = lines.join('\n');
    this.content.style.whiteSpace = 'pre';
  }
}
