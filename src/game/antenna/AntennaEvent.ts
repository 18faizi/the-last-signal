import type { AntennaArrayId } from './AntennaArrayId';

/**
 * Typed events emitted by the antenna domain (AntennaController). One shared
 * union — mirrors SignalEvent.ts/PowerEvent.ts's "fields optional per-kind,
 * narrow on kind" pattern.
 */
export type AntennaEventKind =
  | 'ArraySelected'
  | 'MovementStarted'
  | 'MovementCompleted'
  | 'MovementStopped'
  | 'Aligned'
  | 'AlignmentLost'
  | 'PowerLost'
  | 'PowerRestored'
  | 'Parked'
  | 'EmergencyStopped';

export interface AntennaEvent {
  readonly kind: AntennaEventKind;
  readonly arrayId?: AntennaArrayId;
  readonly quality?: number;
}

export type AntennaListener = (event: AntennaEvent) => void;

/** Minimal typed pub/sub used by AntennaController (mirrors SignalEventBus). */
export class AntennaEventBus {
  private readonly listeners = new Set<AntennaListener>();

  subscribe(listener: AntennaListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: AntennaEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow — never let a UI/test listener break domain state.
      }
    }
  }

  dispose(): void {
    this.listeners.clear();
  }
}
