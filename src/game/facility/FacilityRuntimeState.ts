/**
 * Typed runtime state for the facility greybox scene.
 *
 * Aggregates zone discovery, door states, pickup collection, checkpoint
 * activation and the current progression phase into a single observable
 * source of truth.  Written only on coarse state changes (zone entered,
 * phase changed, item collected); never written per-frame.
 *
 * Babylon-free.
 */
import type { ProgressionPhase } from './ProgressionPhase';
import { tryAdvancePhase } from './ProgressionPhase';

export type FacilityStateEventKind =
  | 'pickup-collected'
  | 'door-opened'
  | 'zone-discovered'
  | 'checkpoint-activated'
  | 'phase-changed'
  | 'completed'
  | 'reset';

export interface FacilityStateEvent {
  readonly kind: FacilityStateEventKind;
  readonly id?: string;
  readonly phase?: ProgressionPhase;
}

export interface FacilityRuntimeSnapshot {
  readonly progressionPhase: ProgressionPhase;
  readonly isComplete: boolean;
  readonly collectedPickupIds: readonly string[];
  readonly openedDoorIds: readonly string[];
  readonly discoveredZoneIds: readonly string[];
  readonly activatedCheckpointIds: readonly string[];
}

type FacilityStateListener = (event: FacilityStateEvent) => void;

export class FacilityRuntimeState {
  private phase: ProgressionPhase = 'Approach';
  private readonly collectedPickups = new Set<string>();
  private readonly openedDoors = new Set<string>();
  private readonly discoveredZones = new Set<string>();
  private readonly activatedCheckpoints = new Set<string>();
  private complete = false;
  private readonly listeners = new Set<FacilityStateListener>();

  // ----- read ------------------------------------------------------------

  get progressionPhase(): ProgressionPhase {
    return this.phase;
  }

  get isComplete(): boolean {
    return this.complete;
  }

  hasPickup(id: string): boolean {
    return this.collectedPickups.has(id);
  }

  hasDoorOpened(id: string): boolean {
    return this.openedDoors.has(id);
  }

  hasZoneDiscovered(id: string): boolean {
    return this.discoveredZones.has(id);
  }

  hasCheckpointActivated(id: string): boolean {
    return this.activatedCheckpoints.has(id);
  }

  getSnapshot(): FacilityRuntimeSnapshot {
    return {
      progressionPhase: this.phase,
      isComplete: this.complete,
      collectedPickupIds: [...this.collectedPickups],
      openedDoorIds: [...this.openedDoors],
      discoveredZoneIds: [...this.discoveredZones],
      activatedCheckpointIds: [...this.activatedCheckpoints],
    };
  }

  // ----- write -----------------------------------------------------------

  recordPickupCollected(id: string): void {
    if (this.collectedPickups.has(id)) return;
    this.collectedPickups.add(id);
    this.emit({ kind: 'pickup-collected', id });
  }

  recordDoorOpened(id: string): void {
    if (this.openedDoors.has(id)) return;
    this.openedDoors.add(id);
    this.emit({ kind: 'door-opened', id });
  }

  recordZoneDiscovered(id: string): void {
    if (this.discoveredZones.has(id)) return;
    this.discoveredZones.add(id);
    this.emit({ kind: 'zone-discovered', id });
  }

  recordCheckpointActivated(id: string): void {
    if (this.activatedCheckpoints.has(id)) return;
    this.activatedCheckpoints.add(id);
    this.emit({ kind: 'checkpoint-activated', id });
  }

  /**
   * Attempt to advance the progression phase.  Returns true when the phase
   * actually changed.
   */
  tryAdvancePhase(target: ProgressionPhase): boolean {
    const next = tryAdvancePhase(this.phase, target);
    if (next === null) {
      return false;
    }
    this.phase = next;
    this.emit({ kind: 'phase-changed', phase: next });
    if (next === 'GreyboxComplete') {
      this.complete = true;
      this.emit({ kind: 'completed' });
    }
    return true;
  }

  /** Reset all runtime state (preserves registered listeners). */
  reset(): void {
    this.phase = 'Approach';
    this.complete = false;
    this.collectedPickups.clear();
    this.openedDoors.clear();
    this.discoveredZones.clear();
    this.activatedCheckpoints.clear();
    this.emit({ kind: 'reset' });
  }

  // ----- events ----------------------------------------------------------

  subscribe(listener: FacilityStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: FacilityStateEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow.
      }
    }
  }
}
