/**
 * Per-circuit breaker: wraps a PowerNetwork circuit request behind a simple
 * Open/Closed toggle plus fault states. Babylon-free.
 */
import type { PowerNetwork } from '../power/PowerNetwork';
import type { BreakerDefinition } from './BreakerDefinition';
import { isBreakerOperable, type BreakerState } from './BreakerState';

export interface BreakerAttemptResult {
  readonly ok: boolean;
  readonly reason?: string;
}

export class BreakerController {
  readonly definition: BreakerDefinition;
  private readonly network: PowerNetwork;
  private state: BreakerState = 'Open';

  constructor(definition: BreakerDefinition, network: PowerNetwork) {
    this.definition = definition;
    this.network = network;
  }

  get breakerState(): BreakerState {
    return this.state;
  }

  get isClosed(): boolean {
    return this.state === 'Closed';
  }

  close(): BreakerAttemptResult {
    if (!isBreakerOperable(this.state)) {
      return { ok: false, reason: `BREAKER IS ${this.state.toUpperCase()}` };
    }
    if (this.state === 'Closed') return { ok: true };
    const result = this.network.requestCircuit(
      this.definition.circuitId,
      this.definition.sourceId,
      'on',
    );
    if (!result.ok) {
      return { ok: false, reason: result.reason ?? 'REJECTED' };
    }
    this.state = 'Closed';
    return { ok: true };
  }

  open(): BreakerAttemptResult {
    if (!isBreakerOperable(this.state)) {
      return { ok: false, reason: `BREAKER IS ${this.state.toUpperCase()}` };
    }
    if (this.state === 'Open') return { ok: true };
    this.network.requestCircuit(this.definition.circuitId, this.definition.sourceId, 'off');
    this.state = 'Open';
    return { ok: true };
  }

  toggle(): BreakerAttemptResult {
    return this.state === 'Closed' ? this.open() : this.close();
  }

  trip(): void {
    this.network.deEnergizeCircuit(this.definition.circuitId, 'BREAKER TRIPPED');
    this.state = 'Tripped';
  }

  reset(): void {
    this.network.deEnergizeCircuit(this.definition.circuitId, 'BREAKER RESET');
    this.state = 'Open';
  }
}
