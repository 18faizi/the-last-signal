/**
 * Typed threat-domain events + disposable event bus (mirrors AntennaEvent).
 *
 * Everything downstream (scene bindings, event director, UI, progression)
 * subscribes here — no polling of controller internals.
 */
import type { Point3 } from '../facility/FacilityZone';
import type { EncounterId, ThreatId, ThreatNodeId } from './ThreatId';
import type { ThreatState } from './ThreatState';

export type ThreatEventKind =
  | 'ThreatStateChanged'
  | 'ThreatActivated'
  | 'ThreatDeactivated'
  | 'SuspicionRaised'
  | 'SuspicionCleared'
  | 'InvestigationStarted'
  | 'InvestigationCompleted'
  | 'FullDetection'
  | 'PursuitStarted'
  | 'TargetLost'
  | 'SearchStarted'
  | 'SearchExhausted'
  | 'WithdrawStarted'
  | 'WithdrawCompleted'
  | 'NodeReached'
  | 'PlayerCaptured'
  | 'SafeZoneRefusal';

export interface ThreatEvent {
  readonly kind: ThreatEventKind;
  readonly threatId: ThreatId;
  readonly state?: ThreatState;
  readonly previousState?: ThreatState;
  readonly nodeId?: ThreatNodeId;
  readonly position?: Point3;
  readonly encounterId?: EncounterId;
}

type ThreatListener = (event: ThreatEvent) => void;

export class ThreatEventBus {
  private readonly listeners = new Set<ThreatListener>();

  subscribe(listener: ThreatListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: ThreatEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listener errors never break the emitter (established bus discipline).
      }
    }
  }

  dispose(): void {
    this.listeners.clear();
  }
}
