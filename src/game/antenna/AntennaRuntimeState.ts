/**
 * Antenna-alignment / source-analysis progression + sample bookkeeping.
 *
 * Scope (mirrors ReceiverRuntimeState.ts's architecture-decision comment
 * exactly): this class deliberately does NOT re-mirror AntennaController's
 * continuously-changing fields (selected array, mechanical positions,
 * parked flags, per-array quality) or WaveguideController's route state —
 * those are already exposed live via each controller's own `getSnapshot()`
 * (a plain getter, not a per-frame write), and neither controller is ever
 * recreated across checkpoints/respawn, so that state already persists "for
 * free" exactly like PowerNetwork/ReceiverController do. This class only
 * records the coarse, EVENT-DRIVEN milestones (phase advances, which arrays
 * have been sampled, reveal completion) — the same discipline
 * ReceiverRuntimeState/FacilityRuntimeState already use for door/zone/
 * checkpoint/decoded-signal events.
 */
import type { AntennaArrayId } from './AntennaArrayId';
import { tryAdvanceAntennaPhase, type AntennaProgressionPhase } from './AntennaProgressionPhase';

export type AntennaRuntimeEventKind = 'phase-changed' | 'sample-collected' | 'completed' | 'reset';

export interface AntennaRuntimeEvent {
  readonly kind: AntennaRuntimeEventKind;
  readonly phase?: AntennaProgressionPhase;
  readonly arrayId?: AntennaArrayId;
}

export interface AntennaRuntimeSnapshot {
  readonly antennaPhase: AntennaProgressionPhase;
  readonly sampledArrayIds: readonly AntennaArrayId[];
  readonly revealComplete: boolean;
}

type AntennaRuntimeListener = (event: AntennaRuntimeEvent) => void;

export class AntennaRuntimeState {
  private phase: AntennaProgressionPhase = 'Unavailable';
  private readonly sampledArrayIds = new Set<AntennaArrayId>();
  private complete = false;
  private readonly listeners = new Set<AntennaRuntimeListener>();

  get antennaPhase(): AntennaProgressionPhase {
    return this.phase;
  }

  get isRevealComplete(): boolean {
    return this.complete;
  }

  hasSampled(arrayId: AntennaArrayId): boolean {
    return this.sampledArrayIds.has(arrayId);
  }

  getSnapshot(): AntennaRuntimeSnapshot {
    return {
      antennaPhase: this.phase,
      sampledArrayIds: [...this.sampledArrayIds],
      revealComplete: this.complete,
    };
  }

  /** Returns true when the phase actually changed. */
  tryAdvancePhase(target: AntennaProgressionPhase): boolean {
    const next = tryAdvanceAntennaPhase(this.phase, target);
    if (next === null) return false;
    this.phase = next;
    this.emit({ kind: 'phase-changed', phase: next });
    if (next === 'AntennaRevealComplete') {
      this.complete = true;
      this.emit({ kind: 'completed' });
    }
    return true;
  }

  /** Idempotent — recording the same array twice is a no-op (prevents duplicate sample events). */
  recordSampleCollected(arrayId: AntennaArrayId): void {
    if (this.sampledArrayIds.has(arrayId)) return;
    this.sampledArrayIds.add(arrayId);
    this.emit({ kind: 'sample-collected', arrayId });
  }

  /** Reset all runtime state (preserves registered listeners). Dev "full reset" only. */
  reset(): void {
    this.phase = 'Unavailable';
    this.sampledArrayIds.clear();
    this.complete = false;
    this.emit({ kind: 'reset' });
  }

  subscribe(listener: AntennaRuntimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: AntennaRuntimeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow.
      }
    }
  }
}
