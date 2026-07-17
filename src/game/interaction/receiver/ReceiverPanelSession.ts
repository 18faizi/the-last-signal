/**
 * Receiver overlay session: the Babylon/DOM-facing glue between
 * ReceiverController (game/receiver/, no Babylon/DOM) and the DOM
 * ReceiverPanelView, plus player input suspension. Mirrors
 * PowerPanelSession.ts's split exactly: this class owns the input lock and
 * pointer-lock release; the view's close() call happens here, never inside
 * the view itself, so escape/click handlers never re-enter. Implements
 * InteractionSystem's ReceiverPanelControls contract.
 */
import type { Disposable } from '../../../app/lifecycle/Disposable';
import type { ReceiverController } from '../../receiver/ReceiverController';
import type { ReceiverPanelView } from '../../../ui/signal/ReceiverPanelView';
import type { FirstPersonController } from '../../player/FirstPersonController';
import type { InputLockToken } from '../../player/InputLock';
import type { ReceiverPanelControls } from '../InteractionSystem';

export class ReceiverPanelSession implements ReceiverPanelControls, Disposable {
  private lockToken: InputLockToken | null = null;
  private onClosed: (() => void) | null = null;

  constructor(
    private readonly controller: ReceiverController,
    private readonly view: ReceiverPanelView,
    private readonly player: FirstPersonController,
    private readonly canvas: HTMLCanvasElement,
  ) {}

  get isOpen(): boolean {
    return this.view.isOpen;
  }

  open(onClosed: () => void): boolean {
    if (this.isOpen) return false;
    if (!this.controller.open()) return false;
    this.onClosed = onClosed;
    this.lockToken = this.player.acquireInputLock('receiver');
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
    this.controller.close();
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
