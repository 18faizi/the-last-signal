/**
 * Two-stage suspicion -> detection model (Milestone 0.9).
 *
 * Stage one (suspicion, 0-1) accumulates from vision score and sound
 * pressure and decays without stimulus. Stage two (detection, 0-1) only
 * accumulates while the vision score is above an authored floor — sound
 * alone can make the threat suspicious/investigate but never confirms a
 * detection (no omniscience). Detection decays, and decays SLOWER for a
 * while after line of sight breaks (the threat "remembers").
 *
 * Full detection fires exactly ONCE per encounter (armed again only by
 * resetEncounter()). Frame-rate independent: delta is clamped to the same
 * 0.1 s precedent as MAX_ANTENNA_DT_SECONDS, and all rates are per-second.
 * Pure TS, deterministic.
 */
import type { ThreatSuspicionConfig } from '../ThreatDefinition';

export const MAX_SUSPICION_DT_SECONDS = 0.1;

export interface SuspicionInput {
  /** 0-1 vision score from VisionEvaluator. */
  readonly visionScore: number;
  /** 0-1 perceived sound pressure from SoundStimulusRegistry. */
  readonly soundPressure: number;
  /** True while the scene-side LOS probe reports unbroken line of sight. */
  readonly hasLineOfSight: boolean;
}

export interface SuspicionSnapshot {
  readonly suspicion: number;
  readonly detection: number;
  readonly fullDetectionFired: boolean;
  readonly secondsSinceLosBreak: number;
}

export type SuspicionEventKind = 'full-detection';

type SuspicionListener = (kind: SuspicionEventKind) => void;

export class SuspicionController {
  private suspicion = 0;
  private detection = 0;
  private fired = false;
  private secondsSinceLos = Number.POSITIVE_INFINITY;
  private readonly listeners = new Set<SuspicionListener>();

  constructor(private readonly config: ThreatSuspicionConfig) {}

  get currentSuspicion(): number {
    return this.suspicion;
  }

  get currentDetection(): number {
    return this.detection;
  }

  get hasFullDetectionFired(): boolean {
    return this.fired;
  }

  getSnapshot(): SuspicionSnapshot {
    return {
      suspicion: this.suspicion,
      detection: this.detection,
      fullDetectionFired: this.fired,
      secondsSinceLosBreak: this.secondsSinceLos,
    };
  }

  update(deltaSecondsRaw: number, input: SuspicionInput): void {
    const dt = Math.min(Math.max(deltaSecondsRaw, 0), MAX_SUSPICION_DT_SECONDS);
    const c = this.config;

    const pressure = Math.min(Math.max(input.visionScore, 0) + Math.max(input.soundPressure, 0), 1);
    if (pressure > 0) {
      this.suspicion = Math.min(1, this.suspicion + pressure * c.suspicionGainPerSecond * dt);
    } else {
      this.suspicion = Math.max(0, this.suspicion - c.suspicionDecayPerSecond * dt);
    }

    if (input.hasLineOfSight) {
      this.secondsSinceLos = 0;
    } else {
      this.secondsSinceLos = Math.min(this.secondsSinceLos + dt, Number.MAX_SAFE_INTEGER);
    }

    if (input.visionScore >= c.detectionVisionFloor) {
      this.detection = Math.min(
        1,
        this.detection + input.visionScore * c.detectionGainPerSecond * dt,
      );
    } else {
      const decayRate = input.hasLineOfSight
        ? c.detectionDecayPerSecond
        : c.detectionDecayAfterLosBreakPerSecond;
      this.detection = Math.max(0, this.detection - decayRate * dt);
    }

    if (this.detection >= 1 && !this.fired) {
      this.fired = true;
      for (const listener of this.listeners) {
        try {
          listener('full-detection');
        } catch {
          // Swallow.
        }
      }
    }
  }

  /** Encounter reset / new encounter: zero both meters and re-arm the one-shot. */
  resetEncounter(): void {
    this.suspicion = 0;
    this.detection = 0;
    this.fired = false;
    this.secondsSinceLos = Number.POSITIVE_INFINITY;
  }

  subscribe(listener: SuspicionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.listeners.clear();
  }
}
