import type { Disposable } from '../../app/lifecycle/Disposable';
import type {
  DocumentBlock,
  DocumentDefinition,
} from '../../game/interaction/documents/DocumentDefinition';

/**
 * Modal document reader.
 *
 * Renders the typed content model exclusively through `createElement`, so
 * no unsanitized HTML can reach the DOM. Semantic structure (article,
 * headings, lists), keyboard accessible: focus moves into the dialog on
 * open, Escape or the close button exits, focus returns to the canvas.
 * Body text is selectable and the article scrolls for long content.
 */
export class DocumentReaderView implements Disposable {
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly article: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private onClose: (() => void) | null = null;
  private readonly keyListener = (event: KeyboardEvent): void => {
    if (event.code === 'Escape') {
      event.preventDefault();
      this.onClose?.();
    }
  };

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'document-reader';
    this.root.hidden = true;

    this.panel = document.createElement('div');
    this.panel.className = 'document-panel';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-modal', 'true');
    this.panel.tabIndex = -1;

    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'document-close';
    this.closeButton.textContent = 'Close (Esc)';
    this.closeButton.addEventListener('click', () => this.onClose?.());

    this.article = document.createElement('article');
    this.article.className = 'document-article';

    this.panel.append(this.closeButton, this.article);
    this.root.append(this.panel);
    parent.append(this.root);
  }

  open(definition: DocumentDefinition, onClose: () => void): void {
    this.onClose = onClose;
    this.renderDocument(definition);
    this.root.hidden = false;
    this.panel.setAttribute('aria-label', definition.title);
    document.addEventListener('keydown', this.keyListener);
    // Move keyboard focus into the dialog; the article itself scrolls.
    this.closeButton.focus();
    this.article.scrollTop = 0;
  }

  close(returnFocusTo: HTMLElement): void {
    this.root.hidden = true;
    this.onClose = null;
    document.removeEventListener('keydown', this.keyListener);
    this.article.replaceChildren();
    returnFocusTo.focus();
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  /** Test hook: current scroll position of the article. */
  get scrollTop(): number {
    return this.article.scrollTop;
  }

  dispose(): void {
    document.removeEventListener('keydown', this.keyListener);
    this.root.remove();
  }

  private renderDocument(definition: DocumentDefinition): void {
    const header = document.createElement('header');
    const title = document.createElement('h1');
    title.textContent = definition.title;
    header.append(title);
    if (definition.date !== undefined || definition.author !== undefined) {
      const meta = document.createElement('p');
      meta.className = 'document-meta';
      meta.textContent = [definition.date, definition.author].filter(Boolean).join(' · ');
      header.append(meta);
    }
    const blocks = definition.blocks.map((block) => renderBlock(block));
    this.article.replaceChildren(header, ...blocks);
  }
}

function renderBlock(block: DocumentBlock): HTMLElement {
  switch (block.kind) {
    case 'paragraph': {
      const p = document.createElement('p');
      p.textContent = block.text;
      return p;
    }
    case 'heading': {
      const h = document.createElement('h2');
      h.textContent = block.text;
      return h;
    }
    case 'list': {
      const ul = document.createElement('ul');
      for (const item of block.items) {
        const li = document.createElement('li');
        li.textContent = item;
        ul.append(li);
      }
      return ul;
    }
    case 'mono': {
      const pre = document.createElement('pre');
      pre.className = 'document-mono';
      pre.textContent = block.lines.join('\n');
      return pre;
    }
    case 'image-placeholder': {
      const figure = document.createElement('figure');
      figure.className = 'document-image-placeholder';
      const caption = document.createElement('figcaption');
      caption.textContent = `[attachment: ${block.caption}]`;
      figure.append(caption);
      return figure;
    }
  }
}
