/**
 * Samples collected, comparison state, and — on full resolution — the
 * provisional reveal text. The reveal wording is deliberately hedged
 * ("indicates", "provisional") and never confirms supernatural causality;
 * it only establishes the local-loop/anomalous classification (spec §14/§28).
 */
import type { SourceAnalysisSnapshot } from '../../game/source-analysis/SourceAnalysisController';

export class SourceAnalysisView {
  private readonly root: HTMLElement;
  private readonly stateEl: HTMLElement;
  private readonly samplesEl: HTMLElement;
  private readonly compareButton: HTMLButtonElement;
  private readonly revealEl: HTMLElement;

  constructor(parent: HTMLElement, onRunComparison: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'antenna-source-analysis';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');

    const title = document.createElement('div');
    title.className = 'antenna-section-title';
    title.textContent = 'SOURCE ANALYSIS';

    this.stateEl = document.createElement('div');
    this.stateEl.className = 'antenna-source-analysis-state';
    this.samplesEl = document.createElement('ul');
    this.samplesEl.className = 'antenna-source-analysis-samples';

    this.compareButton = document.createElement('button');
    this.compareButton.type = 'button';
    this.compareButton.className = 'antenna-compare-btn';
    this.compareButton.textContent = 'RUN COMPARISON [ENTER]';
    this.compareButton.addEventListener('click', () => onRunComparison());

    this.revealEl = document.createElement('div');
    this.revealEl.className = 'antenna-reveal-text';
    this.revealEl.hidden = true;

    this.root.append(title, this.stateEl, this.samplesEl, this.compareButton, this.revealEl);
    parent.append(this.root);
  }

  render(snapshot: SourceAnalysisSnapshot): void {
    this.stateEl.textContent = `STATUS: ${snapshot.state.toUpperCase()} (${snapshot.samples.length}/${snapshot.requiredArrayIds.length} SAMPLES)`;

    this.samplesEl.replaceChildren(
      ...snapshot.samples.map((sample) => {
        const li = document.createElement('li');
        li.textContent = `${sample.arrayId} — ${sample.bearing.category.toUpperCase()} (confidence ${Math.round(
          sample.confidence * 100,
        )}%)`;
        return li;
      }),
    );

    this.compareButton.hidden =
      snapshot.state !== 'Collecting' || snapshot.samples.length < snapshot.requiredArrayIds.length;

    if (snapshot.state === 'Resolved' && snapshot.result !== null) {
      this.revealEl.hidden = false;
      this.revealEl.textContent =
        'PRELIMINARY ANALYSIS — NO VALID EXTERNAL BEARING FOUND. RETURN PATH APPEARS TO ' +
        'RESOLVE TO LOCAL FACILITY INFRASTRUCTURE. PROVISIONAL SOURCE CLASSIFICATION: ' +
        'LOCAL LOOP. FURTHER INVESTIGATION REQUIRED — THIS ASSESSMENT IS NOT CONCLUSIVE.';
    } else {
      this.revealEl.hidden = true;
      this.revealEl.textContent = '';
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
