/**
 * Hiding state controller (Milestone 0.9). Pure TS.
 *
 * Owns WHICH spot the player occupies and the resulting ConcealmentState;
 * the Babylon/DOM side (HidingSession) owns the camera transition, collider
 * parking, input lock and prompt UI. Key authored rules live here:
 *
 *  - entering while the threat already observes the player does NOT erase
 *    accumulated suspicion — the perception model simply starts seeing a
 *    concealed target from the moment of entry (nothing is reset);
 *  - loud stimuli emitted while hiding still raise suspicion (the stimulus
 *    registry is independent of concealment);
 *  - fully-hiding spots zero VISUAL detection via ConcealmentState.fullyHidden,
 *    consumed by VisionEvaluator's hard override.
 */
import { NOT_CONCEALED, type ConcealmentState } from './ConcealmentState';
import type { HidingSpotDefinition } from './HidingSpotDefinition';
import type { HidingSpotRegistry } from './HidingSpotRegistry';
import type { HidingSpotId } from '../ThreatId';

export type HidingEventKind = 'entered' | 'exited';

export interface HidingEvent {
  readonly kind: HidingEventKind;
  readonly spotId: HidingSpotId;
}

type HidingListener = (event: HidingEvent) => void;

export class HidingController {
  private current: HidingSpotDefinition | null = null;
  private readonly listeners = new Set<HidingListener>();

  constructor(private readonly registry: HidingSpotRegistry) {}

  get isHiding(): boolean {
    return this.current !== null;
  }

  get currentSpot(): HidingSpotDefinition | null {
    return this.current;
  }

  getConcealment(): ConcealmentState {
    if (this.current === null) return NOT_CONCEALED;
    return {
      hidden: true,
      spotId: this.current.id,
      concealment: this.current.concealment,
      fullyHidden: this.current.fullyHiding,
    };
  }

  /** Returns the spot definition on success, null when unknown/occupied/already hiding. */
  enter(spotId: HidingSpotId): HidingSpotDefinition | null {
    if (this.current !== null) return null;
    const def = this.registry.get(spotId);
    if (def === undefined) return null;
    if (!this.registry.tryOccupy(spotId)) return null;
    this.current = def;
    this.emit({ kind: 'entered', spotId });
    return def;
  }

  /** Returns the vacated spot definition, or null when not hiding. */
  exit(): HidingSpotDefinition | null {
    const def = this.current;
    if (def === null) return null;
    this.current = null;
    this.registry.release(def.id);
    this.emit({ kind: 'exited', spotId: def.id });
    return def;
  }

  subscribe(listener: HidingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Full reset (dev "full reset" action only). */
  reset(): void {
    if (this.current !== null) {
      this.exit();
    }
  }

  dispose(): void {
    this.current = null;
    this.listeners.clear();
  }

  private emit(event: HidingEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow.
      }
    }
  }
}
