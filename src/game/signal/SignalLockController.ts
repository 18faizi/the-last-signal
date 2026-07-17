/**
 * Lock acquisition state machine, driven by SignalEvaluator's overallQuality.
 *
 * Searching  – no usable carrier (quality below the candidate threshold).
 * Candidate  – a carrier is present (quality ≥ candidate threshold) but not
 *              yet strong enough to begin acquiring lock.
 * Acquiring  – quality ≥ the signal's minLockQuality; acquisitionProgress
 *              accumulates toward 1 over lockAcquisitionSeconds of real
 *              (delta-time) accumulation, frame-rate independent.
 * Locked     – acquisitionProgress reached 1. Fires LockAcquired exactly
 *              once on entry. Holding lock requires quality to stay at or
 *              above minLockQuality; a moderate dip (still ≥ candidate
 *              threshold) drains a separate `holdQuality` buffer gradually
 *              rather than instantly dropping lock, so brief noise blips
 *              don't punish the player. A full drop below the candidate
 *              threshold drains holdQuality to 0 immediately.
 * Lost       – transient: entered for exactly one update() call when
 *              holdQuality hits 0, firing LockLost once, then resolved on
 *              the very next tick into Searching/Candidate/Acquiring based
 *              on current quality.
 *
 * Frame-rate independence: `update(dt, quality)` clamps dt to
 * MAX_DT_SECONDS (0.1s) per call — the same delta-spike guard used by
 * PlayerConfig.maxDeltaTimeSeconds — so a tab-restore stall cannot skip
 * straight through the acquisition/hold timing.
 */
import type { SignalId } from './SignalId';
import { SignalEventBus, type SignalEvent } from './SignalEvent';

export type SignalLockState = 'Searching' | 'Candidate' | 'Acquiring' | 'Locked' | 'Lost';

export interface SignalLockConfig {
  readonly signalId: SignalId;
  readonly minLockQuality: number;
  readonly lockAcquisitionSeconds: number;
}

export const MAX_LOCK_DT_SECONDS = 0.1;
/** Candidate threshold is a fraction of minLockQuality — "some carrier, not enough yet". */
const CANDIDATE_QUALITY_RATIO = 0.5;
/** Acquisition progress decay rate (per second) while quality is in the moderate zone. */
const ACQUIRE_DECAY_PER_SECOND = 0.6;
/** Hold-quality decay rate (per second) once locked but degraded. */
const HOLD_DECAY_PER_SECOND = 0.5;

export interface SignalLockSnapshot {
  readonly state: SignalLockState;
  readonly acquisitionProgress: number;
  readonly holdQuality: number;
}

export class SignalLockController {
  private readonly bus = new SignalEventBus();
  private state: SignalLockState = 'Searching';
  private progress = 0;
  private holdStrength = 0;

  constructor(private readonly config: SignalLockConfig) {}

  get lockState(): SignalLockState {
    return this.state;
  }

  get acquisitionProgress(): number {
    return this.progress;
  }

  get holdQuality(): number {
    return this.holdStrength;
  }

  get isLocked(): boolean {
    return this.state === 'Locked';
  }

  getSnapshot(): SignalLockSnapshot {
    return {
      state: this.state,
      acquisitionProgress: this.progress,
      holdQuality: this.holdStrength,
    };
  }

  private get acquireThreshold(): number {
    return this.config.minLockQuality;
  }

  private get candidateThreshold(): number {
    return this.config.minLockQuality * CANDIDATE_QUALITY_RATIO;
  }

  /**
   * Advance the state machine by `dtSeconds` given this tick's
   * overallQuality (0-1).
   *
   * Searching/Candidate → Acquiring is handled as an intra-tick fallthrough
   * (no `break`/`return` between them) so a cold-start tick that already
   * clears the acquire threshold contributes its accumulation in the SAME
   * call rather than "spending" that tick purely on the state transition —
   * otherwise a caller ticking at exactly lockAcquisitionSeconds worth of
   * dt would fall one tick short of Locked, which would fail frame-rate
   * independence (identical total elapsed time at identical quality must
   * yield identical acquisitionProgress regardless of step granularity).
   * Locked → Lost deliberately does NOT cascade into Lost's own resolution
   * within the same tick — Lost must remain observable for exactly one
   * update() call (see the class doc comment) before resolving next tick.
   */
  update(dtSecondsRaw: number, overallQuality: number): void {
    const dt = Math.min(Math.max(dtSecondsRaw, 0), MAX_LOCK_DT_SECONDS);
    const acquireT = this.acquireThreshold;
    const candidateT = this.candidateThreshold;

    if (this.state === 'Searching') {
      this.progress = 0;
      if (overallQuality >= acquireT) {
        this.state = 'Acquiring';
      } else if (overallQuality >= candidateT) {
        this.state = 'Candidate';
        this.bus.emit({ kind: 'ChannelActivityDetected', signalId: this.config.signalId });
        return;
      } else {
        return;
      }
    }

    if (this.state === 'Candidate') {
      this.progress = 0;
      if (overallQuality >= acquireT) {
        this.state = 'Acquiring';
      } else if (overallQuality < candidateT) {
        this.state = 'Searching';
        return;
      } else {
        return;
      }
    }

    if (this.state === 'Acquiring') {
      if (overallQuality >= acquireT) {
        this.progress = Math.min(
          1,
          this.progress + dt / Math.max(this.config.lockAcquisitionSeconds, 1e-3),
        );
        if (this.progress >= 1) {
          this.state = 'Locked';
          this.holdStrength = 1;
          this.bus.emit({ kind: 'LockAcquired', signalId: this.config.signalId });
        }
      } else if (overallQuality >= candidateT) {
        // Gradual decay: moderate dip, not a full loss.
        this.progress = Math.max(0, this.progress - dt * ACQUIRE_DECAY_PER_SECOND);
        if (this.progress <= 0) {
          this.state = 'Candidate';
        }
      } else {
        // Fast reset: carrier effectively gone.
        this.progress = 0;
        this.state = 'Searching';
      }
      return;
    }

    if (this.state === 'Locked') {
      if (overallQuality >= acquireT) {
        this.holdStrength = 1;
      } else if (overallQuality >= candidateT) {
        this.holdStrength = Math.max(0, this.holdStrength - dt * HOLD_DECAY_PER_SECOND);
        if (this.holdStrength <= 0) {
          this.state = 'Lost';
          this.progress = 0;
          this.bus.emit({ kind: 'LockLost', signalId: this.config.signalId });
        }
      } else {
        // Far below threshold: fast/full loss.
        this.holdStrength = 0;
        this.state = 'Lost';
        this.progress = 0;
        this.bus.emit({ kind: 'LockLost', signalId: this.config.signalId });
      }
      return;
    }

    if (this.state === 'Lost') {
      this.progress = 0;
      this.holdStrength = 0;
      if (overallQuality >= acquireT) {
        this.state = 'Acquiring';
      } else if (overallQuality >= candidateT) {
        this.state = 'Candidate';
      } else {
        this.state = 'Searching';
      }
    }
  }

  /** Full reset to Searching (dev "full reset" / receiver power-loss path). */
  reset(): void {
    this.state = 'Searching';
    this.progress = 0;
    this.holdStrength = 0;
  }

  /** Restore from a preserved snapshot (checkpoint/OOB recovery — no event replay). */
  restoreFrom(snapshot: SignalLockSnapshot): void {
    this.state = snapshot.state;
    this.progress = snapshot.acquisitionProgress;
    this.holdStrength = snapshot.holdQuality;
  }

  subscribe(listener: (event: SignalEvent) => void): () => void {
    return this.bus.subscribe(listener);
  }

  dispose(): void {
    this.bus.dispose();
  }
}
