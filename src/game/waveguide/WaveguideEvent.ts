/**
 * Typed events emitted by WaveguideController. Mirrors AntennaEvent.ts/
 * SignalEvent.ts's "fields optional per-kind, narrow on kind" pattern.
 */
export type WaveguideEventKind = 'RouteChanged' | 'RouteCorrected' | 'RouteBroken';

export interface WaveguideEvent {
  readonly kind: WaveguideEventKind;
  readonly pathId?: string;
  readonly portId?: string;
}

export type WaveguideListener = (event: WaveguideEvent) => void;

export class WaveguideEventBus {
  private readonly listeners = new Set<WaveguideListener>();

  subscribe(listener: WaveguideListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: WaveguideEvent): void {
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
