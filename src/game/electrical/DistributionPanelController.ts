/**
 * Orchestrates the distribution panel: open/close bookkeeping, circuit
 * toggle requests routed through the per-circuit BreakerController, and a
 * plain-data snapshot for the UI. Babylon/DOM-free — the panel's world
 * geometry and the DOM dialog observe this through PowerPanelSession.
 */
import type { PowerNetwork } from '../power/PowerNetwork';
import type { PowerCircuitId } from '../power/PowerCircuitId';
import type { PowerSourceId } from '../power/PowerSourceId';
import type { BreakerController } from './BreakerController';

export interface DistributionPanelCircuitRow {
  readonly circuitId: PowerCircuitId;
  readonly displayName: string;
  readonly description: string;
  readonly capacityCost: number;
  readonly requested: 'off' | 'on';
  readonly effective: 'de-energized' | 'energized';
  readonly breakerState: string;
  readonly toggleReason: string | null;
}

export interface DistributionPanelData {
  readonly rows: readonly DistributionPanelCircuitRow[];
  readonly generatorCapacity: number;
  readonly generatorAllocated: number;
  readonly generatorAvailable: boolean;
  readonly batteryCapacity: number;
  readonly batteryAllocated: number;
  readonly batteryAvailable: boolean;
}

export class DistributionPanelController {
  private readonly network: PowerNetwork;
  private readonly breakers: ReadonlyMap<PowerCircuitId, BreakerController>;
  private readonly generatorSourceId: PowerSourceId;
  private readonly batterySourceId: PowerSourceId;
  private open = false;
  private lastRejection: string | null = null;

  constructor(
    network: PowerNetwork,
    breakers: ReadonlyMap<PowerCircuitId, BreakerController>,
    generatorSourceId: PowerSourceId,
    batterySourceId: PowerSourceId,
  ) {
    this.network = network;
    this.breakers = breakers;
    this.generatorSourceId = generatorSourceId;
    this.batterySourceId = batterySourceId;
  }

  get isOpen(): boolean {
    return this.open;
  }

  openPanel(): void {
    this.open = true;
  }

  closePanel(): void {
    this.open = false;
  }

  /** Toggles the breaker for a circuit. Returns a rejection reason, or null on success. */
  toggleCircuit(circuitId: PowerCircuitId): string | null {
    const breaker = this.breakers.get(circuitId);
    if (breaker === undefined) return 'UNKNOWN CIRCUIT';
    const result = breaker.toggle();
    this.lastRejection = result.ok ? null : (result.reason ?? 'REJECTED');
    return this.lastRejection;
  }

  get lastRejectionReason(): string | null {
    return this.lastRejection;
  }

  getPanelData(): DistributionPanelData {
    const rows: DistributionPanelCircuitRow[] = [];
    for (const circuit of this.network.getAllCircuits()) {
      const state = this.network.getCircuitState(circuit.id);
      const breaker = this.breakers.get(circuit.id);
      rows.push({
        circuitId: circuit.id,
        displayName: circuit.displayName,
        description: circuit.description,
        capacityCost: circuit.capacityCost,
        requested: state?.requested ?? 'off',
        effective: state?.effective ?? 'de-energized',
        breakerState: breaker?.breakerState ?? 'Open',
        toggleReason: null,
      });
    }
    const generator = this.network.getSourceState(this.generatorSourceId);
    const generatorDef = this.network.getSourceDefinition(this.generatorSourceId);
    const battery = this.network.getSourceState(this.batterySourceId);
    const batteryDef = this.network.getSourceDefinition(this.batterySourceId);
    return {
      rows,
      generatorCapacity: generatorDef?.maxCapacity ?? 0,
      generatorAllocated: generator?.allocatedCapacity ?? 0,
      generatorAvailable: generator?.availability === 'available',
      batteryCapacity: batteryDef?.maxCapacity ?? 0,
      batteryAllocated: battery?.allocatedCapacity ?? 0,
      batteryAvailable: battery?.availability === 'available',
    };
  }
}
