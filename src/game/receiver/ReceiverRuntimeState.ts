/**
 * Signal-puzzle progression + decoded-transmission bookkeeping.
 *
 * Scope (see SignalProgressionPhase.ts's architecture-decision comment for
 * the full reasoning): this class deliberately does NOT mirror
 * ReceiverController's continuously-changing tuning fields (channel,
 * frequency, gain, filter, phase, live lock/decode progress) — those are
 * already exposed live via `ReceiverController.getSnapshot()`, which is a
 * plain getter (not a per-frame write), and the controller instance is
 * never recreated across checkpoints/respawn, so that state already
 * persists "for free" exactly like PowerNetwork/GeneratorController do.
 * Re-mirroring continuous fields into a second class on every tick would
 * violate the "no per-frame writes to secondary state" discipline for no
 * benefit — this class only records the coarse, EVENT-DRIVEN milestones
 * (phase advances, decoded signal ids), the same discipline
 * FacilityRuntimeState already uses for door/zone/checkpoint events.
 */
import type { SignalId } from '../signal/SignalId';
import { tryAdvanceSignalPhase, type SignalProgressionPhase } from './SignalProgressionPhase';

export type ReceiverRuntimeEventKind = 'phase-changed' | 'signal-decoded' | 'completed' | 'reset';

export interface ReceiverRuntimeEvent {
  readonly kind: ReceiverRuntimeEventKind;
  readonly phase?: SignalProgressionPhase;
  readonly signalId?: SignalId;
}

export interface ReceiverRuntimeSnapshot {
  readonly signalPhase: SignalProgressionPhase;
  readonly decodedSignalIds: readonly SignalId[];
  readonly transcriptAvailable: boolean;
  readonly puzzleComplete: boolean;
}

type ReceiverRuntimeListener = (event: ReceiverRuntimeEvent) => void;

export class ReceiverRuntimeState {
  private phase: SignalProgressionPhase = 'ReceiverOffline';
  private readonly decodedSignalIds = new Set<SignalId>();
  private complete = false;
  private readonly listeners = new Set<ReceiverRuntimeListener>();

  get signalPhase(): SignalProgressionPhase {
    return this.phase;
  }

  get isPuzzleComplete(): boolean {
    return this.complete;
  }

  getSnapshot(): ReceiverRuntimeSnapshot {
    return {
      signalPhase: this.phase,
      decodedSignalIds: [...this.decodedSignalIds],
      transcriptAvailable: this.decodedSignalIds.size > 0,
      puzzleComplete: this.complete,
    };
  }

  /** Returns true when the phase actually changed. */
  tryAdvancePhase(target: SignalProgressionPhase): boolean {
    const next = tryAdvanceSignalPhase(this.phase, target);
    if (next === null) return false;
    this.phase = next;
    this.emit({ kind: 'phase-changed', phase: next });
    if (next === 'SignalPuzzleComplete') {
      this.complete = true;
      this.emit({ kind: 'completed' });
    }
    return true;
  }

  recordDecoded(signalId: SignalId): void {
    if (this.decodedSignalIds.has(signalId)) return;
    this.decodedSignalIds.add(signalId);
    this.emit({ kind: 'signal-decoded', signalId });
  }

  /** Reset all runtime state (preserves registered listeners). Dev "full reset" only. */
  reset(): void {
    this.phase = 'ReceiverOffline';
    this.decodedSignalIds.clear();
    this.complete = false;
    this.emit({ kind: 'reset' });
  }

  subscribe(listener: ReceiverRuntimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ReceiverRuntimeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow.
      }
    }
  }
}
