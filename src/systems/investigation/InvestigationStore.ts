/**
 * Investigation Store (Milestone 1.3).
 *
 * Reactive state store managing discovered documents, environmental clues,
 * multi-clue evidence chains, telemetry frequencies, and door access codes.
 * Serializes cleanly into the M1.2 save snapshot format.
 */

import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
  StructuredDocument,
  InvestigationClue,
  ClueChainDefinition,
  InvestigationEvent,
  InvestigationSnapshot,
} from './types';
import { STRUCTURED_DOCUMENTS, INVESTIGATION_CLUES, CLUE_CHAINS } from './clueDefinitions';

export interface InvestigationInternalState {
  readonly discoveredDocumentIds: readonly string[];
  readonly discoveredClueIds: readonly string[];
  readonly completedChainIds: readonly string[];
  readonly highlightedClueIds: readonly string[];
  readonly unlockedFrequencies: readonly number[];
  readonly unlockedDoorCodes: readonly string[];
}

export type InvestigationStoreApi = StoreApi<InvestigationInternalState>;

export class InvestigationStore {
  private readonly store: InvestigationStoreApi;
  private readonly documents = new Map<string, StructuredDocument>();
  private readonly clues = new Map<string, InvestigationClue>();
  private readonly chains = new Map<string, ClueChainDefinition>();
  private readonly eventListeners = new Set<(event: InvestigationEvent) => void>();

  constructor(options?: {
    documents?: readonly StructuredDocument[];
    clues?: readonly InvestigationClue[];
    chains?: readonly ClueChainDefinition[];
  }) {
    this.store = createStore<InvestigationInternalState>()(() => ({
      discoveredDocumentIds: [],
      discoveredClueIds: [],
      completedChainIds: [],
      highlightedClueIds: [],
      unlockedFrequencies: [],
      unlockedDoorCodes: [],
    }));

    // Register catalog definitions
    const docs = options?.documents ?? STRUCTURED_DOCUMENTS;
    for (const doc of docs) {
      this.documents.set(doc.id, doc);
    }
    const clues = options?.clues ?? INVESTIGATION_CLUES;
    for (const clue of clues) {
      this.clues.set(clue.id, clue);
    }
    const chains = options?.chains ?? CLUE_CHAINS;
    for (const chain of chains) {
      this.chains.set(chain.id, chain);
    }
  }

  // ----- Registration --------------------------------------------------------

  public registerDocument(doc: StructuredDocument): void {
    this.documents.set(doc.id, doc);
  }

  public registerClue(clue: InvestigationClue): void {
    this.clues.set(clue.id, clue);
  }

  public registerChain(chain: ClueChainDefinition): void {
    this.chains.set(chain.id, chain);
  }

  // ----- Queries -------------------------------------------------------------

  public getDocument(id: string): StructuredDocument | undefined {
    return this.documents.get(id);
  }

  public getClue(id: string): InvestigationClue | undefined {
    return this.clues.get(id);
  }

  public getChain(id: string): ClueChainDefinition | undefined {
    return this.chains.get(id);
  }

  public getAllDocuments(): readonly StructuredDocument[] {
    return Array.from(this.documents.values());
  }

  public getAllClues(): readonly InvestigationClue[] {
    return Array.from(this.clues.values());
  }

  public getAllChains(): readonly ClueChainDefinition[] {
    return Array.from(this.chains.values());
  }

  public isDocumentDiscovered(id: string): boolean {
    return this.store.getState().discoveredDocumentIds.includes(id);
  }

  public isClueDiscovered(id: string): boolean {
    return this.store.getState().discoveredClueIds.includes(id);
  }

  public isChainCompleted(id: string): boolean {
    return this.store.getState().completedChainIds.includes(id);
  }

  public isClueHighlighted(id: string): boolean {
    return this.store.getState().highlightedClueIds.includes(id);
  }

  public getDiscoveredDocuments(): readonly StructuredDocument[] {
    const discoveredIds = new Set(this.store.getState().discoveredDocumentIds);
    return Array.from(this.documents.values()).filter((d) => discoveredIds.has(d.id));
  }

  public getDiscoveredClues(): readonly InvestigationClue[] {
    const discoveredIds = new Set(this.store.getState().discoveredClueIds);
    return Array.from(this.clues.values()).filter((c) => discoveredIds.has(c.id));
  }

  public getCompletedChains(): readonly ClueChainDefinition[] {
    const completedIds = new Set(this.store.getState().completedChainIds);
    return Array.from(this.chains.values()).filter((ch) => completedIds.has(ch.id));
  }

  public getUnlockedFrequencies(): readonly number[] {
    return this.store.getState().unlockedFrequencies;
  }

  public getUnlockedDoorCodes(): readonly string[] {
    return this.store.getState().unlockedDoorCodes;
  }

  // ----- Mutations & Discovery ------------------------------------------------

  public discoverDocument(docId: string): boolean {
    const doc = this.documents.get(docId);
    if (!doc) return false;

    const state = this.store.getState();
    const isNew = !state.discoveredDocumentIds.includes(docId);

    if (isNew) {
      const nextDocs = [...state.discoveredDocumentIds, docId];
      const nextFreqs = new Set(state.unlockedFrequencies);
      const nextCodes = new Set(state.unlockedDoorCodes);

      if (doc.unlocksSignalFrequency !== undefined) {
        nextFreqs.add(doc.unlocksSignalFrequency);
      }
      if (doc.unlocksDoorCode !== undefined) {
        nextCodes.add(doc.unlocksDoorCode);
      }

      this.store.setState({
        discoveredDocumentIds: nextDocs,
        unlockedFrequencies: Array.from(nextFreqs),
        unlockedDoorCodes: Array.from(nextCodes),
      });

      // Automatically discover associated clues
      if (doc.associatedClueIds) {
        for (const clueId of doc.associatedClueIds) {
          this.discoverClue(clueId);
        }
      }
    }

    return isNew;
  }

  public discoverClue(clueId: string): boolean {
    const clue = this.clues.get(clueId);
    if (!clue) return false;

    const state = this.store.getState();
    const isNew = !state.discoveredClueIds.includes(clueId);

    if (isNew) {
      const nextClues = [...state.discoveredClueIds, clueId];
      const nextFreqs = new Set(state.unlockedFrequencies);
      const nextCodes = new Set(state.unlockedDoorCodes);

      if (clue.unlocksSignalFrequency !== undefined) {
        nextFreqs.add(clue.unlocksSignalFrequency);
      }
      if (clue.unlocksDoorCode !== undefined) {
        nextCodes.add(clue.unlocksDoorCode);
      }

      this.store.setState({
        discoveredClueIds: nextClues,
        unlockedFrequencies: Array.from(nextFreqs),
        unlockedDoorCodes: Array.from(nextCodes),
      });

      this.notifyEvent({
        kind: 'clue-discovered',
        clue,
        isNewlyDiscovered: true,
        timestamp: Date.now(),
      });

      // Evaluate whether any multi-clue chains can now be completed
      this.evaluateChains();
    }

    return isNew;
  }

  public highlightClue(clueId: string, highlighted = true): void {
    const state = this.store.getState();
    const current = new Set(state.highlightedClueIds);
    if (highlighted) {
      current.add(clueId);
    } else {
      current.delete(clueId);
    }
    this.store.setState({ highlightedClueIds: Array.from(current) });
  }

  public evaluateChains(): readonly ClueChainDefinition[] {
    const state = this.store.getState();
    const discoveredClueSet = new Set(state.discoveredClueIds);
    const completedChainSet = new Set(state.completedChainIds);
    const newlyCompleted: ClueChainDefinition[] = [];

    for (const chain of this.chains.values()) {
      if (completedChainSet.has(chain.id)) {
        continue;
      }
      const allRequiredDiscovered = chain.requiredClueIds.every((reqId) =>
        discoveredClueSet.has(reqId),
      );
      if (allRequiredDiscovered) {
        completedChainSet.add(chain.id);
        newlyCompleted.push(chain);
      }
    }

    if (newlyCompleted.length > 0) {
      const nextFreqs = new Set(state.unlockedFrequencies);
      const nextCodes = new Set(state.unlockedDoorCodes);

      for (const ch of newlyCompleted) {
        if (ch.unlockedFrequency !== undefined) {
          nextFreqs.add(ch.unlockedFrequency);
        }
        if (ch.unlockedDoorCode !== undefined) {
          nextCodes.add(ch.unlockedDoorCode);
        }
      }

      this.store.setState({
        completedChainIds: Array.from(completedChainSet),
        unlockedFrequencies: Array.from(nextFreqs),
        unlockedDoorCodes: Array.from(nextCodes),
      });

      for (const chain of newlyCompleted) {
        this.notifyEvent({
          kind: 'chain-resolved',
          chain,
          timestamp: Date.now(),
        });
      }
    }

    return newlyCompleted;
  }

  // ----- Subscriptions -------------------------------------------------------

  public subscribeEvents(listener: (event: InvestigationEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public subscribeState(listener: (state: InvestigationInternalState) => void): () => void {
    return this.store.subscribe(listener);
  }

  private notifyEvent(event: InvestigationEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[InvestigationStore] Listener error:', err);
      }
    }
  }

  // ----- Snapshot & Persistence (M1.2 Compatible) ----------------------------

  public captureSnapshot(): InvestigationSnapshot {
    const s = this.store.getState();
    return {
      discoveredDocumentIds: [...s.discoveredDocumentIds],
      discoveredClueIds: [...s.discoveredClueIds],
      completedChainIds: [...s.completedChainIds],
      highlightedClueIds: [...s.highlightedClueIds],
      unlockedFrequencies: [...s.unlockedFrequencies],
      unlockedDoorCodes: [...s.unlockedDoorCodes],
    };
  }

  public restoreSnapshot(snapshot: InvestigationSnapshot): void {
    this.store.setState({
      discoveredDocumentIds: [...snapshot.discoveredDocumentIds],
      discoveredClueIds: [...snapshot.discoveredClueIds],
      completedChainIds: [...snapshot.completedChainIds],
      highlightedClueIds: [...snapshot.highlightedClueIds],
      unlockedFrequencies: [...snapshot.unlockedFrequencies],
      unlockedDoorCodes: [...snapshot.unlockedDoorCodes],
    });
  }

  public reset(): void {
    this.store.setState({
      discoveredDocumentIds: [],
      discoveredClueIds: [],
      completedChainIds: [],
      highlightedClueIds: [],
      unlockedFrequencies: [],
      unlockedDoorCodes: [],
    });
  }
}
