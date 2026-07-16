/**
 * Distribution-panel overlay session: the Babylon/DOM-facing glue between
 * the pure DistributionPanelController (game/electrical/, no Babylon/DOM)
 * and the DOM DistributionPanelView, plus player input suspension.
 *
 * Mirrors DocumentController.ts's split exactly: this class owns the input
 * lock and pointer-lock release; the view's close() call happens here, not
 * inside the view itself, so escape/click handlers never re-enter.
 * Implements InteractionSystem's PowerPanelControls contract.
 */
import type { Disposable } from '../../../app/lifecycle/Disposable';
import type { DistributionPanelController } from '../../electrical/DistributionPanelController';
import type { DistributionPanelView } from '../../../ui/power/DistributionPanelView';
import type { FirstPersonController } from '../../player/FirstPersonController';
import type { InputLockToken } from '../../player/InputLock';
import type { PowerPanelControls } from '../InteractionSystem';

export class PowerPanelSession implements PowerPanelControls, Disposable {
  private lockToken: InputLockToken | null = null;
  private onClosed: (() => void) | null = null;

  constructor(
    private readonly panelController: DistributionPanelController,
    private readonly view: DistributionPanelView,
    private readonly player: FirstPersonController,
    private readonly canvas: HTMLCanvasElement,
  ) {}

  get isOpen(): boolean {
    return this.view.isOpen;
  }

  /** `panelId` is accepted for interface symmetry; this session serves one panel. */
  open(_panelId: string, onClosed: () => void): boolean {
    if (this.isOpen) return false;
    this.onClosed = onClosed;
    this.panelController.openPanel();
    this.lockToken = this.player.acquireInputLock('power-panel');
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
    this.panelController.closePanel();
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
