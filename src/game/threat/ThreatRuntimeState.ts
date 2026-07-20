/**
 * Threat-foundation progression + coarse event bookkeeping (Milestone 0.9).
 *
 * Scope (mirrors AntennaRuntimeState/ReceiverRuntimeState's architecture-
 * decision comment exactly): this class deliberately does NOT mirror the
 * ThreatController's continuously-changing fields (position, suspicion,
 * detection, current route node) — those are exposed live via the
 * controller's own getSnapshot() (a plain getter, never a per-frame write).
 * This class only records the coarse, EVENT-DRIVEN milestones: phase
 * advances, which director events completed, encounter start/completion,
 * manifestations witnessed, hiding spots discovered, safe-zone arrival,
 * withdrawals, and encounter reset counts. Plain data, no high-frequency
 * transforms, no Babylon/DOM.
 */
import type { EncounterId, HidingSpotId, ManifestationId } from './ThreatId';
import { tryAdvanceThreatPhase, type ThreatProgressionPhase } from './ThreatProgressionPhase';

export type ThreatRuntimeEventKind =
  | 'phase-changed'
  | 'director-event-completed'
  | 'encounter-started'
  | 'encounter-completed'
  | 'encounter-reset'
  | 'manifestation-seen'
  | 'hiding-spot-discovered'
  | 'safe-zone-reached'
  | 'threat-withdrawn'
  | 'reset';

export interface ThreatRuntimeEvent {
  readonly kind: ThreatRuntimeEventKind;
  readonly phase?: ThreatProgressionPhase;
  readonly eventId?: string;
  readonly encounterId?: EncounterId;
  readonly manifestationId?: ManifestationId;
  readonly hidingSpotId?: HidingSpotId;
}

export interface ThreatRuntimeSnapshot {
  readonly threatPhase: ThreatProgressionPhase;
  readonly completedEventIds: readonly string[];
  readonly activeEncounterId: EncounterId | null;
  readonly completedEncounterIds: readonly EncounterId[];
  readonly manifestationsSeen: readonly ManifestationId[];
  readonly hidingSpotsDiscovered: readonly HidingSpotId[];
  readonly safeZoneReached: boolean;
  readonly threatWithdrawnCount: number;
  readonly encounterResetCount: number;
  readonly foundationComplete: boolean;
}

type ThreatRuntimeListener = (event: ThreatRuntimeEvent) => void;

export class ThreatRuntimeState {
  private phase: ThreatProgressionPhase = 'Inactive';
  private readonly completedEventIds = new Set<string>();
  private activeEncounter: EncounterId | null = null;
  private readonly completedEncounters = new Set<EncounterId>();
  private readonly manifestationsSeen = new Set<ManifestationId>();
  private readonly hidingSpotsDiscovered = new Set<HidingSpotId>();
  private safeZone = false;
  private withdrawnCount = 0;
  private resetCount = 0;
  private readonly listeners = new Set<ThreatRuntimeListener>();

  get threatPhase(): ThreatProgressionPhase {
    return this.phase;
  }

  get isFoundationComplete(): boolean {
    return this.phase === 'ThreatFoundationComplete';
  }

  get activeEncounterId(): EncounterId | null {
    return this.activeEncounter;
  }

  get encounterResetCount(): number {
    return this.resetCount;
  }

  hasCompletedEvent(eventId: string): boolean {
    return this.completedEventIds.has(eventId);
  }

  hasCompletedEncounter(encounterId: EncounterId): boolean {
    return this.completedEncounters.has(encounterId);
  }

  getSnapshot(): ThreatRuntimeSnapshot {
    return {
      threatPhase: this.phase,
      completedEventIds: [...this.completedEventIds],
      activeEncounterId: this.activeEncounter,
      completedEncounterIds: [...this.completedEncounters],
      manifestationsSeen: [...this.manifestationsSeen],
      hidingSpotsDiscovered: [...this.hidingSpotsDiscovered],
      safeZoneReached: this.safeZone,
      threatWithdrawnCount: this.withdrawnCount,
      encounterResetCount: this.resetCount,
      foundationComplete: this.isFoundationComplete,
    };
  }

  /** Returns true when the phase actually changed. */
  tryAdvancePhase(target: ThreatProgressionPhase): boolean {
    const next = tryAdvanceThreatPhase(this.phase, target);
    if (next === null) return false;
    this.phase = next;
    this.emit({ kind: 'phase-changed', phase: next });
    return true;
  }

  /** Idempotent — recording the same director event twice is a no-op. */
  recordEventCompleted(eventId: string): void {
    if (this.completedEventIds.has(eventId)) return;
    this.completedEventIds.add(eventId);
    this.emit({ kind: 'director-event-completed', eventId });
  }

  recordEncounterStarted(encounterId: EncounterId): void {
    if (this.activeEncounter === encounterId) return;
    this.activeEncounter = encounterId;
    this.emit({ kind: 'encounter-started', encounterId });
  }

  /** One-shot per encounter id — a second completion is a no-op. */
  recordEncounterCompleted(encounterId: EncounterId): void {
    if (this.completedEncounters.has(encounterId)) return;
    this.completedEncounters.add(encounterId);
    if (this.activeEncounter === encounterId) {
      this.activeEncounter = null;
    }
    this.emit({ kind: 'encounter-completed', encounterId });
  }

  /** Encounter failure: bumps the reset counter, keeps the encounter active. */
  recordEncounterReset(encounterId: EncounterId): void {
    this.resetCount += 1;
    this.emit({ kind: 'encounter-reset', encounterId });
  }

  recordManifestationSeen(manifestationId: ManifestationId): void {
    if (this.manifestationsSeen.has(manifestationId)) return;
    this.manifestationsSeen.add(manifestationId);
    this.emit({ kind: 'manifestation-seen', manifestationId });
  }

  recordHidingSpotDiscovered(hidingSpotId: HidingSpotId): void {
    if (this.hidingSpotsDiscovered.has(hidingSpotId)) return;
    this.hidingSpotsDiscovered.add(hidingSpotId);
    this.emit({ kind: 'hiding-spot-discovered', hidingSpotId });
  }

  recordSafeZoneReached(): void {
    if (this.safeZone) return;
    this.safeZone = true;
    this.emit({ kind: 'safe-zone-reached' });
  }

  recordThreatWithdrawn(): void {
    this.withdrawnCount += 1;
    this.emit({ kind: 'threat-withdrawn' });
  }

  /** Full reset (dev "full reset" action only). Preserves listeners. */
  reset(): void {
    this.phase = 'Inactive';
    this.completedEventIds.clear();
    this.activeEncounter = null;
    this.completedEncounters.clear();
    this.manifestationsSeen.clear();
    this.hidingSpotsDiscovered.clear();
    this.safeZone = false;
    this.withdrawnCount = 0;
    this.resetCount = 0;
    this.emit({ kind: 'reset' });
  }

  subscribe(listener: ThreatRuntimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ThreatRuntimeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow.
      }
    }
  }
}
