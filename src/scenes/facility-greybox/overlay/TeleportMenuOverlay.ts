/**
 * Development-only F8 teleport menu overlay for the facility greybox scene.
 *
 * Shows a list of named positions. Clicking a row teleports the player
 * instantly via FirstPersonController.teleportTo().  Closed by pressing F8
 * again, pressing Escape, or by calling hide().
 *
 * DOM is built once and toggled with hidden. No Babylon objects cross this
 * boundary — only the controller reference.
 */
import type { Disposable } from '../../../app/lifecycle/Disposable';
import type { FirstPersonController } from '../../../game/player/FirstPersonController';
import type { TeleportDefinition } from '../../../game/facility/TeleportDefinition';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export class TeleportMenuOverlay implements Disposable {
  private readonly root: HTMLElement;
  private visible = false;
  private readonly onKeyDown: (e: KeyboardEvent) => void;

  constructor(
    parent: HTMLElement,
    teleports: readonly TeleportDefinition[],
    controller: FirstPersonController,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'teleport-menu';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Teleport menu');
    this.root.hidden = true;
    this.applyStyles();

    // Title
    const title = document.createElement('div');
    title.id = 'teleport-menu-title';
    title.textContent = 'DEV TELEPORT — F8 to close';
    Object.assign(title.style, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#aaffaa',
      marginBottom: '8px',
      borderBottom: '1px solid #3a4a3a',
      paddingBottom: '6px',
    });
    this.root.append(title);

    // List
    const list = document.createElement('ul');
    list.style.listStyle = 'none';
    list.style.margin = '0';
    list.style.padding = '0';

    for (const tp of teleports) {
      const item = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = tp.label;
      btn.dataset.teleportId = tp.id;
      Object.assign(btn.style, {
        display: 'block',
        width: '100%',
        background: 'transparent',
        border: 'none',
        color: '#ccddcc',
        fontFamily: 'monospace',
        fontSize: '12px',
        textAlign: 'left',
        padding: '4px 8px',
        cursor: 'pointer',
        borderRadius: '3px',
      });
      btn.addEventListener('mouseover', () => {
        btn.style.background = '#2a3a2a';
        btn.style.color = '#eefcee';
      });
      btn.addEventListener('mouseout', () => {
        btn.style.background = 'transparent';
        btn.style.color = '#ccddcc';
      });
      btn.addEventListener('click', () => {
        const pos = new Vector3(tp.position.x, tp.position.y, tp.position.z);
        controller.teleportTo(pos, tp.yaw);
        this.hide();
      });
      item.append(btn);
      list.append(item);
    }
    this.root.append(list);
    parent.append(this.root);

    // Close on Escape.
    this.onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && this.visible) {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.onKeyDown);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  show(): void {
    this.visible = true;
    this.root.hidden = false;
  }

  hide(): void {
    this.visible = false;
    this.root.hidden = true;
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  dispose(): void {
    document.removeEventListener('keydown', this.onKeyDown);
    this.root.remove();
  }

  private applyStyles(): void {
    Object.assign(this.root.style, {
      position: 'fixed',
      top: '60px',
      right: '16px',
      width: '260px',
      maxHeight: 'calc(100vh - 80px)',
      overflowY: 'auto',
      background: 'rgba(10, 20, 10, 0.92)',
      border: '1px solid #3a5a3a',
      borderRadius: '4px',
      padding: '10px 8px',
      zIndex: '9000',
      boxSizing: 'border-box',
    });
  }
}
