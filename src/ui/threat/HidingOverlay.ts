/**
 * Hiding-state overlay (Milestone 0.9).
 *
 * Minimal, restrained DOM indicator shown only while the player occupies a
 * hiding spot: the spot name, a "HIDDEN"/"PARTIAL COVER" status and the
 * exit prompt. Change-only updates — show/hide toggles DOM once; the text
 * is written once per session (nothing in it changes per frame).
 */
export class HidingOverlay {
  private readonly root: HTMLElement;
  private readonly status: HTMLElement;
  private readonly label: HTMLElement;
  private readonly tensionLabel: HTMLElement;
  private visible = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'hiding-overlay';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-label', 'Hiding state');
    this.root.hidden = true;
    Object.assign(this.root.style, {
      position: 'fixed',
      bottom: '72px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '10px 18px',
      background: 'rgba(8, 10, 14, 0.85)',
      border: '1px solid #3a4a5a',
      borderRadius: '4px',
      textAlign: 'center',
      fontFamily: 'monospace',
      color: '#cfe0f0',
      zIndex: '8930',
      pointerEvents: 'none',
    });

    this.status = document.createElement('div');
    Object.assign(this.status.style, {
      fontSize: '14px',
      letterSpacing: '2px',
      marginBottom: '4px',
    });
    this.root.append(this.status);

    this.tensionLabel = document.createElement('div');
    this.tensionLabel.id = 'hiding-tension-label';
    Object.assign(this.tensionLabel.style, {
      fontSize: '12px',
      fontWeight: 'bold',
      letterSpacing: '2px',
      color: '#ff4444',
      marginBottom: '4px',
      display: 'none',
    });
    this.tensionLabel.textContent = 'HOLD BREATH — REMAIN STILL';
    this.root.append(this.tensionLabel);

    this.label = document.createElement('div');
    Object.assign(this.label.style, { fontSize: '11px', color: '#8fa8c0' });
    this.root.append(this.label);

    parent.append(this.root);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  show(spotName: string, fullyHiding: boolean): void {
    this.status.textContent = fullyHiding ? 'HIDDEN' : 'PARTIAL COVER';
    this.status.style.color = fullyHiding ? '#9fd0a0' : '#e0c080';
    this.label.textContent = `${spotName} — [E] LEAVE HIDING PLACE`;
    this.tensionLabel.style.display = 'none';
    this.root.hidden = false;
    this.visible = true;
  }

  setTension(tension: number): void {
    if (!this.visible) return;
    if (tension > 0.05) {
      this.tensionLabel.style.display = 'block';
      const pulseSpeed = Math.max(0.3, 1.2 - tension * 0.8);
      this.tensionLabel.style.animation = `pulse ${pulseSpeed}s infinite alternate`;
      this.tensionLabel.style.opacity = `${0.6 + tension * 0.4}`;
      this.root.style.borderColor = tension > 0.6 ? '#ff3333' : '#3a4a5a';
    } else {
      this.tensionLabel.style.display = 'none';
      this.tensionLabel.style.animation = 'none';
      this.root.style.borderColor = '#3a4a5a';
    }
  }

  hide(): void {
    if (!this.visible) return;
    this.root.hidden = true;
    this.visible = false;
    this.tensionLabel.style.display = 'none';
    this.root.style.borderColor = '#3a4a5a';
  }

  dispose(): void {
    this.root.remove();
  }
}
