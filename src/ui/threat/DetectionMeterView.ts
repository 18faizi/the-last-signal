/**
 * Restrained detection/awareness meter (Milestone 0.9).
 *
 * Hidden while the threat is dormant/inactive; appears only once suspicion
 * or detection actually exists. Communicates through a TEXT state label
 * (UNSEEN / OBSERVED / SUSPICION / DETECTED / SEARCHING) plus a quantized
 * bar — never color alone (accessibility), and never reveals the threat's
 * position (no compass, no minimap, no direction pips).
 *
 * Change-only DOM updates: the label writes only when the state string
 * changes, the bar only when its 5%-quantized width changes.
 */
export type DetectionMeterState = 'UNSEEN' | 'OBSERVED' | 'SUSPICION' | 'DETECTED' | 'SEARCHING';

export class DetectionMeterView {
  private readonly root: HTMLElement;
  private readonly label: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly srText: HTMLElement;
  private visible = false;
  private lastLabel: DetectionMeterState | null = null;
  private lastQuantized = -1;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'detection-meter';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    this.root.hidden = true;
    Object.assign(this.root.style, {
      position: 'fixed',
      top: '18px',
      left: '50%',
      transform: 'translateX(-50%)',
      minWidth: '180px',
      padding: '6px 14px',
      background: 'rgba(8, 10, 14, 0.8)',
      border: '1px solid #3a4a5a',
      borderRadius: '4px',
      textAlign: 'center',
      fontFamily: 'monospace',
      zIndex: '8925',
      pointerEvents: 'none',
    });

    this.label = document.createElement('div');
    Object.assign(this.label.style, {
      fontSize: '12px',
      letterSpacing: '3px',
      color: '#cfe0f0',
      marginBottom: '4px',
    });
    this.root.append(this.label);

    const track = document.createElement('div');
    Object.assign(track.style, {
      height: '4px',
      background: 'rgba(255,255,255,0.12)',
      borderRadius: '2px',
      overflow: 'hidden',
    });
    this.bar = document.createElement('div');
    Object.assign(this.bar.style, {
      height: '100%',
      width: '0%',
      background: '#cfe0f0',
      transition: 'width 120ms linear',
    });
    track.append(this.bar);
    this.root.append(track);

    // Visually-hidden accessible status text ("threat awareness: SUSPICION").
    this.srText = document.createElement('span');
    Object.assign(this.srText.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clipPath: 'inset(50%)',
    });
    this.root.append(this.srText);

    parent.append(this.root);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  get currentLabel(): DetectionMeterState | null {
    return this.visible ? this.lastLabel : null;
  }

  /**
   * Called by the threat bindings on meaningful change only. `meter` is the
   * dominant 0-1 magnitude (max of suspicion/detection).
   */
  update(state: DetectionMeterState | null, meter: number): void {
    if (state === null) {
      this.hide();
      return;
    }
    if (!this.visible) {
      this.root.hidden = false;
      this.visible = true;
    }
    if (state !== this.lastLabel) {
      this.lastLabel = state;
      this.label.textContent = state;
      this.srText.textContent = `Threat awareness: ${state}`;
      const color =
        state === 'DETECTED'
          ? '#f0a0a0'
          : state === 'SEARCHING' || state === 'SUSPICION'
            ? '#e0c080'
            : '#cfe0f0';
      this.label.style.color = color;
      this.bar.style.background = color;
    }
    const quantized = Math.round(Math.min(Math.max(meter, 0), 1) * 20) * 5;
    if (quantized !== this.lastQuantized) {
      this.lastQuantized = quantized;
      this.bar.style.width = `${quantized}%`;
    }
  }

  hide(): void {
    if (!this.visible) return;
    this.root.hidden = true;
    this.visible = false;
    this.lastLabel = null;
    this.lastQuantized = -1;
    this.bar.style.width = '0%';
  }

  dispose(): void {
    this.root.remove();
  }
}
