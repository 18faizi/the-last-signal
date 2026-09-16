/**
 * Milestone 1.0 — Game Flow Debug Overlay.
 *
 * Development debug overlay toggled via Ctrl+F1. Displays current chapter,
 * objectives, narrative facts, hint tier, and fast-forward/jump shortcuts.
 */

import { CHAPTER_ORDER, type GameChapterId } from '../../game/flow/GameChapter';
import type { GameFlowState } from '../../game/flow/GameFlowState';
import type { ObjectiveController } from '../../game/objectives/ObjectiveController';
import type { HintController } from '../../game/hints/HintController';
import type { NarrativeFactRegistry } from '../../game/narrative/NarrativeFactRegistry';

export class GameFlowDebugOverlay {
  private readonly root: HTMLElement;
  private readonly contentEl: HTMLElement;
  private isVisible = false;
  private keydownHandler?: (e: KeyboardEvent) => void;
  private updateIntervalId?: number;

  constructor(
    parent: HTMLElement,
    private readonly flowState: GameFlowState,
    private readonly objectiveCtrl: ObjectiveController,
    private readonly hintCtrl: HintController,
    private readonly narrativeRegistry: NarrativeFactRegistry,
    private readonly onJumpChapter?: (chapterId: GameChapterId) => void,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'game-flow-debug-overlay';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Game Flow Debug Panel');
    Object.assign(this.root.style, {
      position: 'fixed',
      bottom: '16px',
      left: '16px',
      width: '380px',
      maxHeight: '400px',
      overflowY: 'auto',
      background: 'rgba(8, 12, 18, 0.94)',
      border: '1px solid #ff9800',
      borderRadius: '4px',
      padding: '12px',
      fontFamily: 'Consolas, monospace',
      fontSize: '11px',
      color: '#ffcc80',
      zIndex: '9995',
      display: 'none',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      fontWeight: 'bold',
      borderBottom: '1px solid #ff9800',
      paddingBottom: '4px',
      marginBottom: '8px',
      display: 'flex',
      justifyContent: 'space-between',
    });
    header.innerHTML = `
      <span>[DEV] GAME FLOW DEBUG</span>
      <span style="color: #bbb;">Ctrl+F1</span>
    `;
    this.root.appendChild(header);

    this.contentEl = document.createElement('div');
    this.root.appendChild(this.contentEl);

    // Chapter jump shortcuts
    const jumpSection = document.createElement('div');
    Object.assign(jumpSection.style, {
      marginTop: '10px',
      borderTop: '1px dashed #7a5020',
      paddingTop: '6px',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px',
    });
    const label = document.createElement('div');
    label.style.width = '100%';
    label.style.color = '#ffa726';
    label.textContent = 'WARP TO CHAPTER:';
    jumpSection.appendChild(label);

    CHAPTER_ORDER.forEach((chId, idx) => {
      const btn = document.createElement('button');
      btn.textContent = `Ch${idx + 1}`;
      Object.assign(btn.style, {
        padding: '2px 6px',
        fontSize: '10px',
        background: '#2b1b08',
        color: '#ffb74d',
        border: '1px solid #ff9800',
        cursor: 'pointer',
        borderRadius: '2px',
      });
      btn.addEventListener('click', () => {
        this.onJumpChapter?.(chId);
        this.update();
      });
      jumpSection.appendChild(btn);
    });

    this.root.appendChild(jumpSection);
    parent.appendChild(this.root);

    this.setupListeners();
  }

  private setupListeners(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.code === 'F1' || e.key === 'F1')) {
        e.preventDefault();
        this.toggle();
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    this.root.style.display = this.isVisible ? 'block' : 'none';
    if (this.isVisible) {
      this.update();
      this.updateIntervalId = window.setInterval(() => this.update(), 500);
    } else if (this.updateIntervalId) {
      window.clearInterval(this.updateIntervalId);
    }
  }

  public update(): void {
    if (!this.isVisible) return;
    const snap = this.flowState.captureSnapshot();
    const activeObj = this.objectiveCtrl.getActiveObjective();
    const facts = this.narrativeRegistry.getDiscoveredFacts();

    this.contentEl.innerHTML = `
      <div><strong>Chapter:</strong> ${this.flowState.currentChapterId}</div>
      <div><strong>Elapsed:</strong> ${this.flowState.elapsedPlaytimeSeconds.toFixed(1)}s</div>
      <div><strong>Objective:</strong> ${activeObj ? activeObj.definition.id : 'None'} (${activeObj?.state ?? 'idle'})</div>
      <div><strong>Hint Tier:</strong> ${this.hintCtrl.getCurrentTier()} (${this.hintCtrl.getElapsedSeconds().toFixed(0)}s idle)</div>
      <div><strong>Unlocked Endings:</strong> ${snap.unlockedEndingIds.join(', ') || 'None'}</div>
      <div><strong>Narrative Facts (${facts.length}/9):</strong></div>
      <div style="color: #ffe0b2; margin-left: 8px; font-size: 10px;">
        ${facts.join(', ') || 'None'}
      </div>
    `;
  }

  public dispose(): void {
    if (this.updateIntervalId) {
      window.clearInterval(this.updateIntervalId);
    }
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
    }
    this.root.remove();
  }
}
