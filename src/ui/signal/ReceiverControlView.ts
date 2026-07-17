/**
 * The five tuning control rows (channel/frequency/gain/filter/phase) plus
 * scan/reset buttons. Renders current values, highlights the
 * keyboard-selected row, and surfaces the current limiting factor as
 * inline feedback text — one issue at a time, per SignalEvaluator's
 * limitingFactor field, not five simultaneous complaints.
 *
 * Every row also exposes +/- buttons so the control is fully mouse
 * operable, not keyboard-only.
 */
import type { ReceiverControllerSnapshot } from '../../game/receiver/ReceiverController';
import type { LimitingFactor } from '../../game/signal/ReceiverMetrics';

export type ControlRow = 'channel' | 'frequency' | 'gain' | 'filter' | 'phase';
export const CONTROL_ROWS: readonly ControlRow[] = [
  'channel',
  'frequency',
  'gain',
  'filter',
  'phase',
];

export interface ReceiverControlHandlers {
  readonly onCoarseAdjust: (row: ControlRow, direction: 1 | -1) => void;
  readonly onFineAdjust: (row: ControlRow, direction: 1 | -1) => void;
  readonly onSelectRow: (row: ControlRow) => void;
  readonly onScanToggle: () => void;
  readonly onReset: () => void;
}

const ROW_LABELS: Record<ControlRow, string> = {
  channel: 'CHANNEL',
  frequency: 'FREQUENCY',
  gain: 'GAIN',
  filter: 'FILTER',
  phase: 'PHASE',
};

const LIMITING_LABEL: Record<LimitingFactor, string> = {
  channel: 'WRONG CHANNEL',
  frequency: 'FREQUENCY OFF-TARGET',
  gain: 'ADJUST GAIN',
  filter: 'ADJUST FILTER',
  phase: 'ADJUST PHASE',
  none: '',
};

export class ReceiverControlView {
  private readonly root: HTMLElement;
  private readonly rowElements = new Map<ControlRow, { row: HTMLElement; value: HTMLElement }>();
  private readonly limitingBanner: HTMLElement;
  private readonly actions: HTMLElement;
  private readonly scanButton: HTMLButtonElement;
  private readonly resetButton: HTMLButtonElement;

  constructor(parent: HTMLElement, handlers: ReceiverControlHandlers) {
    this.root = document.createElement('div');
    this.root.className = 'receiver-control-list';
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', 'Receiver tuning controls');

    for (const row of CONTROL_ROWS) {
      const rowEl = document.createElement('div');
      rowEl.className = 'receiver-control-row';
      rowEl.dataset['row'] = row;
      rowEl.addEventListener('click', () => handlers.onSelectRow(row));

      const label = document.createElement('span');
      label.className = 'receiver-control-label';
      label.textContent = ROW_LABELS[row];

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'receiver-control-btn';
      minusBtn.textContent = '−';
      minusBtn.setAttribute('aria-label', `Decrease ${ROW_LABELS[row]}`);
      minusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onSelectRow(row);
        handlers.onCoarseAdjust(row, -1);
      });

      const value = document.createElement('span');
      value.className = 'receiver-control-value';

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'receiver-control-btn';
      plusBtn.textContent = '+';
      plusBtn.setAttribute('aria-label', `Increase ${ROW_LABELS[row]}`);
      plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onSelectRow(row);
        handlers.onCoarseAdjust(row, 1);
      });

      rowEl.append(label, minusBtn, value, plusBtn);
      this.root.append(rowEl);
      this.rowElements.set(row, { row: rowEl, value });
    }

    this.limitingBanner = document.createElement('div');
    this.limitingBanner.className = 'receiver-limiting-banner';

    this.actions = document.createElement('div');
    this.actions.className = 'receiver-control-actions';
    this.scanButton = document.createElement('button');
    this.scanButton.type = 'button';
    this.scanButton.className = 'receiver-action-btn';
    this.scanButton.textContent = 'SCAN';
    this.scanButton.addEventListener('click', () => handlers.onScanToggle());
    this.resetButton = document.createElement('button');
    this.resetButton.type = 'button';
    this.resetButton.className = 'receiver-action-btn';
    this.resetButton.textContent = 'RESET [R]';
    this.resetButton.addEventListener('click', () => handlers.onReset());
    this.actions.append(this.scanButton, this.resetButton);

    parent.append(this.root, this.limitingBanner, this.actions);
  }

  render(snapshot: ReceiverControllerSnapshot, selectedRow: ControlRow): void {
    for (const [row, els] of this.rowElements) {
      els.row.classList.toggle('selected', row === selectedRow);
      els.row.setAttribute('aria-selected', row === selectedRow ? 'true' : 'false');
      els.value.textContent = this.formatValue(row, snapshot);
    }
    const limiting = snapshot.metrics?.limitingFactor ?? 'none';
    this.limitingBanner.textContent = LIMITING_LABEL[limiting];
    this.limitingBanner.hidden = limiting === 'none';
    this.scanButton.textContent = snapshot.scanning ? 'STOP SCAN' : 'SCAN';
    this.scanButton.disabled = snapshot.mode !== 'Tuning' && !snapshot.scanning;
  }

  private formatValue(row: ControlRow, snapshot: ReceiverControllerSnapshot): string {
    const c = snapshot.controls;
    switch (row) {
      case 'channel':
        return String(c.channel);
      case 'frequency':
        return `${c.frequencyMHz.toFixed(1)} MHz`;
      case 'gain':
        return `${Math.round(c.gain * 100)}%`;
      case 'filter':
        return `${Math.round(c.filter * 100)}%`;
      case 'phase':
        return `${c.phaseDeg.toFixed(0)}°`;
    }
  }

  dispose(): void {
    this.root.remove();
    this.limitingBanner.remove();
    this.actions.remove();
  }
}
