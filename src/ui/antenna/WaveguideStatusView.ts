/**
 * Waveguide route/continuity display for the currently-selected array's
 * feed path. Read-only — the actual route correction happens at the
 * physical junction-box interaction target (AntennaJunctionTarget.ts), not
 * from inside this panel, so the player has to physically visit the
 * junction (spec §24) rather than fixing everything from the cabinet.
 */
import type { WaveguidePathSnapshot } from '../../game/waveguide/WaveguideController';

export class WaveguideStatusView {
  private readonly root: HTMLElement;
  private readonly stateEl: HTMLElement;
  private readonly portEl: HTMLElement;
  private readonly continuityEl: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'antenna-waveguide-status';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');

    const title = document.createElement('div');
    title.className = 'antenna-section-title';
    title.textContent = 'WAVEGUIDE';

    this.stateEl = document.createElement('div');
    this.stateEl.className = 'antenna-waveguide-state';
    this.portEl = document.createElement('div');
    this.portEl.className = 'antenna-waveguide-port';
    this.continuityEl = document.createElement('div');
    this.continuityEl.className = 'antenna-waveguide-continuity';

    this.root.append(title, this.stateEl, this.portEl, this.continuityEl);
    parent.append(this.root);
  }

  render(snapshot: WaveguidePathSnapshot | undefined): void {
    if (snapshot === undefined) {
      this.stateEl.textContent = 'ROUTE: —';
      this.portEl.textContent = 'PORT: —';
      this.continuityEl.textContent = 'CONTINUITY: —';
      return;
    }
    this.stateEl.textContent = `ROUTE: ${snapshot.state.toUpperCase()}`;
    this.portEl.textContent = `PORT: ${snapshot.currentPortId}`;
    this.continuityEl.textContent = `CONTINUITY: ${Math.round(snapshot.continuity * 100)}%`;
  }

  dispose(): void {
    this.root.remove();
  }
}
