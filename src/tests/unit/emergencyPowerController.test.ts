import { describe, expect, it } from 'vitest';
import { PowerNetwork } from '../../game/power/PowerNetwork';
import { EmergencyPowerController } from '../../game/electrical/EmergencyPowerController';
import { asPowerSourceId } from '../../game/power/PowerSourceId';
import { asPowerCircuitId } from '../../game/power/PowerCircuitId';

const GEN = asPowerSourceId('gen');
const BATT = asPowerSourceId('batt');
const EMERGENCY = asPowerCircuitId('emergency');
const CONTROL_ROOM = asPowerCircuitId('control-room');

function setup() {
  const net = new PowerNetwork();
  net.registerSource({
    id: GEN,
    kind: 'generator',
    displayName: 'Generator',
    maxCapacity: 10,
    priority: 10,
  });
  net.registerSource({
    id: BATT,
    kind: 'emergency-battery',
    displayName: 'Battery',
    maxCapacity: 2,
    priority: 1,
  });
  net.registerCircuit({
    id: EMERGENCY,
    displayName: 'Emergency',
    capacityCost: 1,
    priority: 10,
    description: 'd',
    eligibleSourceIds: [BATT, GEN],
    emergencyEligible: true,
  });
  net.registerCircuit({
    id: CONTROL_ROOM,
    displayName: 'Control Room',
    capacityCost: 4,
    priority: 5,
    description: 'd',
    eligibleSourceIds: [GEN],
    emergencyEligible: false,
  });
  const controller = new EmergencyPowerController(net, GEN, BATT);
  return { net, controller };
}

describe('EmergencyPowerController.initializeEmergencyPower', () => {
  it('brings the battery online and energizes every emergency-eligible circuit from it', () => {
    const { net, controller } = setup();
    controller.initializeEmergencyPower();
    expect(net.getSourceState(BATT)?.availability).toBe('available');
    expect(net.isCircuitEnergized(EMERGENCY)).toBe(true);
    expect(net.getCircuitState(EMERGENCY)?.sourceId).toBe(BATT);
    // Non-emergency circuits are untouched.
    expect(net.isCircuitEnergized(CONTROL_ROOM)).toBe(false);
  });
});

describe('EmergencyPowerController.onGeneratorMainBreakerClosed', () => {
  it('makes the generator available and transfers battery-sourced circuits onto it', () => {
    const { net, controller } = setup();
    controller.initializeEmergencyPower();
    const transferred = controller.onGeneratorMainBreakerClosed();
    expect(net.getSourceState(GEN)?.availability).toBe('available');
    expect(transferred).toContain(EMERGENCY);
    expect(net.getCircuitState(EMERGENCY)?.sourceId).toBe(GEN);
    expect(net.getSourceState(BATT)?.allocatedCapacity).toBe(0);
  });
});

describe('EmergencyPowerController.onGeneratorOffline', () => {
  it('takes the generator offline and falls back to battery power for emergency circuits', () => {
    const { net, controller } = setup();
    controller.initializeEmergencyPower();
    controller.onGeneratorMainBreakerClosed();
    expect(net.getCircuitState(EMERGENCY)?.sourceId).toBe(GEN);

    controller.onGeneratorOffline();
    expect(net.getSourceState(GEN)?.availability).toBe('offline');
    // Non-emergency circuits (control room) stay de-energized — no fallback source.
    expect(net.isCircuitEnergized(CONTROL_ROOM)).toBe(false);
    // Emergency circuit was de-energized by the cascade, then picked back up
    // by the battery fallback in the same call.
    expect(net.isCircuitEnergized(EMERGENCY)).toBe(true);
    expect(net.getCircuitState(EMERGENCY)?.sourceId).toBe(BATT);
  });
});
