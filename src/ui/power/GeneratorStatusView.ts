/**
 * Compact generator status readout — a small DOM panel shown while the
 * player is inside the generator hall, updated on generator events (never
 * per-frame). Shares the same "small, simple, event-driven" approach as
 * PowerStatusView rather than a 3D dynamic-texture panel — the in-world
 * "status panel" is instead the interaction target built in
 * GeneratorInteractionTargets that calls `controller.inspect()`.
 */
import type { Disposable } from '../../app/lifecycle/Disposable';
import type { GeneratorController } from '../../game/generator/GeneratorController';
import { formatGeneratorDebugFields } from '../../game/generator/GeneratorDebugView';

export class GeneratorStatusView implements Disposable {
  private readonly root: HTMLElement;
  private readonly content: HTMLElement;
  private readonly unsubscribe: () => void;
  private visible = false;

  constructor(
    parent: HTMLElement,
    private readonly controller: GeneratorController,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'generator-status-view';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-label', 'Generator status');
    this.root.hidden = true;
    Object.assign(this.root.style, {
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      background: 'rgba(14, 10, 10, 0.82)',
      border: '1px solid #3a2a2a',
      borderRadius: '3px',
      padding: '6px 10px',
      zIndex: '7000',
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#d3a89f',
      pointerEvents: 'none',
      whiteSpace: 'pre',
    });

    this.content = document.createElement('div');
    this.root.append(this.content);
    parent.append(this.root);

    this.unsubscribe = controller.subscribe(() => this.refresh());
    this.refresh();
  }

  show(): void {
    this.visible = true;
    this.root.hidden = false;
    this.refresh();
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

  private refresh(): void {
    if (!this.visible) return;
    const fields = formatGeneratorDebugFields(this.controller.snapshot);
    this.content.textContent = ['GENERATOR', ...fields.map(([k, v]) => `  ${k}: ${v}`)].join('\n');
  }
}
