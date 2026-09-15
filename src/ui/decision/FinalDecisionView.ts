/**
 * Milestone 1.0 — Final Decision Terminal View.
 *
 * Full-screen atmospheric terminal interface for executing the final station protocol.
 * Features 2-step confirmation, requirement indicators, and phosphor terminal styling.
 */

import { type FinalDecisionController } from '../../game/decision/FinalDecisionController';
import type { EndingPathway } from '../../game/flow/GameChapter';

export interface FinalDecisionViewCallbacks {
  readonly onConfirmed: (pathway: EndingPathway) => void;
  readonly onClose: () => void;
}

export class FinalDecisionView {
  private readonly root: HTMLElement;
  private readonly contentContainer: HTMLElement;
  private readonly promptContainer: HTMLElement;
  private keydownHandler?: (e: KeyboardEvent) => void;

  constructor(
    parentElement: HTMLElement,
    private readonly controller: FinalDecisionController,
    private readonly callbacks: FinalDecisionViewCallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'final-decision-terminal';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Station Command Terminal');
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      background:
        'radial-gradient(ellipse at center, rgba(14, 22, 28, 0.96) 0%, rgba(6, 10, 14, 0.99) 100%)',
      color: '#e0f0ea',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: '9900',
      padding: '32px',
      userSelect: 'none',
    });

    // CRT Scanline Overlay
    const scanlines = document.createElement('div');
    Object.assign(scanlines.style, {
      position: 'absolute',
      inset: '0',
      background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)',
      backgroundSize: '100% 4px',
      pointerEvents: 'none',
      opacity: '0.4',
    });
    this.root.appendChild(scanlines);

    // Terminal Box
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'relative',
      width: '100%',
      maxWidth: '780px',
      border: '1px solid #4a756a',
      borderRadius: '4px',
      background: 'rgba(10, 18, 20, 0.95)',
      boxShadow: '0 0 30px rgba(45, 125, 95, 0.25)',
      padding: '24px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
    });
    this.root.appendChild(box);

    // Terminal Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      borderBottom: '1px solid #33594e',
      paddingBottom: '12px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    });
    header.innerHTML = `
      <div style="font-size: 14px; font-weight: bold; letter-spacing: 2px; color: #6be3b5;">
        STATION ECHO — CENTRAL COMMAND TERMINAL
      </div>
      <div style="font-size: 11px; color: #78a395;">
        LEVEL 4 CLEARANCE — PROTOCOL DIRECTIVE
      </div>
    `;
    box.appendChild(header);

    // Content container
    this.contentContainer = document.createElement('div');
    box.appendChild(this.contentContainer);

    // Prompt footer
    this.promptContainer = document.createElement('div');
    Object.assign(this.promptContainer.style, {
      borderTop: '1px solid #33594e',
      paddingTop: '12px',
      fontSize: '12px',
      color: '#78a395',
      display: 'flex',
      justifyContent: 'space-between',
    });
    box.appendChild(this.promptContainer);

    parentElement.appendChild(this.root);
    this.setupListeners();
    this.render();
  }

  private setupListeners(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      const selected = this.controller.getSelectedPathway();
      if (selected) {
        // Confirmation mode
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          this.confirm();
        } else if (e.code === 'Escape' || e.code === 'Backspace') {
          e.preventDefault();
          this.controller.cancelSelection();
          this.render();
        }
      } else {
        // Option selection mode
        if (e.code === 'Digit1' || e.code === 'Numpad1') {
          this.selectPathway('SILENCE');
        } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
          this.selectPathway('RESPONSE');
        } else if (e.code === 'Digit3' || e.code === 'Numpad3') {
          this.selectPathway('ARCHIVE');
        } else if (e.code === 'Escape') {
          this.callbacks.onClose();
        }
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  private selectPathway(pathway: EndingPathway): void {
    const success = this.controller.selectPathway(pathway);
    if (success) {
      this.render();
    }
  }

  private confirm(): void {
    const pathway = this.controller.confirmSelectedPathway();
    if (pathway) {
      this.callbacks.onConfirmed(pathway);
    }
  }

  public render(): void {
    const selected = this.controller.getSelectedPathway();
    this.contentContainer.innerHTML = '';

    if (selected) {
      // 2-step Confirmation View
      const option = this.controller.getOption(selected);

      const confirmBox = document.createElement('div');
      confirmBox.className = 'decision-confirm-prompt';
      Object.assign(confirmBox.style, {
        padding: '16px',
        border: '1px solid #e09f3e',
        background: 'rgba(40, 30, 10, 0.4)',
        borderRadius: '3px',
      });

      confirmBox.innerHTML = `
        <div style="color: #e09f3e; font-weight: bold; font-size: 14px; margin-bottom: 8px;">
          CONFIRMATION REQUIRED: ${option.code} — ${option.title}
        </div>
        <p style="font-size: 13px; line-height: 1.5; color: #e0e8e4; margin-bottom: 12px;">
          ${option.summary}
        </p>
        <p style="font-size: 12px; color: #a4c2b8; font-style: italic; margin-bottom: 16px;">
          Consequence: ${option.narrativeConsequence}
        </p>
        <div style="display: flex; gap: 12px;">
          <button id="btn-confirm-pathway" style="
            background: #2e6b52; color: #ffffff; border: 1px solid #4eb88d;
            padding: 8px 18px; font-family: inherit; font-size: 12px; cursor: pointer;
            border-radius: 3px; font-weight: bold;
          ">
            [ENTER] CONFIRM AUTHORIZATION
          </button>
          <button id="btn-cancel-pathway" style="
            background: rgba(40, 50, 60, 0.6); color: #cbd5e1; border: 1px solid #5a6e82;
            padding: 8px 16px; font-family: inherit; font-size: 12px; cursor: pointer;
            border-radius: 3px;
          ">
            [ESC] CANCEL & RETURN
          </button>
        </div>
      `;

      confirmBox
        .querySelector('#btn-confirm-pathway')
        ?.addEventListener('click', () => this.confirm());
      confirmBox.querySelector('#btn-cancel-pathway')?.addEventListener('click', () => {
        this.controller.cancelSelection();
        this.render();
      });

      this.contentContainer.appendChild(confirmBox);
      this.promptContainer.innerHTML = `
        <span>Press [ENTER] to confirm or [ESC] to return.</span>
        <span>STATUS: PENDING AUTHORIZATION</span>
      `;
    } else {
      // List of Options View
      const list = document.createElement('div');
      Object.assign(list.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      });

      const pathways: EndingPathway[] = ['SILENCE', 'RESPONSE', 'ARCHIVE'];
      pathways.forEach((pathway, index) => {
        const option = this.controller.getOption(pathway);
        const prereq = this.controller.checkPrerequisites(pathway);

        const card = document.createElement('div');
        card.id = `decision-card-${pathway.toLowerCase()}`;
        card.setAttribute('data-pathway', pathway);
        Object.assign(card.style, {
          padding: '14px 18px',
          border: prereq.available ? '1px solid #3d6a5c' : '1px solid #2f3e3a',
          background: prereq.available ? 'rgba(18, 32, 28, 0.75)' : 'rgba(12, 18, 16, 0.6)',
          opacity: prereq.available ? '1' : '0.6',
          borderRadius: '3px',
          cursor: prereq.available ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s ease',
        });

        if (prereq.available) {
          card.addEventListener('mouseenter', () => {
            card.style.borderColor = '#6be3b5';
            card.style.background = 'rgba(25, 45, 38, 0.9)';
          });
          card.addEventListener('mouseleave', () => {
            card.style.borderColor = '#3d6a5c';
            card.style.background = 'rgba(18, 32, 28, 0.75)';
          });
          card.addEventListener('click', () => this.selectPathway(pathway));
        }

        const prereqNotice = prereq.available
          ? `<span style="color: #6be3b5; font-weight: bold;">[READY]</span>`
          : `<span style="color: #d97762;">[LOCKED — MISSING REQUIREMENTS]</span>`;

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="font-size: 13px; font-weight: bold; color: ${prereq.available ? '#a7f3d0' : '#8fa8a0'};">
              [${index + 1}] ${option.code}: ${option.title}
            </div>
            <div style="font-size: 11px;">
              ${prereqNotice}
            </div>
          </div>
          <div style="font-size: 12px; color: #a4c2b8; line-height: 1.4;">
            ${option.summary}
          </div>
          ${
            !prereq.available && prereq.missingPrerequisites.length > 0
              ? `<div style="font-size: 11px; color: #e28774; margin-top: 6px;">
                   Prerequisites needed: ${prereq.missingPrerequisites.join('; ')}
                 </div>`
              : ''
          }
        `;

        list.appendChild(card);
      });

      this.contentContainer.appendChild(list);
      this.promptContainer.innerHTML = `
        <span>Press [1], [2], or [3] to select directive. [ESC] to abort.</span>
        <span>AWAITING INPUT</span>
      `;
    }
  }

  public dispose(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
    }
    this.root.remove();
  }
}
