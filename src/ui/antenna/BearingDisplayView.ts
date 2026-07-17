/**
 * Live bearing-estimate readout for the currently-selected array — a
 * preview computed from the SAME pure BearingEvaluator used for recorded
 * samples (see AntennaPanelView.ts's renderFrame()), but NOT itself a
 * recorded sample; only an explicit "collect sample" action
 * (Enter/onCollectSample) stores one into SourceAnalysisController.
 */
import type { SignalBearing } from '../../game/source-analysis/SignalBearing';

export class BearingDisplayView {
  private readonly root: HTMLElement;
  private readonly azEl: HTMLElement;
  private readonly confidenceEl: HTMLElement;
  private readonly stabilityEl: HTMLElement;
  private readonly categoryEl: HTMLElement;
  private readonly validEl: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'antenna-bearing-display';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');

    const title = document.createElement('div');
    title.className = 'antenna-section-title';
    title.textContent = 'BEARING ESTIMATE';

    this.azEl = document.createElement('div');
    this.confidenceEl = document.createElement('div');
    this.stabilityEl = document.createElement('div');
    this.categoryEl = document.createElement('div');
    this.validEl = document.createElement('div');

    this.root.append(
      title,
      this.azEl,
      this.confidenceEl,
      this.stabilityEl,
      this.categoryEl,
      this.validEl,
    );
    parent.append(this.root);
  }

  render(bearing: SignalBearing | null): void {
    if (bearing === null) {
      this.azEl.textContent = 'BEARING: —';
      this.confidenceEl.textContent = 'CONFIDENCE: —';
      this.stabilityEl.textContent = 'STABILITY: —';
      this.categoryEl.textContent = 'CATEGORY: —';
      this.validEl.textContent = 'EXTERNAL SOURCE VALID: —';
      return;
    }
    this.azEl.textContent = `BEARING: ${bearing.estimatedAzimuthDeg.toFixed(1)}° / ${bearing.estimatedElevationDeg.toFixed(1)}°`;
    this.confidenceEl.textContent = `CONFIDENCE: ${Math.round(bearing.confidence * 100)}%`;
    this.stabilityEl.textContent = `STABILITY: ${Math.round(bearing.stability * 100)}%`;
    this.categoryEl.textContent = `CATEGORY: ${bearing.category.toUpperCase()}`;
    this.validEl.textContent = `EXTERNAL SOURCE VALID: ${bearing.externalSourceValid ? 'YES' : 'NO'}`;
  }

  dispose(): void {
    this.root.remove();
  }
}
