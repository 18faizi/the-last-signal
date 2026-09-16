/**
 * Investigation & Narrative Clue Chaining System Types (Milestone 1.3).
 *
 * Provides typed data contracts for structured documents with redacted sections,
 * physical prop clues, multi-clue chains, journal telemetry, and serializable snapshots.
 */

import type { NarrativeFactId } from '../../game/narrative/NarrativeFactRegistry';

export type ClueType =
  'document' | 'prop' | 'whiteboard' | 'transmission' | 'schematic' | 'circuit';

export interface RedactedSection {
  readonly page: number;
  readonly index: number;
  readonly redactedPlaceholder?: string;
  readonly unredactedText?: string;
}

export interface StructuredDocument {
  readonly id: string;
  readonly title: string;
  readonly date?: string;
  readonly author?: string;
  readonly zoneId: string;
  readonly pages: readonly string[];
  readonly redactedSections?: readonly RedactedSection[];
  readonly revealedFlag: string;
  readonly unlocksSignalFrequency?: number;
  readonly unlocksDoorCode?: string;
  readonly flipNotes?: string;
  readonly associatedClueIds?: readonly string[];
}

export interface InvestigationClue {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly sourceDocumentId?: string;
  readonly sourcePropId?: string;
  readonly zoneId: string;
  readonly clueType: ClueType;
  readonly linkedClueIds?: readonly string[];
  readonly revealedFlag: string;
  readonly unlocksSignalFrequency?: number;
  readonly unlocksDoorCode?: string;
  readonly narrativeFactId?: NarrativeFactId;
}

export interface ClueChainDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly requiredClueIds: readonly string[];
  readonly resolvedFactId?: NarrativeFactId;
  readonly unlockedFrequency?: number;
  readonly unlockedDoorCode?: string;
  readonly eventDirectorFlag?: string;
}

export interface InvestigationClueDiscoveredEvent {
  readonly kind: 'clue-discovered';
  readonly clue: InvestigationClue;
  readonly isNewlyDiscovered: boolean;
  readonly timestamp: number;
}

export interface ClueChainResolvedEvent {
  readonly kind: 'chain-resolved';
  readonly chain: ClueChainDefinition;
  readonly timestamp: number;
}

export type InvestigationEvent = InvestigationClueDiscoveredEvent | ClueChainResolvedEvent;

export interface InvestigationSnapshot {
  readonly discoveredDocumentIds: readonly string[];
  readonly discoveredClueIds: readonly string[];
  readonly completedChainIds: readonly string[];
  readonly highlightedClueIds: readonly string[];
  readonly unlockedFrequencies: readonly number[];
  readonly unlockedDoorCodes: readonly string[];
}
