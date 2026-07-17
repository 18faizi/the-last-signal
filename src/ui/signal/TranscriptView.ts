/**
 * Decoded-transmission transcript viewer.
 *
 * Reuses the M0.3 typed document rendering model (DocumentDefinition +
 * DocumentReaderView's renderDocumentBlock) rather than a bespoke text
 * renderer — per the milestone spec's "reuse the existing typed document
 * rendering model where practical". Deliberately does NOT reuse
 * DocumentController: that class acquires its own input lock and resumes
 * gameplay on close, whereas this view lives INSIDE the already-open
 * receiver panel — closing it must return to the receiver panel, not to
 * gameplay, so ReceiverPanelSession's single 'receiver' input lock stays
 * held for the whole panel lifetime and this view only toggles visibility.
 */
import type { Disposable } from '../../app/lifecycle/Disposable';
import type { DocumentDefinition } from '../../game/interaction/documents/DocumentDefinition';
import { renderDocumentBlock } from '../interaction/DocumentReaderView';

export class TranscriptView implements Disposable {
  private readonly root: HTMLElement;
  private readonly article: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private openFlag = false;

  constructor(parent: HTMLElement, onClose: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'receiver-transcript';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.hidden = true;

    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'receiver-transcript-close';
    this.closeButton.textContent = 'BACK TO RECEIVER [ESC]';
    this.closeButton.addEventListener('click', () => onClose());

    this.article = document.createElement('article');
    this.article.className = 'receiver-transcript-article';

    this.root.append(this.closeButton, this.article);
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return this.openFlag;
  }

  open(definition: DocumentDefinition): void {
    this.openFlag = true;
    const header = document.createElement('header');
    const title = document.createElement('h2');
    title.textContent = definition.title;
    header.append(title);
    if (definition.date !== undefined || definition.author !== undefined) {
      const meta = document.createElement('p');
      meta.className = 'receiver-transcript-meta';
      meta.textContent = [definition.date, definition.author].filter(Boolean).join(' · ');
      header.append(meta);
    }
    const blocks = definition.blocks.map((b) => renderDocumentBlock(b));
    this.article.replaceChildren(header, ...blocks);
    this.root.hidden = false;
    this.closeButton.focus();
  }

  close(): void {
    this.openFlag = false;
    this.root.hidden = true;
    this.article.replaceChildren();
  }

  dispose(): void {
    this.root.remove();
  }
}
