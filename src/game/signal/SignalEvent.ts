import type { SignalId } from './SignalId';
import type { LimitingFactor } from './ReceiverMetrics';

/**
 * Typed events emitted by the signal domain (SignalLockController,
 * DecodeController, and ReceiverController's scan behavior). One shared
 * union — mirrors PowerEvent.ts's "fields optional per-kind, narrow on
 * kind" pattern — rather than a bespoke type per emitter.
 */
export type SignalEventKind =
  | 'ChannelActivityDetected'
  | 'LockAcquired'
  | 'LockLost'
  | 'DecodeStarted'
  | 'DecodeProgressed'
  | 'DecodePaused'
  | 'DecodeCompleted';

export interface SignalEvent {
  readonly kind: SignalEventKind;
  readonly signalId?: SignalId;
  readonly channel?: number;
  readonly progress?: number;
  readonly limitingFactor?: LimitingFactor;
}

export type SignalListener = (event: SignalEvent) => void;

/** Minimal typed pub/sub used by SignalLockController/DecodeController. */
export class SignalEventBus {
  private readonly listeners = new Set<SignalListener>();

  subscribe(listener: SignalListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: SignalEvent): void {
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
