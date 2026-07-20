/**
 * Sound stimulus registry (Milestone 0.9).
 *
 * Owns the set of live stimuli, expires them efficiently (a single linear
 * sweep on tick over a small bounded set — stimuli are rare, short-lived
 * events, not per-frame emissions), and answers the one question perception
 * asks: "what is the strongest AI-reactable stimulus at this listener
 * position right now?". Pure TS; time is an accumulated clock advanced by
 * the caller's delta — no Date.now() in correctness paths.
 */
import type { Point3 } from '../../facility/FacilityZone';
import { perceivedIntensity, type SoundStimulus, type SoundStimulusSpec } from './SoundStimulus';

export interface StrongestStimulusResult {
  readonly stimulus: SoundStimulus;
  readonly perceived: number;
}

type StimulusListener = (stimulus: SoundStimulus) => void;

export class SoundStimulusRegistry {
  private readonly stimuli: SoundStimulus[] = [];
  private readonly listeners = new Set<StimulusListener>();
  private clock = 0;
  private nextSeq = 1;

  /** Registry clock in seconds (accumulated from update deltas). */
  get now(): number {
    return this.clock;
  }

  get activeCount(): number {
    return this.stimuli.length;
  }

  emit(spec: SoundStimulusSpec): SoundStimulus {
    const stimulus: SoundStimulus = {
      id: `stim-${this.nextSeq}`,
      position: { x: spec.position.x, y: spec.position.y, z: spec.position.z },
      intensity: Math.min(Math.max(spec.intensity, 0), 1),
      radius: Math.max(spec.radius, 0),
      category: spec.category,
      seq: this.nextSeq,
      emittedAt: this.clock,
      durationSeconds: Math.max(spec.durationSeconds, 0),
      source: spec.source,
      aiReactable: spec.aiReactable ?? true,
      zoneId: spec.zoneId ?? null,
    };
    this.nextSeq += 1;
    this.stimuli.push(stimulus);
    for (const listener of this.listeners) {
      try {
        listener(stimulus);
      } catch {
        // Swallow.
      }
    }
    return stimulus;
  }

  /** Advances the clock and drops expired stimuli (swap-remove, no allocation). */
  update(deltaSeconds: number): void {
    this.clock += Math.max(deltaSeconds, 0);
    for (let i = this.stimuli.length - 1; i >= 0; i--) {
      const s = this.stimuli[i];
      if (s === undefined) continue;
      if (this.clock - s.emittedAt >= s.durationSeconds) {
        const last = this.stimuli[this.stimuli.length - 1];
        if (last !== undefined) {
          this.stimuli[i] = last;
        }
        this.stimuli.pop();
      }
    }
  }

  getActive(): readonly SoundStimulus[] {
    return this.stimuli;
  }

  /**
   * Strongest AI-reactable stimulus as perceived from `listener`, or null.
   * Ties resolve to the newest (highest seq) stimulus — deterministic.
   */
  strongestFor(listener: Point3): StrongestStimulusResult | null {
    let best: StrongestStimulusResult | null = null;
    for (const stimulus of this.stimuli) {
      if (!stimulus.aiReactable) continue;
      const perceived = perceivedIntensity(stimulus, listener);
      if (perceived <= 0) continue;
      if (
        best === null ||
        perceived > best.perceived ||
        (perceived === best.perceived && stimulus.seq > best.stimulus.seq)
      ) {
        best = { stimulus, perceived };
      }
    }
    return best;
  }

  /** Notified synchronously for every emitted stimulus (event director, debug). */
  subscribe(listener: StimulusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Drops all live stimuli; clock keeps running (encounter reset path). */
  clearStimuli(): void {
    this.stimuli.length = 0;
  }

  /** Full reset (dev "full reset" action only). Preserves listeners. */
  reset(): void {
    this.stimuli.length = 0;
    this.clock = 0;
    this.nextSeq = 1;
  }

  dispose(): void {
    this.stimuli.length = 0;
    this.listeners.clear();
  }
}
