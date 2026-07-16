/**
 * Reusable binding: subscribe to PowerNetwork events for a single circuit or
 * load, invoke a plain callback with the new powered boolean, dispose
 * cleanly. Babylon/DOM-free — the callback (owned by the scene builder) is
 * where emissive swaps / light intensity / interaction-target availability
 * actually happen. This is what room builders use instead of hardcoding
 * `powerNetwork.isCircuitEnergized(...)` checks scattered through geometry
 * code.
 */
import type { PowerNetwork } from '../power/PowerNetwork';
import type { PowerCircuitId } from '../power/PowerCircuitId';
import type { PowerLoadId } from '../power/PowerLoadId';
import type { PowerEvent } from '../power/PowerEvent';

export type PoweredChangeCallback = (powered: boolean) => void;

export class PoweredStateBinding {
  private readonly unsubscribe: () => void;

  private constructor(unsubscribe: () => void) {
    this.unsubscribe = unsubscribe;
  }

  /** Binds to a circuit's energized state. Fires immediately with the current value. */
  static forCircuit(
    network: PowerNetwork,
    circuitId: PowerCircuitId,
    callback: PoweredChangeCallback,
  ): PoweredStateBinding {
    callback(network.isCircuitEnergized(circuitId));
    const unsubscribe = network.subscribe((event: PowerEvent) => {
      if (event.circuitId !== circuitId) return;
      if (event.kind === 'circuit-energized') callback(true);
      else if (event.kind === 'circuit-de-energized') callback(false);
    });
    return new PoweredStateBinding(unsubscribe);
  }

  /** Binds to a load's powered state. Fires immediately with the current value. */
  static forLoad(
    network: PowerNetwork,
    loadId: PowerLoadId,
    callback: PoweredChangeCallback,
  ): PoweredStateBinding {
    callback(network.isLoadPowered(loadId));
    const unsubscribe = network.subscribe((event: PowerEvent) => {
      if (event.loadId !== loadId) return;
      if (event.kind === 'load-powered') callback(true);
      else if (event.kind === 'load-unpowered') callback(false);
    });
    return new PoweredStateBinding(unsubscribe);
  }

  dispose(): void {
    this.unsubscribe();
  }
}
