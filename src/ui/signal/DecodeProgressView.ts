/**
 * Lock/decode progress bars + the current status message, selected from the
 * receiver's actual mode + metrics (never guessed/hardcoded from partial
 * state) — see `selectStatusMessage()`, exported standalone so it's unit
 * testable without touching the DOM.
 */
import type { ReceiverControllerSnapshot } from '../../game/receiver/ReceiverController';

export type ReceiverStatusMessage =
  | 'NO SIGNAL'
  | 'SCANNING'
  | 'CARRIER DETECTED'
  | 'SIGNAL UNSTABLE'
  | 'ACQUIRING LOCK'
  | 'LOCKED'
  | 'DECODING'
  | 'SIGNAL LOST'
  | 'TRANSMISSION DECODED';

export function selectStatusMessage(snapshot: ReceiverControllerSnapshot): ReceiverStatusMessage {
  switch (snapshot.mode) {
    case 'Decoded':
      return 'TRANSMISSION DECODED';
    case 'SignalLost':
      return 'SIGNAL LOST';
    case 'Decoding':
      return snapshot.decodeState === 'Paused' ? 'SIGNAL UNSTABLE' : 'DECODING';
    case 'Locked':
      return 'LOCKED';
    case 'Scanning':
      return 'SCANNING';
    case 'Tuning':
      switch (snapshot.lockState) {
        case 'Acquiring':
          return 'ACQUIRING LOCK';
        case 'Candidate':
          return 'CARRIER DETECTED';
        default:
          return 'NO SIGNAL';
      }
    default:
      return 'NO SIGNAL';
  }
}

export class DecodeProgressView {
  private readonly root: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly lockBarFill: HTMLElement;
  private readonly lockLabel: HTMLElement;
  private readonly decodeBarFill: HTMLElement;
  private readonly decodeLabel: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'receiver-decode-progress';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'receiver-status-message';

    const lockRow = document.createElement('div');
    lockRow.className = 'receiver-progress-row';
    this.lockLabel = document.createElement('span');
    this.lockLabel.className = 'receiver-progress-label';
    const lockBarOuter = document.createElement('div');
    lockBarOuter.className = 'receiver-progress-bar';
    this.lockBarFill = document.createElement('div');
    this.lockBarFill.className = 'receiver-progress-fill lock';
    lockBarOuter.append(this.lockBarFill);
    lockRow.append(this.lockLabel, lockBarOuter);

    const decodeRow = document.createElement('div');
    decodeRow.className = 'receiver-progress-row';
    this.decodeLabel = document.createElement('span');
    this.decodeLabel.className = 'receiver-progress-label';
    const decodeBarOuter = document.createElement('div');
    decodeBarOuter.className = 'receiver-progress-bar';
    this.decodeBarFill = document.createElement('div');
    this.decodeBarFill.className = 'receiver-progress-fill decode';
    decodeBarOuter.append(this.decodeBarFill);
    decodeRow.append(this.decodeLabel, decodeBarOuter);

    this.root.append(this.statusEl, lockRow, decodeRow);
    parent.append(this.root);
  }

  render(snapshot: ReceiverControllerSnapshot): void {
    this.statusEl.textContent = selectStatusMessage(snapshot);
    const lockPct = Math.round(snapshot.acquisitionProgress * 100);
    this.lockLabel.textContent = `LOCK ${lockPct}%`;
    this.lockBarFill.style.width = `${lockPct}%`;
    const decodePct = Math.round(snapshot.decodeProgress * 100);
    this.decodeLabel.textContent = `DECODE ${decodePct}%`;
    this.decodeBarFill.style.width = `${decodePct}%`;
  }

  dispose(): void {
    this.root.remove();
  }
}
