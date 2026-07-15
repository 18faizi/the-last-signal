/**
 * Typed, sanitized-by-construction document content model.
 *
 * Documents are structured data rendered through `createElement` — never
 * raw HTML — so arbitrary markup cannot enter the DOM. Future image
 * attachments are modeled as a placeholder block kind now so the reader
 * layout can already account for them.
 */
export type DocumentBlock =
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'heading'; readonly text: string }
  | { readonly kind: 'list'; readonly items: readonly string[] }
  | { readonly kind: 'mono'; readonly lines: readonly string[] }
  | { readonly kind: 'image-placeholder'; readonly caption: string };

export interface DocumentDefinition {
  readonly id: string;
  readonly title: string;
  readonly date?: string;
  readonly author?: string;
  readonly blocks: readonly DocumentBlock[];
}

/** Returns human-readable problems; empty array means valid. */
export function validateDocumentDefinition(definition: DocumentDefinition): string[] {
  const problems: string[] = [];
  if (definition.id.trim() === '') {
    problems.push('Document id must not be empty');
  }
  if (definition.title.trim() === '') {
    problems.push(`Document '${definition.id}' has an empty title`);
  }
  if (definition.blocks.length === 0) {
    problems.push(`Document '${definition.id}' has no content blocks`);
  }
  for (const [index, block] of definition.blocks.entries()) {
    switch (block.kind) {
      case 'paragraph':
      case 'heading':
        if (block.text.trim() === '') {
          problems.push(`Document '${definition.id}' block ${index} has empty text`);
        }
        break;
      case 'list':
        if (block.items.length === 0) {
          problems.push(`Document '${definition.id}' block ${index} has an empty list`);
        }
        break;
      case 'mono':
        if (block.lines.length === 0) {
          problems.push(`Document '${definition.id}' block ${index} has no mono lines`);
        }
        break;
      case 'image-placeholder':
        if (block.caption.trim() === '') {
          problems.push(`Document '${definition.id}' block ${index} placeholder needs a caption`);
        }
        break;
    }
  }
  return problems;
}
