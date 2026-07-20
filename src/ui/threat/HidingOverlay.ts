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
    this.root.hidden = false;
    this.visible = true;
  }

  hide(): void {
    if (!this.visible) return;
    this.root.hidden = true;
    this.visible = false;
  }

  dispose(): void {
    this.root.remove();
  }
}
