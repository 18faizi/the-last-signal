/**
 * Milestone 1.0 — Ending Sequence Controller.
 *
 * Coordinates the scripted in-engine ending cinematic and narrative epilogue
 * corresponding to the chosen pathway (SILENCE, RESPONSE, ARCHIVE).
 */

import type { EndingPathway } from '../flow/GameChapter';

export type EndingPhase = 'idle' | 'initiating' | 'execution' | 'epilogue' | 'completed';

export interface EndingSequenceEvent {
  readonly phase: EndingPhase;
  readonly pathway: EndingPathway;
  readonly text?: string | undefined;
  readonly progress: number; // 0.0 to 1.0
}

export interface EndingCinematicConfig {
  readonly initiatingDurationMs: number;
  readonly executionDurationMs: number;
  readonly epilogueDurationMs: number;
  readonly isFastForward?: boolean;
}

const DEFAULT_CINEMATIC_CONFIG: EndingCinematicConfig = {
  initiatingDurationMs: 4000,
  executionDurationMs: 8000,
  epilogueDurationMs: 12000,
  isFastForward: false,
};

export class EndingSequenceController {
  private currentPhase: EndingPhase = 'idle';
  private currentPathway: EndingPathway | null = null;
  private timerId?: number;
  private readonly listeners = new Set<(event: EndingSequenceEvent) => void>();
  private readonly config: EndingCinematicConfig;

  constructor(config: Partial<EndingCinematicConfig> = {}) {
    this.config = { ...DEFAULT_CINEMATIC_CONFIG, ...config };
  }

  public subscribe(listener: (event: EndingSequenceEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(phase: EndingPhase, progress: number, text?: string): void {
    if (!this.currentPathway) return;
    const event: EndingSequenceEvent = {
      phase,
      pathway: this.currentPathway,
      progress,
      text,
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[EndingSequenceController] Listener error:', err);
      }
    }
  }

  public startEnding(pathway: EndingPathway): void {
    this.currentPathway = pathway;
    this.currentPhase = 'initiating';

    const speed = this.config.isFastForward ? 0.05 : 1.0;
    const initDuration = this.config.initiatingDurationMs * speed;
    const execDuration = this.config.executionDurationMs * speed;
    const epiDuration = this.config.epilogueDurationMs * speed;

    this.notify('initiating', 0.1, this.getPhaseText('initiating', pathway));

    this.timerId = window.setTimeout(() => {
      this.currentPhase = 'execution';
      this.notify('execution', 0.4, this.getPhaseText('execution', pathway));

      this.timerId = window.setTimeout(() => {
        this.currentPhase = 'epilogue';
        this.notify('epilogue', 0.8, this.getPhaseText('epilogue', pathway));

        this.timerId = window.setTimeout(() => {
          this.currentPhase = 'completed';
          this.notify('completed', 1.0);
        }, epiDuration);
      }, execDuration);
    }, initDuration);
  }

  public skipToCompletion(): void {
    if (this.currentPhase === 'idle' || this.currentPhase === 'completed') return;
    if (this.timerId) {
      window.clearTimeout(this.timerId);
    }
    this.currentPhase = 'completed';
    this.notify('completed', 1.0);
  }

  public getCurrentPhase(): EndingPhase {
    return this.currentPhase;
  }

  public getCurrentPathway(): EndingPathway | null {
    return this.currentPathway;
  }

  public getPhaseText(phase: EndingPhase, pathway: EndingPathway): string {
    switch (pathway) {
      case 'SILENCE':
        if (phase === 'initiating')
          return 'Disengaging carrier synchronizer... Severing receiver feed.';
        if (phase === 'execution')
          return 'Main generator breaker tripped. Emergency capacitors draining into ground.';
        if (phase === 'epilogue')
          return 'Station Echo is dark and cold once more. Whatever was calling across the mountains recedes into static. Some doors were never meant to be opened.';
        break;

      case 'RESPONSE':
        if (phase === 'initiating')
          return 'Charging waveguide coupling capacitors... Inverting feedback coil.';
        if (phase === 'execution')
          return 'Broadcasting acknowledgment packet at maximum output. High-voltage arc cracks across the mountain.';
        if (phase === 'epilogue')
          return 'The signal ripples outward into the night, vibrating through the metal structure. In the far distance, across the jagged ridge, a low harmonic pulses in reply. Contact is established.';
        break;

      case 'ARCHIVE':
        if (phase === 'initiating')
          return 'Writing uncompressed telemetry logs to magnetic storage vault.';
        if (phase === 'execution')
          return 'Verification checksum complete. Ejecting hardened encrypted data cartridge.';
        if (phase === 'epilogue')
          return 'The transmission is safely locked in the archive cartridge. You take the cassette and seal the vault. When relief personnel arrive in spring, the truth will be waiting for them.';
        break;
    }
    return '';
  }

  public reset(): void {
    if (this.timerId) {
      window.clearTimeout(this.timerId);
    }
    this.currentPhase = 'idle';
    this.currentPathway = null;
  }
}
