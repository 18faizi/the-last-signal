/**
 * Decode progress accumulator — only meaningful once SignalLockController
 * reports 'Locked'.
 *
 * Idle       – no lock yet, or was fully reset.
 * InProgress – locked with full holdQuality (1.0); progress accumulates
 *              toward 1 over decodeSeconds of real delta-time.
 * Paused     – "moderate quality degradation": still Locked, but
 *              holdQuality has dipped below 1 (SignalLockController is
 *              draining its hold buffer). Progress is FROZEN, not reset —
 *              the player can recover tuning and resume from where they
 *              left off.
 * Completed  – progress reached 1. Fires DecodeCompleted exactly once;
 *              update() is a no-op afterwards until reset().
 *
 * "Full signal loss" — the lock state machine leaving 'Locked' entirely
 * (Lost/Searching/Candidate/Acquiring) — resets progress to 0 and returns
 * to Idle; a lost lock must be fully reacquired before decoding resumes.
 *
 * Frame-rate independent: dt is clamped to MAX_DECODE_DT_SECONDS (0.1s),
 * matching SignalLockController's delta-spike guard.
 */
import type { SignalId } from './SignalId';
import type { SignalLockState } from './SignalLockController';
import { SignalEventBus, type SignalEvent } from './SignalEvent';

export type DecodeState = 'Idle' | 'InProgress' | 'Paused' | 'Completed';

export interface DecodeConfig {
  readonly signalId: SignalId;
  readonly decodeSeconds: number;
}

export const MAX_DECODE_DT_SECONDS = 0.1;
/** holdQuality at/above this is "full quality"; below is "moderate degradation". */
const FULL_HOLD_QUALITY_THRESHOLD = 1;

export interface DecodeSnapshot {
  readonly state: DecodeState;
  readonly progress: number;
}

export class DecodeController {
  private readonly bus = new SignalEventBus();
  private state: DecodeState = 'Idle';
  private progress = 0;
  private lastEmittedDecile = -1;

  constructor(private readonly config: DecodeConfig) {}

  get decodeState(): DecodeState {
    return this.state;
  }

  get decodeProgress(): number {
    return this.progress;
  }

  get isCompleted(): boolean {
    return this.state === 'Completed';
  }

  getSnapshot(): DecodeSnapshot {
    return { state: this.state, progress: this.progress };
  }

  update(dtSecondsRaw: number, lockState: SignalLockState, holdQuality: number): void {
    if (this.state === 'Completed') return;

    const dt = Math.min(Math.max(dtSecondsRaw, 0), MAX_DECODE_DT_SECONDS);

    if (lockState !== 'Locked') {
      // Full signal loss: reset entirely, regardless of prior partial progress.
      if (this.progress !== 0 || this.state !== 'Idle') {
        this.progress = 0;
        this.state = 'Idle';
        this.lastEmittedDecile = -1;
      }
      return;
    }

    if (holdQuality < FULL_HOLD_QUALITY_THRESHOLD) {
      // Moderate degradation: pause, preserve progress.
      if (this.state === 'InProgress') {
        this.state = 'Paused';
        this.bus.emit({
          kind: 'DecodePaused',
          signalId: this.config.signalId,
          progress: this.progress,
        });
      }
      return;
    }

    const wasIdle = this.state === 'Idle' && this.progress === 0;
    this.state = 'InProgress';
    if (wasIdle) {
      this.bus.emit({ kind: 'DecodeStarted', signalId: this.config.signalId });
    }
    this.progress = Math.min(1, this.progress + dt / Math.max(this.config.decodeSeconds, 1e-3));

    const decile = Math.floor(this.progress * 10);
    if (decile !== this.lastEmittedDecile && this.progress < 1) {
      this.lastEmittedDecile = decile;
      this.bus.emit({
        kind: 'DecodeProgressed',
        signalId: this.config.signalId,
        progress: this.progress,
      });
    }

    if (this.progress >= 1) {
      this.progress = 1;
      this.state = 'Completed';
      this.bus.emit({ kind: 'DecodeCompleted', signalId: this.config.signalId, progress: 1 });
    }
  }

  /** Full reset (dev "full reset" / receiver power-loss path). */
  reset(): void {
    this.state = 'Idle';
    this.progress = 0;
    this.lastEmittedDecile = -1;
  }

  /** Restore from a preserved snapshot (checkpoint/OOB recovery — no event replay). */
  restoreFrom(snapshot: DecodeSnapshot): void {
    this.state = snapshot.state;
    this.progress = snapshot.progress;
    this.lastEmittedDecile =
      snapshot.state === 'Completed' ? 10 : Math.floor(snapshot.progress * 10);
  }

  subscribe(listener: (event: SignalEvent) => void): () => void {
    return this.bus.subscribe(listener);
  }

  dispose(): void {
    this.bus.dispose();
  }
}
