/**
 * Milestone 1.0 — Ending Cinematic View.
 *
 * Cinematic in-engine presentation with widescreen letterboxing,
 * typed operational status readouts, and narrative epilogue text.
 */

import { type EndingSequenceController } from '../../game/endings/EndingSequenceController';

export interface EndingCinematicCallbacks {
  readonly onComplete: () => void;
}

export class EndingCinematicView {
  private readonly root: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly epilogueEl: HTMLElement;
  private readonly promptEl: HTMLElement;
  private unsubscribe?: () => void;
  private keydownHandler?: (e: KeyboardEvent) => void;

  constructor(
    parent: HTMLElement,
    private readonly controller: EndingSequenceController,
    private readonly callbacks: EndingCinematicCallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'ending-cinematic-overlay';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Ending Sequence');
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      background: '#04070a',
      color: '#e2ebf5',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '48px 64px',
      zIndex: '9950',
      userSelect: 'none',
      transition: 'opacity 0.8s ease',
    });

    // Top Bar (Letterbox)
    const topBar = document.createElement('div');
    Object.assign(topBar.style, {
      fontSize: '13px',
      letterSpacing: '3px',
      color: '#65829e',
      textTransform: 'uppercase',
    });
    topBar.textContent = 'STATION ECHO // MISSION CONCLUSION';
    this.root.appendChild(topBar);

    // Center Narrative Container
    const center = document.createElement('div');
    Object.assign(center.style, {
      maxWidth: '720px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    });

    this.statusEl = document.createElement('div');
    Object.assign(this.statusEl.style, {
      fontSize: '15px',
      color: '#a4c2e0',
      letterSpacing: '1px',
      lineHeight: '1.6',
    });
    center.appendChild(this.statusEl);

    this.epilogueEl = document.createElement('div');
    Object.assign(this.epilogueEl.style, {
      fontSize: '18px',
      color: '#ffffff',
      lineHeight: '1.8',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontWeight: '300',
    });
    center.appendChild(this.epilogueEl);

    this.root.appendChild(center);

    // Bottom Skip Prompt
    this.promptEl = document.createElement('div');
    Object.assign(this.promptEl.style, {
      fontSize: '11px',
      color: '#556a7d',
      letterSpacing: '1px',
    });
    this.promptEl.textContent = '[SPACE] SKIP TO DEBRIEFING';
    this.root.appendChild(this.promptEl);

    parent.appendChild(this.root);
    this.setupListeners();
  }

  private setupListeners(): void {
    this.unsubscribe = this.controller.subscribe((event) => {
      if (event.phase === 'initiating' || event.phase === 'execution') {
        this.statusEl.textContent = event.text ?? '';
        this.epilogueEl.textContent = '';
      } else if (event.phase === 'epilogue') {
        this.statusEl.textContent = '';
        this.epilogueEl.textContent = event.text ?? '';
      } else if (event.phase === 'completed') {
        this.callbacks.onComplete();
      }
    });

    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.controller.skipToCompletion();
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  public dispose(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
    }
    this.unsubscribe?.();
    this.root.remove();
  }
}
