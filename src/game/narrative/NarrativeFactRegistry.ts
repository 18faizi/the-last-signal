/**
 * Milestone 1.0 — Narrative Fact Registry.
 *
 * Tracks critical narrative facts discovered across documents, terminals,
 * and environmental observations. Used for gating ending options, debriefing summaries,
 * and persistent game flow state.
 */

export type NarrativeFactId =
  | 'SecurityLogRead'
  | 'GeneratorRestored'
  | 'FirstTransmissionDecoded'
  | 'ImpossibleTimestampNoticed'
  | 'AntennaAligned'
  | 'LocalLoopResultRevealed'
  | 'ThreatEncounterSurvived'
  | 'FinalTerminalAccessed'
  | 'ArchiveEvidenceDiscovered';

export interface NarrativeFactDefinition {
  readonly id: NarrativeFactId;
  readonly title: string;
  readonly description: string;
  readonly category: 'Operational' | 'Signal' | 'Anomaly' | 'Resolution';
}

export const NARRATIVE_FACT_DEFINITIONS: Record<NarrativeFactId, NarrativeFactDefinition> = {
  SecurityLogRead: {
    id: 'SecurityLogRead',
    title: 'Perimeter Evacuation Order',
    description:
      'Security post logs verify personnel evacuated on emergency orders with missing courier delivery.',
    category: 'Operational',
  },
  GeneratorRestored: {
    id: 'GeneratorRestored',
    title: 'Auxiliary Power Online',
    description:
      'The diesel generator was successfully started and routed to the upper control deck.',
    category: 'Operational',
  },
  FirstTransmissionDecoded: {
    id: 'FirstTransmissionDecoded',
    title: 'Demodulated Carrier Broadcast',
    description: 'Incoming transmission decoded: warns against restoring the antenna array.',
    category: 'Signal',
  },
  ImpossibleTimestampNoticed: {
    id: 'ImpossibleTimestampNoticed',
    title: 'Temporal Inconsistency',
    description:
      'Decoded packet contains a timestamp timestamped before the transmission could have originated.',
    category: 'Anomaly',
  },
  AntennaAligned: {
    id: 'AntennaAligned',
    title: 'Antenna Array Waveguides Aligned',
    description: 'Exterior antenna array tuned to peak SNR on bearing 017°.',
    category: 'Signal',
  },
  LocalLoopResultRevealed: {
    id: 'LocalLoopResultRevealed',
    title: 'Closed Loop Echo',
    description:
      'Telemetry source analysis reveals the anomalous signal originates from within the station itself.',
    category: 'Anomaly',
  },
  ThreatEncounterSurvived: {
    id: 'ThreatEncounterSurvived',
    title: 'Station Intrusion Evaded',
    description: 'Evaded the anomalous entity stalking the darkened corridors during blackout.',
    category: 'Resolution',
  },
  FinalTerminalAccessed: {
    id: 'FinalTerminalAccessed',
    title: 'Central Command Access',
    description: 'Gained administrative control of the station master protocol terminal.',
    category: 'Resolution',
  },
  ArchiveEvidenceDiscovered: {
    id: 'ArchiveEvidenceDiscovered',
    title: 'Interim Archive Anomaly Report',
    description:
      'Discovered classified communications report logging recurring 47-minute transmission intervals.',
    category: 'Signal',
  },
};

export interface NarrativeRegistrySnapshot {
  readonly discoveredFacts: readonly NarrativeFactId[];
  readonly discoveryTimestamps: Record<string, number>;
}

export class NarrativeFactRegistry {
  private readonly discoveredFacts = new Set<NarrativeFactId>();
  private readonly discoveryTimestamps = new Map<NarrativeFactId, number>();
  private readonly listeners = new Set<(factId: NarrativeFactId, timestamp: number) => void>();

  public unlockFact(id: NarrativeFactId, timestamp: number = Date.now()): boolean {
    if (this.discoveredFacts.has(id)) {
      return false;
    }
    this.discoveredFacts.add(id);
    this.discoveryTimestamps.set(id, timestamp);

    for (const listener of this.listeners) {
      try {
        listener(id, timestamp);
      } catch (err) {
        console.error('[NarrativeFactRegistry] Listener error:', err);
      }
    }
    return true;
  }

  public hasFact(id: NarrativeFactId): boolean {
    return this.discoveredFacts.has(id);
  }

  public getDiscoveredFacts(): readonly NarrativeFactId[] {
    return Array.from(this.discoveredFacts);
  }

  public getDiscoveryTimestamp(id: NarrativeFactId): number | undefined {
    return this.discoveryTimestamps.get(id);
  }

  public subscribe(listener: (factId: NarrativeFactId, timestamp: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public captureSnapshot(): NarrativeRegistrySnapshot {
    const discoveryTimestamps: Record<string, number> = {};
    for (const [k, v] of this.discoveryTimestamps) {
      discoveryTimestamps[k] = v;
    }
    return {
      discoveredFacts: Array.from(this.discoveredFacts),
      discoveryTimestamps,
    };
  }

  public restoreSnapshot(snapshot: NarrativeRegistrySnapshot): void {
    this.discoveredFacts.clear();
    this.discoveryTimestamps.clear();
    for (const id of snapshot.discoveredFacts) {
      this.discoveredFacts.add(id);
    }
    for (const [k, v] of Object.entries(snapshot.discoveryTimestamps)) {
      this.discoveryTimestamps.set(k as NarrativeFactId, v);
    }
  }

  public reset(): void {
    this.discoveredFacts.clear();
    this.discoveryTimestamps.clear();
  }
}
