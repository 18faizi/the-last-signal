/**
 * Antenna overlay session: the Babylon/DOM-facing glue between
 * AntennaController (game/antenna/, no Babylon/DOM) and the DOM
 * AntennaPanelView, plus player input suspension. Mirrors
 * ReceiverPanelSession.ts's split exactly: this class owns the input lock
 * and pointer-lock release; the view's close() call happens here, never
 * inside the view itself, so escape/click handlers never re-enter.
 * Implements InteractionSystem's AntennaPanelControls contract.
 */
import type { Disposable } from '../../../app/lifecycle/Disposable';
import type { AntennaController } from '../../antenna/AntennaController';
import type { AntennaPanelView } from '../../../ui/antenna/AntennaPanelView';
import type { FirstPersonController } from '../../player/FirstPersonController';
import type { InputLockToken } from '../../player/InputLock';
import type { AntennaPanelControls } from '../InteractionSystem';

export class AntennaPanelSession implements AntennaPanelControls, Disposable {
  private lockToken: InputLockToken | null = null;
  private onClosed: (() => void) | null = null;

  constructor(
    private readonly controller: AntennaController,
    private readonly view: AntennaPanelView,
    private readonly player: FirstPersonController,
    private readonly canvas: HTMLCanvasElement,
  ) {}

  get isOpen(): boolean {
    return this.view.isOpen;
  }

  open(onClosed: () => void): boolean {
    if (this.isOpen) return false;
    if (!this.controller.isPowered) return false;
    this.onClosed = onClosed;
    this.lockToken = this.player.acquireInputLock('antenna-panel');
    this.player.setPointerLockPromptSuppressed(true);
    if (document.pointerLockElement !== null) {
      document.exitPointerLock();
    }
    this.view.open(() => this.close());
    return true;
  }

  close(): void {
    if (!this.isOpen) return;
    this.view.close(this.canvas);
    this.player.setPointerLockPromptSuppressed(false);
    if (this.lockToken !== null) {
      this.player.releaseInputLock(this.lockToken);
      this.lockToken = null;
    }
    const callback = this.onClosed;
    this.onClosed = null;
    callback?.();
  }

  dispose(): void {
    if (this.isOpen) {
      this.close();
    }
  }
}
