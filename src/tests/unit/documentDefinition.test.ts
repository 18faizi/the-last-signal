import { describe, expect, it } from 'vitest';
import {
  validateDocumentDefinition,
  type DocumentDefinition,
} from '../../game/interaction/documents/DocumentDefinition';
import { DocumentRegistry } from '../../game/interaction/documents/DocumentRegistry';
import { DEV_DOCUMENTS } from '../../scenes/interaction-test/testTargets/documentTargets';

const VALID: DocumentDefinition = {
  id: 'doc-test',
  title: 'TEST DOCUMENT',
  blocks: [{ kind: 'paragraph', text: 'Hello.' }],
};

describe('validateDocumentDefinition', () => {
  it('accepts a valid definition and both dev documents', () => {
    expect(validateDocumentDefinition(VALID)).toEqual([]);
    for (const definition of DEV_DOCUMENTS) {
      expect(validateDocumentDefinition(definition)).toEqual([]);
    }
  });

  it('rejects empty ids, titles and block lists', () => {
    expect(validateDocumentDefinition({ ...VALID, id: ' ' })).not.toEqual([]);
    expect(validateDocumentDefinition({ ...VALID, title: '' })).not.toEqual([]);
    expect(validateDocumentDefinition({ ...VALID, blocks: [] })).not.toEqual([]);
  });

  it('rejects empty block content', () => {
    expect(
      validateDocumentDefinition({ ...VALID, blocks: [{ kind: 'paragraph', text: ' ' }] }),
    ).not.toEqual([]);
    expect(
      validateDocumentDefinition({ ...VALID, blocks: [{ kind: 'list', items: [] }] }),
    ).not.toEqual([]);
    expect(
      validateDocumentDefinition({ ...VALID, blocks: [{ kind: 'mono', lines: [] }] }),
    ).not.toEqual([]);
  });

  it('word counts of the dev documents match the milestone brief', () => {
    const words = (definition: DocumentDefinition): number =>
      definition.blocks
        .flatMap((block) =>
          block.kind === 'paragraph' || block.kind === 'heading'
            ? [block.text]
            : block.kind === 'list'
              ? block.items
              : block.kind === 'mono'
                ? block.lines
                : [],
        )
        .join(' ')
        .split(/\s+/)
        .filter(Boolean).length;
    const note = DEV_DOCUMENTS.find((d) => d.id === 'doc-maintenance-note');
    const log = DEV_DOCUMENTS.find((d) => d.id === 'doc-shift-log');
    expect(note).toBeDefined();
    expect(log).toBeDefined();
    expect(words(note as DocumentDefinition)).toBeGreaterThanOrEqual(100);
    expect(words(note as DocumentDefinition)).toBeLessThanOrEqual(180);
    expect(words(log as DocumentDefinition)).toBeGreaterThanOrEqual(350);
    expect(words(log as DocumentDefinition)).toBeLessThanOrEqual(600);
  });
});

describe('DocumentRegistry', () => {
  it('registers and retrieves documents', () => {
    const registry = new DocumentRegistry();
    registry.register(VALID);
    expect(registry.get('doc-test')?.title).toBe('TEST DOCUMENT');
  });

  it('rejects invalid and duplicate documents', () => {
    const registry = new DocumentRegistry();
    registry.register(VALID);
    expect(() => registry.register(VALID)).toThrow(/already registered/);
    expect(() => registry.register({ ...VALID, id: 'bad', blocks: [] })).toThrow(/Invalid/);
  });
});
