/**
 * Development-only F11 signal/receiver debug overlay.
 *
 * Mirrors PowerDebugOverlay's (F10) pattern exactly: a DOM text panel
 * refreshed at a reduced rate. Unlike the F3 overlay's compact receiver
 * summary, this shows target/solution values (target frequency/gain/
 * filter/phase, lock threshold, per-control quality, limiting factor) —
 * still dev-only and hidden by default, never constructed in production.
 */
import type { Disposable } from '../../../app/lifecycle/Disposable';
import type { ReceiverController } from '../../../game/receiver/ReceiverController';
import { formatReceiverDebugFields } from '../../../game/receiver/ReceiverDebugView';

export class SignalDebugOverlay implements Disposable {
  private readonly root: HTMLElement;
  private readonly content: HTMLElement;
  private visible = false;
  private frameCounter = 0;
  private readonly UPDATE_INTERVAL = 15;

  constructor(
    parent: HTMLElement,
    private readonly receiver: ReceiverController,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'signal-debug-overlay';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Signal receiver debug info');
    this.root.hidden = true;
    Object.assign(this.root.style, {
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      width: '320px',
      maxHeight: 'calc(100vh - 80px)',
      overflowY: 'auto',
      background: 'rgba(10, 14, 20, 0.92)',
      border: '1px solid #4a3a5a',
      borderRadius: '4px',
      padding: '10px',
      zIndex: '8960',
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#e0aaff',
      boxSizing: 'border-box',
    });

    const header = document.createElement('div');
    header.textContent = 'SIGNAL DEBUG — F11 to close';
    Object.assign(header.style, {
      color: '#f0c8ff',
      marginBottom: '8px',
      borderBottom: '1px solid #4a3a5a',
      paddingBottom: '6px',
    });
    this.root.append(header);

    this.content = document.createElement('pre');
    Object.assign(this.content.style, {
      margin: '0',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      fontSize: '10px',
      color: '#e0aaff',
    });
    this.root.append(this.content);
    parent.append(this.root);
  }

  get isVisible(): boolean {
    return this.visible;
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

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  /** Call from onBeforeRenderObservable each frame. */
  tick(): void {
    if (!this.visible) return;
    this.frameCounter++;
    if (this.frameCounter >= this.UPDATE_INTERVAL) {
      this.frameCounter = 0;
      this.refresh();
    }
  }

  private refresh(): void {
    const snapshot = this.receiver.getSnapshot();
    const activeSignal =
      snapshot.activeSignalId !== null
        ? this.receiver.getSignalDefinition(snapshot.activeSignalId)
        : undefined;
    const lines = formatReceiverDebugFields(snapshot, activeSignal).map(([k, v]) => `${k}: ${v}`);
    this.content.textContent = lines.join('\n');
  }

  dispose(): void {
    this.root.remove();
  }
}
