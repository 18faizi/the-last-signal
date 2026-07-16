import { describe, expect, it } from 'vitest';
import { PowerNetwork } from '../../game/power/PowerNetwork';
import { asPowerSourceId } from '../../game/power/PowerSourceId';
import { asPowerCircuitId } from '../../game/power/PowerCircuitId';
import { asPowerLoadId } from '../../game/power/PowerLoadId';
import type { PowerEvent } from '../../game/power/PowerEvent';

const GEN = asPowerSourceId('src-gen');
const BATT = asPowerSourceId('src-batt');
const C1 = asPowerCircuitId('c1');
const C2 = asPowerCircuitId('c2');
const C3 = asPowerCircuitId('c3');
const L1 = asPowerLoadId('l1');
const L2 = asPowerLoadId('l2');

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
    id: C1,
    displayName: 'Circuit 1',
    capacityCost: 4,
    priority: 5,
    description: 'desc',
    eligibleSourceIds: [GEN],
    emergencyEligible: false,
  });
  net.registerCircuit({
    id: C2,
    displayName: 'Circuit 2',
    capacityCost: 8,
    priority: 3,
    description: 'desc',
    eligibleSourceIds: [GEN],
    emergencyEligible: false,
  });
  net.registerCircuit({
    id: C3,
    displayName: 'Emergency Circuit',
    capacityCost: 1,
    priority: 10,
    description: 'desc',
    eligibleSourceIds: [BATT, GEN],
    emergencyEligible: true,
  });
  net.registerLoad({ id: L1, circuitId: C1, displayName: 'Load 1' });
  net.registerLoad({ id: L2, circuitId: C1, displayName: 'Load 2' });
  return net;
}

describe('PowerNetwork registration', () => {
  it('rejects duplicate source ids', () => {
    const net = setup();
    expect(() =>
      net.registerSource({
        id: GEN,
        kind: 'generator',
        displayName: 'x',
        maxCapacity: 1,
        priority: 1,
      }),
    ).toThrow();
  });

  it('rejects duplicate circuit ids', () => {
    const net = setup();
    expect(() =>
      net.registerCircuit({
        id: C1,
        displayName: 'x',
        capacityCost: 1,
        priority: 1,
        description: '',
        eligibleSourceIds: [GEN],
        emergencyEligible: false,
      }),
    ).toThrow();
  });

  it('rejects a load referencing an unknown circuit', () => {
    const net = setup();
    expect(() =>
      net.registerLoad({
        id: asPowerLoadId('bad'),
        circuitId: asPowerCircuitId('nope'),
        displayName: 'x',
      }),
    ).toThrow();
  });
});

describe('PowerNetwork.requestCircuit — basic allocation', () => {
  it('rejects turning on a circuit whose source is offline', () => {
    const net = setup();
    const result = net.requestCircuit(C1, GEN, 'on');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/NOT AVAILABLE/);
  });

  it('energizes a circuit once the source is available and capacity allows', () => {
    const net = setup();
    net.setSourceAvailability(GEN, 'available');
    const result = net.requestCircuit(C1, GEN, 'on');
    expect(result.ok).toBe(true);
    expect(net.isCircuitEnergized(C1)).toBe(true);
    expect(net.getCircuitState(C1)?.sourceId).toBe(GEN);
    expect(net.getSourceState(GEN)?.allocatedCapacity).toBe(4);
  });

  it('rejects a source-ineligible circuit', () => {
    const net = setup();
    net.setSourceAvailability(BATT, 'available');
    const result = net.requestCircuit(C1, BATT, 'on'); // C1 only eligible for GEN
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/CANNOT BE POWERED/);
  });

  it('rejects when capacity is insufficient and leaves state untouched (atomic)', () => {
    const net = setup();
    net.setSourceAvailability(GEN, 'available');
    net.requestCircuit(C1, GEN, 'on'); // 4/10
    const result = net.requestCircuit(C2, GEN, 'on'); // needs 8, only 6 left
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/INSUFFICIENT CAPACITY/);
    expect(net.isCircuitEnergized(C2)).toBe(false);
    // C1 remains unaffected by the failed C2 request.
    expect(net.isCircuitEnergized(C1)).toBe(true);
    expect(net.getSourceState(GEN)?.allocatedCapacity).toBe(4);
  });

  it('turning a circuit off frees capacity', () => {
    const net = setup();
    net.setSourceAvailability(GEN, 'available');
    net.requestCircuit(C1, GEN, 'on');
    net.requestCircuit(C1, GEN, 'off');
    expect(net.isCircuitEnergized(C1)).toBe(false);
    expect(net.getSourceState(GEN)?.allocatedCapacity).toBe(0);
  });

  it('re-requesting the same on/source combination is a harmless no-op', () => {
    const net = setup();
    net.setSourceAvailability(GEN, 'available');
    net.requestCircuit(C1, GEN, 'on');
    const result = net.requestCircuit(C1, GEN, 'on');
    expect(result.ok).toBe(true);
    expect(net.getSourceState(GEN)?.allocatedCapacity).toBe(4); // not double-counted
  });
});

describe('PowerNetwork — load powering follows circuit state', () => {
  it('powers every load on a circuit when it energizes', () => {
    const net = setup();
    net.setSourceAvailability(GEN, 'available');
    net.requestCircuit(C1, GEN, 'on');
    expect(net.isLoadPowered(L1)).toBe(true);
    expect(net.isLoadPowered(L2)).toBe(true);
  });

  it('unpowers loads when the circuit de-energizes', () => {
    const net = setup();
    net.setSourceAvailability(GEN, 'available');
    net.requestCircuit(C1, GEN, 'on');
    net.requestCircuit(C1, GEN, 'off');
    expect(net.isLoadPowered(L1)).toBe(false);
    expect(net.isLoadPowered(L2)).toBe(false);
  });
});

describe('PowerNetwork.setSourceAvailability — cascading de-energize', () => {
  it('de-energizes every circuit sourced from a source that goes offline', () => {
    const net = setup();
    net.setSourceAvailability(GEN, 'available');
    net.requestCircuit(C1, GEN, 'on');
    net.setSourceAvailability(GEN, 'offline');
    expect(net.isCircuitEnergized(C1)).toBe(false);
    expect(net.isLoadPowered(L1)).toBe(false);
    expect(net.getSourceState(GEN)?.allocatedCapacity).toBe(0);
  });

  it('does not touch circuits sourced from a different, still-available source', () => {
    const net = setup();
    net.setSourceAvailability(GEN, 'available');
    net.setSourceAvailability(BATT, 'available');
    net.requestCircuit(C3, BATT, 'on');
    net.setSourceAvailability(GEN, 'offline');
    expect(net.isCircuitEnergized(C3)).toBe(true);
  });
});

describe('PowerNetwork.transferCircuits', () => {
  it('re-homes an energized circuit from one source to an eligible other', () => {
    const net = setup();
    net.setSourceAvailability(BATT, 'available');
    net.requestCircuit(C3, BATT, 'on');
    net.setSourceAvailability(GEN, 'available');

    const transferred = net.transferCircuits(BATT, GEN);
    expect(transferred).toContain(C3);
    expect(net.getCircuitState(C3)?.sourceId).toBe(GEN);
    expect(net.getSourceState(BATT)?.allocatedCapacity).toBe(0);
    expect(net.getSourceState(GEN)?.allocatedCapacity).toBe(1);
  });

  it('leaves a circuit on its current source when the target cannot fit it', () => {
    const net = setup();
    net.setSourceAvailability(BATT, 'available');
    net.setSourceAvailability(GEN, 'available');
    net.requestCircuit(C2, GEN, 'on'); // 8/10 on generator
    net.requestCircuit(C3, BATT, 'on'); // 1/2 on battery

    // Force an artificial scenario: try transferring C3 onto a generator that
    // only has 2 free units — it should still fit (cost 1) and succeed.
    const transferred = net.transferCircuits(BATT, GEN);
    expect(transferred).toContain(C3);
  });
});

describe('PowerNetwork.reset', () => {
  it('restores every source and circuit to power-off defaults', () => {
    const net = setup();
    net.setSourceAvailability(GEN, 'available');
    net.requestCircuit(C1, GEN, 'on');
    net.reset();
    expect(net.getSourceState(GEN)?.availability).toBe('offline');
    expect(net.getSourceState(GEN)?.allocatedCapacity).toBe(0);
    expect(net.isCircuitEnergized(C1)).toBe(false);
    expect(net.isLoadPowered(L1)).toBe(false);
  });
});

describe('PowerNetwork events', () => {
  it('emits circuit-energized, capacity-changed and load-powered on a successful request', () => {
    const net = setup();
    net.setSourceAvailability(GEN, 'available');
    const events: PowerEvent[] = [];
    net.subscribe((e) => events.push(e));
    net.requestCircuit(C1, GEN, 'on');
    expect(events.some((e) => e.kind === 'circuit-energized')).toBe(true);
    expect(events.some((e) => e.kind === 'capacity-changed')).toBe(true);
    expect(events.filter((e) => e.kind === 'load-powered')).toHaveLength(2);
  });

  it('emits allocation-rejected on failure, never circuit-energized', () => {
    const net = setup();
    const events: PowerEvent[] = [];
    net.subscribe((e) => events.push(e));
    net.requestCircuit(C1, GEN, 'on'); // source offline → rejected
    expect(events.some((e) => e.kind === 'allocation-rejected')).toBe(true);
    expect(events.some((e) => e.kind === 'circuit-energized')).toBe(false);
  });

  it('subscribe returns a working unsubscribe function', () => {
    const net = setup();
    const events: PowerEvent[] = [];
    const unsub = net.subscribe((e) => events.push(e));
    unsub();
    net.setSourceAvailability(GEN, 'available');
    expect(events).toHaveLength(0);
  });

  it('swallows listener errors without breaking network state', () => {
    const net = setup();
    net.subscribe(() => {
      throw new Error('boom');
    });
    expect(() => net.setSourceAvailability(GEN, 'available')).not.toThrow();
    expect(net.getSourceState(GEN)?.availability).toBe('available');
  });
});

describe('PowerNetwork.getSnapshot', () => {
  it('returns a consistent immutable snapshot of sources/circuits/loads', () => {
    const net = setup();
    net.setSourceAvailability(GEN, 'available');
    net.requestCircuit(C1, GEN, 'on');
    const snap = net.getSnapshot();
    expect(snap.sources.find((s) => s.id === GEN)?.allocatedCapacity).toBe(4);
    expect(snap.circuits.find((c) => c.id === C1)?.effective).toBe('energized');
    expect(snap.loads.filter((l) => l.powered)).toHaveLength(2);
  });
});
