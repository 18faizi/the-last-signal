/**
 * Dynamic Center Crosshair / Reticle for The Last Signal.
 *
 * Renders a minimalist, non-intrusive HUD reticle in the center of the viewport
 * that smoothly highlights when an interactable object is within reach.
 */
import type { Disposable } from '../../app/lifecycle/Disposable';

export class CrosshairReticleView implements Disposable {
  private readonly root: HTMLElement;
  private readonly dot: HTMLElement;
  private isHovered = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'crosshair-reticle';
    this.root.setAttribute('aria-hidden', 'true');
    Object.assign(this.root.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: '16px',
      height: '16px',
      pointerEvents: 'none',
      zIndex: '14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'transform 0.15s ease, opacity 0.15s ease',
    });

    this.dot = document.createElement('div');
    this.dot.className = 'reticle-center-dot';
    Object.assign(this.dot.style, {
      width: '4px',
      height: '4px',
      borderRadius: '50%',
      backgroundColor: 'rgba(230, 240, 255, 0.75)',
      boxShadow: '0 0 4px rgba(255, 255, 255, 0.5)',
      transition: 'background-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
    });

    this.root.appendChild(this.dot);
    parent.appendChild(this.root);
  }

  setInteractableHover(hovered: boolean): void {
    if (this.isHovered === hovered) return;
    this.isHovered = hovered;

    if (hovered) {
      this.dot.style.backgroundColor = '#64b5f6';
      this.dot.style.boxShadow = '0 0 8px #64b5f6';
      this.root.style.transform = 'translate(-50%, -50%) scale(1.4)';
    } else {
      this.dot.style.backgroundColor = 'rgba(230, 240, 255, 0.75)';
      this.dot.style.boxShadow = '0 0 4px rgba(255, 255, 255, 0.5)';
      this.root.style.transform = 'translate(-50%, -50%) scale(1.0)';
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
