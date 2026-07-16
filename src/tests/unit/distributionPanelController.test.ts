import { describe, expect, it } from 'vitest';
import { PowerNetwork } from '../../game/power/PowerNetwork';
import { BreakerController } from '../../game/electrical/BreakerController';
import { DistributionPanelController } from '../../game/electrical/DistributionPanelController';
import { asPowerSourceId } from '../../game/power/PowerSourceId';
import { asPowerCircuitId } from '../../game/power/PowerCircuitId';

const GEN = asPowerSourceId('gen');
const BATT = asPowerSourceId('batt');
const C1 = asPowerCircuitId('c1');
const C2 = asPowerCircuitId('c2');

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
    displayName: 'Circuit One',
    capacityCost: 4,
    priority: 5,
    description: 'first',
    eligibleSourceIds: [GEN],
    emergencyEligible: false,
  });
  net.registerCircuit({
    id: C2,
    displayName: 'Circuit Two',
    capacityCost: 8,
    priority: 3,
    description: 'second',
    eligibleSourceIds: [GEN],
    emergencyEligible: false,
  });
  const breakers = new Map<ReturnType<typeof asPowerCircuitId>, BreakerController>();
  breakers.set(
    C1,
    new BreakerController({ id: 'brk-c1', circuitId: C1, sourceId: GEN, displayName: 'C1' }, net),
  );
  breakers.set(
    C2,
    new BreakerController({ id: 'brk-c2', circuitId: C2, sourceId: GEN, displayName: 'C2' }, net),
  );
  const panel = new DistributionPanelController(net, breakers, GEN, BATT);
  return { net, panel };
}

describe('DistributionPanelController', () => {
  it('starts closed; openPanel/closePanel toggle isOpen', () => {
    const { panel } = setup();
    expect(panel.isOpen).toBe(false);
    panel.openPanel();
    expect(panel.isOpen).toBe(true);
    panel.closePanel();
    expect(panel.isOpen).toBe(false);
  });

  it('getPanelData reflects generator/battery capacity and every circuit row', () => {
    const { net, panel } = setup();
    net.setSourceAvailability(GEN, 'available');
    const data = panel.getPanelData();
    expect(data.generatorCapacity).toBe(10);
    expect(data.generatorAvailable).toBe(true);
    expect(data.batteryCapacity).toBe(2);
    expect(data.rows).toHaveLength(2);
  });

  it('toggleCircuit closes the breaker and energizes when capacity allows', () => {
    const { net, panel } = setup();
    net.setSourceAvailability(GEN, 'available');
    const rejection = panel.toggleCircuit(C1);
    expect(rejection).toBeNull();
    expect(net.isCircuitEnergized(C1)).toBe(true);
    const row = panel.getPanelData().rows.find((r) => r.circuitId === C1);
    expect(row?.requested).toBe('on');
    expect(row?.effective).toBe('energized');
  });

  it('toggleCircuit rejects cleanly when capacity is insufficient, leaving state untouched', () => {
    const { net, panel } = setup();
    net.setSourceAvailability(GEN, 'available');
    panel.toggleCircuit(C1); // 4/10
    const rejection = panel.toggleCircuit(C2); // needs 8, only 6 left
    expect(rejection).toBeTruthy();
    expect(net.isCircuitEnergized(C2)).toBe(false);
    expect(net.isCircuitEnergized(C1)).toBe(true); // unaffected
  });

  it('toggling twice turns a circuit back off', () => {
    const { net, panel } = setup();
    net.setSourceAvailability(GEN, 'available');
    panel.toggleCircuit(C1);
    panel.toggleCircuit(C1);
    expect(net.isCircuitEnergized(C1)).toBe(false);
  });

  it('toggleCircuit on an unknown circuit id returns a rejection', () => {
    const { panel } = setup();
    const rejection = panel.toggleCircuit(asPowerCircuitId('nope'));
    expect(rejection).toBe('UNKNOWN CIRCUIT');
  });
});
