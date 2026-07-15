import type { Disposable } from '../../../app/lifecycle/Disposable';
import { GameError } from '../../../core/errors/GameError';
import type { ErrorReporter } from '../../../core/errors/ErrorReporter';
import type { DocumentReaderView } from '../../../ui/interaction/DocumentReaderView';
import type { FirstPersonController } from '../../player/FirstPersonController';
import type { InputLockToken } from '../../player/InputLock';
import type { DocumentRegistry } from './DocumentRegistry';

/**
 * Reading mode.
 *
 * Pointer-lock strategy: reading **releases pointer lock** — the reader
 * needs a free cursor for scrolling, text selection and the close button.
 * The pointer-lock prompt is suppressed while open; on close the player
 * clicks the canvas to re-enter, exactly like the initial entry flow.
 */
export class DocumentController implements Disposable {
  private readonly registry: DocumentRegistry;
  private readonly view: DocumentReaderView;
  private readonly player: FirstPersonController;
  private readonly canvas: HTMLCanvasElement;
  private readonly errorReporter: ErrorReporter;
  private lockToken: InputLockToken | null = null;
  private onClosed: (() => void) | null = null;

  constructor(
    registry: DocumentRegistry,
    view: DocumentReaderView,
    player: FirstPersonController,
    canvas: HTMLCanvasElement,
    errorReporter: ErrorReporter,
  ) {
    this.registry = registry;
    this.view = view;
    this.player = player;
    this.canvas = canvas;
    this.errorReporter = errorReporter;
  }

  get isOpen(): boolean {
    return this.view.isOpen;
  }

  /** Returns false (with a recoverable report) when the document is missing. */
  open(documentId: string, onClosed: () => void): boolean {
    if (this.isOpen) {
      return false;
    }
    const definition = this.registry.get(documentId);
    if (definition === undefined) {
      this.errorReporter.reportRecoverable(
        new GameError('unexpected', `Readable target references unknown document '${documentId}'`),
      );
      return false;
    }
    this.onClosed = onClosed;
    this.lockToken = this.player.acquireInputLock('document');
    this.player.setPointerLockPromptSuppressed(true);
    if (document.pointerLockElement !== null) {
      document.exitPointerLock();
    }
    this.view.open(definition, () => this.close());
    return true;
  }

  close(): void {
    if (!this.isOpen) {
      return;
    }
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
