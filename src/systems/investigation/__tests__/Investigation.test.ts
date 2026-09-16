/**
 * Investigation & Narrative Clue Chaining System Tests (Milestone 1.3).
 *
 * Verifies document data models, clue discovery, 3D flip math,
 * multi-clue evidence chaining, Event Director condition evaluation,
 * and persistent save/load state serialization.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InvestigationStore } from '../InvestigationStore';
import { STRUCTURED_DOCUMENTS, INVESTIGATION_CLUES, CLUE_CHAINS } from '../clueDefinitions';
import {
  initialInspectionView,
  flipInspectionView,
  DEFAULT_INSPECTION_VIEW_CONFIG,
} from '../../../game/interaction/inspection/InspectionOrientation';
import {
  evaluateCondition,
  type EventConditionContext,
} from '../../../game/event-director/EventCondition';

import type { InvestigationEvent } from '../types';

describe('Investigation & Clue Chaining System (Milestone 1.3)', () => {
  let store: InvestigationStore;

  beforeEach(() => {
    store = new InvestigationStore();
  });

  describe('Document & Clue Catalogs', () => {
    it('contains all 8 narrative-critical documents with valid schemas', () => {
      expect(STRUCTURED_DOCUMENTS.length).toBe(8);

      for (const doc of STRUCTURED_DOCUMENTS) {
        expect(doc.id).toMatch(/^doc-/);
        expect(doc.title.length).toBeGreaterThan(5);
        expect(doc.zoneId).toMatch(/^fz-/);
        expect(doc.pages.length).toBeGreaterThan(0);
        expect(doc.revealedFlag.length).toBeGreaterThan(0);
      }
    });

    it('contains valid environmental clues linked to documents and zones', () => {
      expect(INVESTIGATION_CLUES.length).toBeGreaterThanOrEqual(8);

      for (const clue of INVESTIGATION_CLUES) {
        expect(clue.id).toMatch(/^clue-/);
        expect(clue.title.length).toBeGreaterThan(3);
        expect(clue.description.length).toBeGreaterThan(10);
        expect(clue.zoneId).toMatch(/^fz-/);
        expect(clue.revealedFlag).toMatch(/^clue\./);
      }
    });

    it('contains authored multi-clue chains with valid requirements', () => {
      expect(CLUE_CHAINS.length).toBeGreaterThanOrEqual(4);

      for (const chain of CLUE_CHAINS) {
        expect(chain.id).toMatch(/^chain-/);
        expect(chain.requiredClueIds.length).toBeGreaterThanOrEqual(2);
        // All required clues must exist in the catalog
        for (const reqId of chain.requiredClueIds) {
          expect(INVESTIGATION_CLUES.some((c) => c.id === reqId)).toBe(true);
        }
      }
    });
  });

  describe('InvestigationStore Discovery & Actions', () => {
    it('discovers documents and automatically unmasks associated clues', () => {
      const doc = STRUCTURED_DOCUMENTS[0]; // doc-shift-supervisor-log
      if (!doc) throw new Error('Expected at least one document');
      expect(store.isDocumentDiscovered(doc.id)).toBe(false);

      const isNew = store.discoverDocument(doc.id);
      expect(isNew).toBe(true);
      expect(store.isDocumentDiscovered(doc.id)).toBe(true);

      // Duplicate discovery returns false
      expect(store.discoverDocument(doc.id)).toBe(false);

      // Associated clue should now be discovered
      expect(store.isClueDiscovered('clue-generator-bypass')).toBe(true);
    });

    it('records unlocked frequencies and door codes from discovered documents', () => {
      // Tech note unlocks 104.7 MHz
      store.discoverDocument('doc-signal-technician-note');
      expect(store.getUnlockedFrequencies()).toContain(104.7);

      // Schematic unlocks door code 4189
      store.discoverDocument('doc-facility-schematic-fragment');
      expect(store.getUnlockedDoorCodes()).toContain('4189');
    });

    it('emits typed investigation events upon clue discovery', () => {
      const receivedEvents: InvestigationEvent[] = [];
      store.subscribeEvents((e) => receivedEvents.push(e));

      store.discoverClue('clue-coolant-pressure');

      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0]).toMatchObject({
        kind: 'clue-discovered',
        clue: { id: 'clue-coolant-pressure' },
        isNewlyDiscovered: true,
      });
    });

    it('toggles clue highlighting in the investigation store', () => {
      expect(store.isClueHighlighted('clue-harmonic-carrier')).toBe(false);

      store.highlightClue('clue-harmonic-carrier', true);
      expect(store.isClueHighlighted('clue-harmonic-carrier')).toBe(true);

      store.highlightClue('clue-harmonic-carrier', false);
      expect(store.isClueHighlighted('clue-harmonic-carrier')).toBe(false);
    });
  });

  describe('Multi-Clue Evidence Chaining', () => {
    it('resolves a clue chain only when all constituent clues are discovered', () => {
      const chain = CLUE_CHAINS.find((c) => c.id === 'chain-power-stabilization');
      if (!chain) throw new Error('Expected chain-power-stabilization');
      expect(chain).toBeDefined();

      const receivedEvents: InvestigationEvent[] = [];
      store.subscribeEvents((e) => receivedEvents.push(e));

      // Discover 1st clue only: chain must NOT resolve yet
      store.discoverClue('clue-generator-bypass');
      expect(store.isChainCompleted('chain-power-stabilization')).toBe(false);
      expect(receivedEvents.some((e) => e.kind === 'chain-resolved')).toBe(false);

      // Discover 2nd clue: chain MUST resolve and emit event
      store.discoverClue('clue-coolant-pressure');
      expect(store.isChainCompleted('chain-power-stabilization')).toBe(true);
      expect(receivedEvents.some((e) => e.kind === 'chain-resolved')).toBe(true);
    });

    it('unlocks frequencies and codes defined on completed chains', () => {
      // chain-signal-alignment requires clue-harmonic-carrier and clue-bearing-telemetry
      store.discoverClue('clue-harmonic-carrier');
      store.discoverClue('clue-bearing-telemetry');

      expect(store.isChainCompleted('chain-signal-alignment')).toBe(true);
      expect(store.getUnlockedFrequencies()).toContain(104.7);
    });

    it('returns all completed chains via getCompletedChains', () => {
      store.discoverClue('clue-tunnel-schematic');
      store.discoverClue('clue-directive-104');

      const completed = store.getCompletedChains();
      expect(completed.some((c) => c.id === 'chain-facility-override')).toBe(true);
      expect(store.getUnlockedDoorCodes()).toContain('8472');
    });
  });

  describe('Inspection Orientation & 3D Flipping', () => {
    it('flips inspection yaw by 180 degrees and inverts pitch', () => {
      const initial = initialInspectionView(DEFAULT_INSPECTION_VIEW_CONFIG);
      expect(initial.yaw).toBe(0);
      expect(initial.pitch).toBe(0);

      const flipped = flipInspectionView(initial);
      expect(Math.abs(Math.abs(flipped.yaw) - Math.PI)).toBeLessThan(1e-5);
      expect(flipped.radius).toBe(initial.radius);

      // Flipping twice returns orientation back to original (modulo 2*PI)
      const flippedTwice = flipInspectionView(flipped);
      expect(Math.abs(flippedTwice.yaw)).toBeLessThan(1e-5);
      expect(flippedTwice.pitch).toBe(initial.pitch);
    });
  });

  describe('Event Director Condition Evaluation', () => {
    it('evaluates clue-discovered condition against condition context', () => {
      const mockContext: EventConditionContext = {
        isAntennaRevealComplete: () => false,
        compareThreatPhase: () => 0,
        isZoneDiscovered: () => false,
        isZoneInside: () => false,
        isCircuitEnergized: () => false,
        isSignalDecoded: () => false,
        isDoorOpen: () => false,
        hasInventoryItem: () => false,
        secondsSinceEvent: () => null,
        getThreatState: () => 'Dormant',
        isPlayerInGameplayMode: () => true,
        isEventCompleted: () => false,
        isClueDiscovered: (clueId: string) => store.isClueDiscovered(clueId),
        isClueChainCompleted: (chainId: string) => store.isChainCompleted(chainId),
      };

      expect(
        evaluateCondition(
          { kind: 'clue-discovered', clueId: 'clue-harmonic-carrier' },
          mockContext,
        ),
      ).toBe(false);

      store.discoverClue('clue-harmonic-carrier');

      expect(
        evaluateCondition(
          { kind: 'clue-discovered', clueId: 'clue-harmonic-carrier' },
          mockContext,
        ),
      ).toBe(true);
    });

    it('evaluates clue-chain-completed condition against condition context', () => {
      const mockContext: EventConditionContext = {
        isAntennaRevealComplete: () => false,
        compareThreatPhase: () => 0,
        isZoneDiscovered: () => false,
        isZoneInside: () => false,
        isCircuitEnergized: () => false,
        isSignalDecoded: () => false,
        isDoorOpen: () => false,
        hasInventoryItem: () => false,
        secondsSinceEvent: () => null,
        getThreatState: () => 'Dormant',
        isPlayerInGameplayMode: () => true,
        isEventCompleted: () => false,
        isClueDiscovered: (clueId: string) => store.isClueDiscovered(clueId),
        isClueChainCompleted: (chainId: string) => store.isChainCompleted(chainId),
      };

      expect(
        evaluateCondition(
          { kind: 'clue-chain-completed', chainId: 'chain-containment-truth' },
          mockContext,
        ),
      ).toBe(false);

      store.discoverClue('clue-containment-breach');
      store.discoverClue('clue-perimeter-movement');

      expect(
        evaluateCondition(
          { kind: 'clue-chain-completed', chainId: 'chain-containment-truth' },
          mockContext,
        ),
      ).toBe(true);
    });
  });

  describe('Snapshot Serialization & M1.2 Persistence', () => {
    it('cleanly captures and restores investigation state through save/load cycles', () => {
      store.discoverDocument('doc-shift-supervisor-log');
      store.discoverClue('clue-harmonic-carrier');
      store.discoverClue('clue-bearing-telemetry');
      store.highlightClue('clue-harmonic-carrier', true);

      const snapshot = store.captureSnapshot();

      expect(snapshot.discoveredDocumentIds).toContain('doc-shift-supervisor-log');
      expect(snapshot.discoveredClueIds).toContain('clue-harmonic-carrier');
      expect(snapshot.discoveredClueIds).toContain('clue-bearing-telemetry');
      expect(snapshot.completedChainIds).toContain('chain-signal-alignment');
      expect(snapshot.highlightedClueIds).toContain('clue-harmonic-carrier');
      expect(snapshot.unlockedFrequencies).toContain(104.7);

      // Create a fresh store and restore
      const newStore = new InvestigationStore();
      expect(newStore.isClueDiscovered('clue-harmonic-carrier')).toBe(false);
      expect(newStore.isChainCompleted('chain-signal-alignment')).toBe(false);

      newStore.restoreSnapshot(snapshot);

      expect(newStore.isDocumentDiscovered('doc-shift-supervisor-log')).toBe(true);
      expect(newStore.isClueDiscovered('clue-harmonic-carrier')).toBe(true);
      expect(newStore.isClueDiscovered('clue-bearing-telemetry')).toBe(true);
      expect(newStore.isChainCompleted('chain-signal-alignment')).toBe(true);
      expect(newStore.isClueHighlighted('clue-harmonic-carrier')).toBe(true);
      expect(newStore.getUnlockedFrequencies()).toContain(104.7);
    });

    it('resets store state cleanly', () => {
      store.discoverClue('clue-coolant-pressure');
      expect(store.getDiscoveredClues().length).toBeGreaterThan(0);

      store.reset();

      expect(store.getDiscoveredClues().length).toBe(0);
      expect(store.getDiscoveredDocuments().length).toBe(0);
      expect(store.getCompletedChains().length).toBe(0);
    });
  });
});
