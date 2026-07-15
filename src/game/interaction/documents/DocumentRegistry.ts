import { validateDocumentDefinition, type DocumentDefinition } from './DocumentDefinition';

/** Typed lookup for readable documents; definitions are validated on register. */
export class DocumentRegistry {
  private readonly documents = new Map<string, DocumentDefinition>();

  register(definition: DocumentDefinition): void {
    const problems = validateDocumentDefinition(definition);
    if (problems.length > 0) {
      throw new Error(`Invalid document '${definition.id}': ${problems.join('; ')}`);
    }
    if (this.documents.has(definition.id)) {
      throw new Error(`Document '${definition.id}' is already registered`);
    }
    this.documents.set(definition.id, definition);
  }

  get(id: string): DocumentDefinition | undefined {
    return this.documents.get(id);
  }

  clear(): void {
    this.documents.clear();
  }
}
