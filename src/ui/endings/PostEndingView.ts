/**
 * Milestone 1.0 — Post-Ending Summary View.
 *
 * Debriefing card presenting final narrative statistics, mission duration,
 * and choices to restart or continue exploring facility.
 */

import type { EndingPathway } from '../../game/flow/GameChapter';
import { DECISION_OPTIONS } from '../../game/decision/FinalDecisionController';

export interface PostEndingStats {
  readonly pathway: EndingPathway;
  readonly elapsedSeconds: number;
  readonly discoveredFactsCount: number;
  readonly totalFactsCount: number;
  readonly readDocumentsCount: number;
  readonly totalDocumentsCount: number;
  readonly checkpointsCount: number;
  readonly totalCheckpointsCount: number;
}

export interface PostEndingCallbacks {
  readonly onRestart: () => void;
  readonly onContinueExploring: () => void;
}

export class PostEndingView {
  private readonly root: HTMLElement;
  private keydownHandler?: (e: KeyboardEvent) => void;

  constructor(
    parent: HTMLElement,
    private readonly stats: PostEndingStats,
    private readonly callbacks: PostEndingCallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'post-ending-summary';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Mission Summary');
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(5, 8, 12, 0.95)',
      backdropFilter: 'blur(10px)',
      color: '#e2ebf5',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '32px',
      zIndex: '9960',
      userSelect: 'none',
    });

    const option = DECISION_OPTIONS[stats.pathway];
    const mins = Math.floor(stats.elapsedSeconds / 60);
    const secs = Math.floor(stats.elapsedSeconds % 60);
    const timeFormatted = `${mins}m ${secs.toString().padStart(2, '0')}s`;

    const card = document.createElement('div');
    Object.assign(card.style, {
      width: '100%',
      maxWidth: '560px',
      background: 'rgba(16, 24, 34, 0.95)',
      border: '1px solid rgba(80, 110, 145, 0.4)',
      borderRadius: '6px',
      padding: '32px',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    });

    card.innerHTML = `
      <div>
        <div style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #64b5f6; font-weight: 600; margin-bottom: 6px;">
          MISSION AUDIT DEBRIEFING
        </div>
        <div style="font-size: 22px; font-weight: 700; color: #ffffff;">
          THE LAST SIGNAL
        </div>
      </div>

      <div style="padding: 14px 18px; background: rgba(25, 38, 54, 0.6); border-left: 4px solid #64b5f6; border-radius: 3px;">
        <div style="font-size: 12px; color: #90caf9; font-weight: 600;">
          AUTHORIZED DIRECTIVE: PROTOCOL ${stats.pathway} — ${option.code}
        </div>
        <div style="font-size: 16px; font-weight: 600; color: #ffffff; margin-top: 2px;">
          ${option.title}
        </div>
        <div style="font-size: 12px; color: #b0bec5; margin-top: 6px; line-height: 1.4;">
          ${option.narrativeConsequence}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
        <div style="background: rgba(12, 18, 26, 0.6); padding: 10px 14px; border-radius: 4px;">
          <div style="font-size: 11px; color: #78909c;">ELAPSED TIME</div>
          <div style="font-size: 15px; font-weight: 600; color: #e2ebf5; margin-top: 2px;">${timeFormatted}</div>
        </div>
        <div style="background: rgba(12, 18, 26, 0.6); padding: 10px 14px; border-radius: 4px;">
          <div style="font-size: 11px; color: #78909c;">NARRATIVE FACTS</div>
          <div style="font-size: 15px; font-weight: 600; color: #e2ebf5; margin-top: 2px;">${stats.discoveredFactsCount} / ${stats.totalFactsCount}</div>
        </div>
        <div style="background: rgba(12, 18, 26, 0.6); padding: 10px 14px; border-radius: 4px;">
          <div style="font-size: 11px; color: #78909c;">FACILITY DOCUMENTS</div>
          <div style="font-size: 15px; font-weight: 600; color: #e2ebf5; margin-top: 2px;">${stats.readDocumentsCount} / ${stats.totalDocumentsCount}</div>
        </div>
        <div style="background: rgba(12, 18, 26, 0.6); padding: 10px 14px; border-radius: 4px;">
          <div style="font-size: 11px; color: #78909c;">CHECKPOINTS REACHED</div>
          <div style="font-size: 15px; font-weight: 600; color: #e2ebf5; margin-top: 2px;">${stats.checkpointsCount} / ${stats.totalCheckpointsCount}</div>
        </div>
      </div>

      <div style="display: flex; gap: 14px; margin-top: 8px;">
        <button id="btn-restart-game" style="
          flex: 1; padding: 12px; background: #1976d2; color: #ffffff; border: none;
          border-radius: 4px; font-weight: 600; font-size: 13px; cursor: pointer;
          transition: background 0.15s ease;
        ">
          [R] RESTART FROM BEGINNING
        </button>
        <button id="btn-continue-exploring" style="
          flex: 1; padding: 12px; background: rgba(50, 65, 85, 0.7); color: #cfd8dc;
          border: 1px solid #455a64; border-radius: 4px; font-weight: 600; font-size: 13px;
          cursor: pointer; transition: background 0.15s ease;
        ">
          [C] CONTINUE EXPLORING
        </button>
      </div>
    `;

    card
      .querySelector('#btn-restart-game')
      ?.addEventListener('click', () => this.callbacks.onRestart());
    card
      .querySelector('#btn-continue-exploring')
      ?.addEventListener('click', () => this.callbacks.onContinueExploring());

    this.root.appendChild(card);
    parent.appendChild(this.root);

    this.setupListeners();
  }

  private setupListeners(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') {
        e.preventDefault();
        this.callbacks.onRestart();
      } else if (e.code === 'KeyC' || e.code === 'Escape') {
        e.preventDefault();
        this.callbacks.onContinueExploring();
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  public dispose(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
    }
    this.root.remove();
  }
}
