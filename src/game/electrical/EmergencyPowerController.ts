/**
 * Emergency/backup power orchestration.
 *
 * Two responsibilities, both expressed purely in terms of PowerNetwork:
 *  1. initializeEmergencyPower() — energizes every emergency-eligible circuit
 *     from the battery at scene boot, before the generator has ever started.
 *  2. onGeneratorMainBreakerClosed() — once the generator comes online, best-
 *     effort re-homes those circuits from the battery onto the generator
 *     (freeing battery capacity), via PowerNetwork.transferCircuits().
 *
 * Babylon-free. Decoupled from GeneratorController/GeneratorEvent — the
 * scene wiring calls onGeneratorMainBreakerClosed() in response to the
 * generator's own MainBreakerClosed event, keeping this file ignorant of the
 * generator domain's event shape.
 */
import type { PowerNetwork } from '../power/PowerNetwork';
import type { PowerSourceId } from '../power/PowerSourceId';

export class EmergencyPowerController {
  private readonly network: PowerNetwork;
  private readonly generatorSourceId: PowerSourceId;
  private readonly batterySourceId: PowerSourceId;

  constructor(
    network: PowerNetwork,
    generatorSourceId: PowerSourceId,
    batterySourceId: PowerSourceId,
  ) {
    this.network = network;
    this.generatorSourceId = generatorSourceId;
    this.batterySourceId = batterySourceId;
  }

  /** Call once at scene boot: battery comes online and powers eligible circuits. */
  initializeEmergencyPower(): void {
    this.network.setSourceAvailability(this.batterySourceId, 'available');
    for (const circuit of this.network.getAllCircuits()) {
      if (circuit.emergencyEligible && circuit.eligibleSourceIds.includes(this.batterySourceId)) {
        this.network.requestCircuit(circuit.id, this.batterySourceId, 'on');
      }
    }
  }

  /** Call when the generator's main breaker closes: transfer battery load onto the generator. */
  onGeneratorMainBreakerClosed(): readonly string[] {
    this.network.setSourceAvailability(this.generatorSourceId, 'available');
    return this.network.transferCircuits(this.batterySourceId, this.generatorSourceId);
  }

  /** Call when the generator goes offline: the battery is the fallback for emergency circuits. */
  onGeneratorOffline(): void {
    this.network.setSourceAvailability(this.generatorSourceId, 'offline');
    for (const circuit of this.network.getAllCircuits()) {
      if (circuit.emergencyEligible && circuit.eligibleSourceIds.includes(this.batterySourceId)) {
        const state = this.network.getCircuitState(circuit.id);
        if (state !== undefined && state.effective === 'de-energized') {
          this.network.requestCircuit(circuit.id, this.batterySourceId, 'on');
        }
      }
    }
  }
}
