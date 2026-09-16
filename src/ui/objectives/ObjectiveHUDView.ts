/**
 * Milestone 1.0 — Objective HUD View.
 *
 * Minimal, atmospheric on-screen display for current mission objectives.
 * Features auto-reveal on update, manual toggle/recall with 'Q', sub-step checkmarks,
 * and suppression during modal interactions.
 */

import { type ObjectiveController } from '../../game/objectives/ObjectiveController';

export class ObjectiveHUDView {
  private readonly root: HTMLElement;
  private readonly headerEl: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly descEl: HTMLElement;
  private readonly stepsListEl: HTMLElement;
  private readonly recallPromptEl: HTMLElement;

  private unsubscribeController?: () => void;
  private autoHideTimeout?: number;
  private isModalSuppressed = false;
  private isUserToggled = false;
  private keydownHandler?: (e: KeyboardEvent) => void;

  constructor(
    parent: HTMLElement,
    private readonly controller: ObjectiveController,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'objective-hud';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Mission Objectives');
    Object.assign(this.root.style, {
      position: 'fixed',
      top: '24px',
      left: '24px',
      width: '320px',
      maxWidth: 'calc(100vw - 48px)',
      padding: '12px 16px',
      background: 'rgba(10, 14, 20, 0.82)',
      backdropFilter: 'blur(6px)',
      border: '1px solid rgba(70, 95, 125, 0.45)',
      borderLeft: '3px solid #64b5f6',
      borderRadius: '4px',
      boxShadow: '0 4px 18px rgba(0, 0, 0, 0.5)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#e2ebf5',
      zIndex: '8900',
      pointerEvents: 'none',
      transition: 'opacity 0.25s ease, transform 0.25s ease',
      opacity: '0',
      visibility: 'hidden',
      transform: 'translateY(-6px)',
    });

    // Category / Chapter Header
    this.headerEl = document.createElement('div');
    Object.assign(this.headerEl.style, {
      fontSize: '11px',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      color: '#64b5f6',
      fontWeight: '600',
      marginBottom: '4px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    });
    this.root.appendChild(this.headerEl);

    // Title
    this.titleEl = document.createElement('div');
    Object.assign(this.titleEl.style, {
      fontSize: '14px',
      fontWeight: '600',
      color: '#ffffff',
      lineHeight: '1.3',
      marginBottom: '4px',
    });
    this.root.appendChild(this.titleEl);

    // Description
    this.descEl = document.createElement('div');
    Object.assign(this.descEl.style, {
      fontSize: '12px',
      color: '#a0b3c6',
      lineHeight: '1.4',
      marginBottom: '6px',
    });
    this.root.appendChild(this.descEl);

    // Sub-steps list
    this.stepsListEl = document.createElement('div');
    Object.assign(this.stepsListEl.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      marginTop: '4px',
    });
    this.root.appendChild(this.stepsListEl);

    // Recall Prompt hint
    this.recallPromptEl = document.createElement('div');
    Object.assign(this.recallPromptEl.style, {
      marginTop: '8px',
      fontSize: '10px',
      color: '#5b738c',
      letterSpacing: '0.5px',
    });
    this.recallPromptEl.textContent = '[Q] TOGGLE OBJECTIVES';
    this.root.appendChild(this.recallPromptEl);

    parent.appendChild(this.root);

    this.setupListeners();
    this.update();
  }

  private setupListeners(): void {
    this.unsubscribeController = this.controller.subscribe((event) => {
      this.update();
      // Auto-reveal on any change
      if (
        event.type === 'activated' ||
        event.type === 'completed' ||
        event.type === 'stepCompleted'
      ) {
        this.flashReveal();
      }
    });

    this.keydownHandler = (e: KeyboardEvent) => {
      // Toggle on 'KeyQ' when not typing in an input
      if (
        e.code === 'KeyQ' &&
        !e.repeat &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        this.toggleManual();
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  public setModalSuppressed(suppressed: boolean): void {
    this.isModalSuppressed = suppressed;
    this.applyVisibility();
  }

  public toggleManual(): void {
    this.isUserToggled = !this.isUserToggled;
    this.applyVisibility();
  }

  public flashReveal(durationMs: number = 6000): void {
    if (this.autoHideTimeout) {
      window.clearTimeout(this.autoHideTimeout);
    }
    this.isUserToggled = true;
    this.applyVisibility();

    this.autoHideTimeout = window.setTimeout(() => {
      this.isUserToggled = false;
      this.applyVisibility();
    }, durationMs);
  }

  private applyVisibility(): void {
    const active = this.controller.getActiveObjective();
    if (this.isModalSuppressed || !active) {
      this.root.style.opacity = '0';
      this.root.style.visibility = 'hidden';
      this.root.style.transform = 'translateY(-6px)';
      return;
    }

    if (this.isUserToggled) {
      this.root.style.opacity = '1';
      this.root.style.visibility = 'visible';
      this.root.style.transform = 'translateY(0)';
    } else {
      this.root.style.opacity = '0';
      this.root.style.visibility = 'hidden';
      this.root.style.transform = 'translateY(-6px)';
    }
  }

  public update(): void {
    const active = this.controller.getActiveObjective();
    if (!active) {
      this.root.style.opacity = '0';
      this.root.style.visibility = 'hidden';
      return;
    }

    const { definition, steps } = active;
    this.headerEl.textContent = `${definition.category} OBJECTIVE`;
    this.titleEl.textContent = definition.title;
    this.descEl.textContent = definition.description;

    // Clear and build steps
    this.stepsListEl.innerHTML = '';
    if (steps && steps.length > 0) {
      for (const step of steps) {
        const row = document.createElement('div');
        Object.assign(row.style, {
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          color: step.completed ? '#76d275' : '#c2d1e0',
          textDecoration: step.completed ? 'line-through' : 'none',
        });

        const icon = document.createElement('span');
        icon.textContent = step.completed ? '✓' : '○';
        icon.style.fontWeight = 'bold';
        row.appendChild(icon);

        const text = document.createElement('span');
        text.textContent = step.description;
        row.appendChild(text);

        this.stepsListEl.appendChild(row);
      }
    }

    this.applyVisibility();
  }

  public dispose(): void {
    if (this.autoHideTimeout) {
      window.clearTimeout(this.autoHideTimeout);
    }
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
    }
    this.unsubscribeController?.();
    this.root.remove();
  }
}
