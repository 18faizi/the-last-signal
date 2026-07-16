import { describe, expect, it } from 'vitest';
import { FacilityRuntimeState } from '../../game/facility/FacilityRuntimeState';

describe('FacilityRuntimeState — Milestone 0.6 power mirror', () => {
  it('starts with power-off defaults', () => {
    const state = new FacilityRuntimeState();
    const snap = state.getSnapshot();
    expect(snap.power.generatorState).toBe('Offline');
    expect(snap.power.fuelValve).toBe('Closed');
    expect(snap.power.starterBattery).toBe('Disconnected');
    expect(snap.power.emergencyStop).toBe('Engaged');
    expect(snap.power.controlSelector).toBe('Off');
    expect(snap.power.mainBreaker).toBe('Open');
    expect(snap.power.receiverActivated).toBe(false);
    expect(snap.power.powerNetworkOperational).toBe(false);
  });

  it('records generator/control field changes into the snapshot', () => {
    const state = new FacilityRuntimeState();
    state.recordGeneratorState('Running');
    state.recordFuelValve('Open');
    state.recordStarterBattery('Connected');
    state.recordEmergencyStop('Released');
    state.recordControlSelector('Manual');
    state.recordMainBreaker('Closed');
    const snap = state.getPowerSnapshot();
    expect(snap.generatorState).toBe('Running');
    expect(snap.fuelValve).toBe('Open');
    expect(snap.starterBattery).toBe('Connected');
    expect(snap.emergencyStop).toBe('Released');
    expect(snap.controlSelector).toBe('Manual');
    expect(snap.mainBreaker).toBe('Closed');
  });

  it('records per-circuit requested/effective state', () => {
    const state = new FacilityRuntimeState();
    state.recordCircuitState('circuit-a', 'on', 'energized');
    const snap = state.getPowerSnapshot();
    expect(snap.circuits['circuit-a']).toEqual({ requested: 'on', effective: 'energized' });
  });

  it('records source availability', () => {
    const state = new FacilityRuntimeState();
    state.recordSourceAvailability('src-generator', 'available');
    expect(state.getPowerSnapshot().sourceAvailability['src-generator']).toBe('available');
  });

  it('recordReceiverActivated and recordPowerMilestoneComplete are idempotent', () => {
    const state = new FacilityRuntimeState();
    const events: string[] = [];
    state.subscribe((e) => events.push(e.kind));
    state.recordReceiverActivated();
    state.recordReceiverActivated();
    expect(state.getPowerSnapshot().receiverActivated).toBe(true);
    expect(events.filter((k) => k === 'power-state-changed')).toHaveLength(1);

    state.recordPowerMilestoneComplete();
    state.recordPowerMilestoneComplete();
    expect(state.getPowerSnapshot().powerNetworkOperational).toBe(true);
  });

  it('reset() clears every power field back to defaults', () => {
    const state = new FacilityRuntimeState();
    state.recordGeneratorState('Running');
    state.recordFuelValve('Open');
    state.recordCircuitState('c', 'on', 'energized');
    state.recordReceiverActivated();
    state.recordPowerMilestoneComplete();

    state.reset();

    const snap = state.getPowerSnapshot();
    expect(snap.generatorState).toBe('Offline');
    expect(snap.fuelValve).toBe('Closed');
    expect(snap.circuits).toEqual({});
    expect(snap.receiverActivated).toBe(false);
    expect(snap.powerNetworkOperational).toBe(false);
  });

  it('does not touch power state on any of the existing pickup/door/zone/phase record methods', () => {
    const state = new FacilityRuntimeState();
    state.recordGeneratorState('Running');
    state.recordPickupCollected('p');
    state.recordDoorOpened('d');
    state.recordZoneDiscovered('z');
    state.tryAdvancePhase('SecurityCheckpoint');
    expect(state.getPowerSnapshot().generatorState).toBe('Running');
  });
});
