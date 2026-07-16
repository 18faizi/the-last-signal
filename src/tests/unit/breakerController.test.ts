import { describe, expect, it } from 'vitest';
import { PowerNetwork } from '../../game/power/PowerNetwork';
import { BreakerController } from '../../game/electrical/BreakerController';
import { asPowerSourceId } from '../../game/power/PowerSourceId';
import { asPowerCircuitId } from '../../game/power/PowerCircuitId';

const GEN = asPowerSourceId('gen');
const C1 = asPowerCircuitId('c1');

function setup() {
  const net = new PowerNetwork();
  net.registerSource({
    id: GEN,
    kind: 'generator',
    displayName: 'Generator',
    maxCapacity: 10,
    priority: 10,
  });
  net.registerCircuit({
    id: C1,
    displayName: 'C1',
    capacityCost: 4,
    priority: 1,
    description: 'd',
    eligibleSourceIds: [GEN],
    emergencyEligible: false,
  });
  const breaker = new BreakerController(
    { id: 'brk-c1', circuitId: C1, sourceId: GEN, displayName: 'C1' },
    net,
  );
  return { net, breaker };
}

describe('BreakerController', () => {
  it('starts Open', () => {
    const { breaker } = setup();
    expect(breaker.breakerState).toBe('Open');
    expect(breaker.isClosed).toBe(false);
  });

  it('close() fails with the network rejection reason when the source is unavailable', () => {
    const { breaker } = setup();
    const result = breaker.close();
    expect(result.ok).toBe(false);
    expect(breaker.breakerState).toBe('Open');
  });

  it('close() succeeds and energizes the circuit once the source is available', () => {
    const { net, breaker } = setup();
    net.setSourceAvailability(GEN, 'available');
    const result = breaker.close();
    expect(result.ok).toBe(true);
    expect(breaker.isClosed).toBe(true);
    expect(net.isCircuitEnergized(C1)).toBe(true);
  });

  it('open() de-energizes the circuit', () => {
    const { net, breaker } = setup();
    net.setSourceAvailability(GEN, 'available');
    breaker.close();
    breaker.open();
    expect(breaker.breakerState).toBe('Open');
    expect(net.isCircuitEnergized(C1)).toBe(false);
  });

  it('toggle() flips between open and closed', () => {
    const { net, breaker } = setup();
    net.setSourceAvailability(GEN, 'available');
    breaker.toggle();
    expect(breaker.isClosed).toBe(true);
    breaker.toggle();
    expect(breaker.isClosed).toBe(false);
  });

  it('trip() forces Tripped and blocks close() until reset()', () => {
    const { net, breaker } = setup();
    net.setSourceAvailability(GEN, 'available');
    breaker.close();
    breaker.trip();
    expect(breaker.breakerState).toBe('Tripped');
    expect(net.isCircuitEnergized(C1)).toBe(false);
    const result = breaker.close();
    expect(result.ok).toBe(false);
    breaker.reset();
    expect(breaker.breakerState).toBe('Open');
    expect(breaker.close().ok).toBe(true);
  });
});
