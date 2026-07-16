import { describe, expect, it, vi } from 'vitest';
import { FacilityRuntimeState } from '../../game/facility/FacilityRuntimeState';
import type { FacilityStateEvent } from '../../game/facility/FacilityRuntimeState';

describe('FacilityRuntimeState', () => {
  it('starts in Approach phase, not complete', () => {
    const state = new FacilityRuntimeState();
    expect(state.progressionPhase).toBe('Approach');
    expect(state.isComplete).toBe(false);
  });

  // ----- Phase advancement -------------------------------------------------

  it('tryAdvancePhase returns true on valid transition', () => {
    const state = new FacilityRuntimeState();
    expect(state.tryAdvancePhase('SecurityCheckpoint')).toBe(true);
    expect(state.progressionPhase).toBe('SecurityCheckpoint');
  });

  it('tryAdvancePhase returns false on invalid transition', () => {
    const state = new FacilityRuntimeState();
    expect(state.tryAdvancePhase('GreyboxComplete')).toBe(false);
    expect(state.progressionPhase).toBe('Approach');
  });

  it('tryAdvancePhase returns false on same-phase (no-op)', () => {
    const state = new FacilityRuntimeState();
    expect(state.tryAdvancePhase('Approach')).toBe(false);
  });

  it('emits phase-changed event on valid transition', () => {
    const state = new FacilityRuntimeState();
    const events: FacilityStateEvent[] = [];
    state.subscribe((e) => events.push(e));

    state.tryAdvancePhase('SecurityCheckpoint');

    const phaseEvent = events.find((e) => e.kind === 'phase-changed');
    expect(phaseEvent).toBeDefined();
    expect(phaseEvent?.phase).toBe('SecurityCheckpoint');
  });

  it('emits completed event when GreyboxComplete is reached', () => {
    const state = new FacilityRuntimeState();
    const events: FacilityStateEvent[] = [];
    state.subscribe((e) => events.push(e));

    // Drive to just before complete
    state.tryAdvancePhase('SecurityCheckpoint');
    state.tryAdvancePhase('CompoundEntered');
    state.tryAdvancePhase('ControlBuildingReached');
    state.tryAdvancePhase('GeneratorAccessed');
    state.tryAdvancePhase('TunnelAccessed');
    state.tryAdvancePhase('StaffQuartersReached');
    state.tryAdvancePhase('SupervisorOfficeReached');
    state.tryAdvancePhase('RooftopAccessed');
    state.tryAdvancePhase('GreyboxComplete');

    expect(state.isComplete).toBe(true);
    expect(events.some((e) => e.kind === 'completed')).toBe(true);
  });

  // ----- Record methods ----------------------------------------------------

  it('recordPickupCollected emits pickup-collected and sets hasPickup', () => {
    const state = new FacilityRuntimeState();
    const events: FacilityStateEvent[] = [];
    state.subscribe((e) => events.push(e));

    state.recordPickupCollected('pickup-1');

    expect(state.hasPickup('pickup-1')).toBe(true);
    expect(events.some((e) => e.kind === 'pickup-collected' && e.id === 'pickup-1')).toBe(true);
  });

  it('recordPickupCollected is idempotent', () => {
    const state = new FacilityRuntimeState();
    const events: FacilityStateEvent[] = [];
    state.subscribe((e) => events.push(e));

    state.recordPickupCollected('pickup-1');
    state.recordPickupCollected('pickup-1');

    const pickupEvents = events.filter((e) => e.kind === 'pickup-collected');
    expect(pickupEvents).toHaveLength(1);
  });

  it('recordDoorOpened emits door-opened and sets hasDoorOpened', () => {
    const state = new FacilityRuntimeState();
    state.recordDoorOpened('door-a');
    expect(state.hasDoorOpened('door-a')).toBe(true);
  });

  it('recordZoneDiscovered emits zone-discovered and sets hasZoneDiscovered', () => {
    const state = new FacilityRuntimeState();
    state.recordZoneDiscovered('zone-1');
    expect(state.hasZoneDiscovered('zone-1')).toBe(true);
  });

  it('recordCheckpointActivated emits checkpoint-activated', () => {
    const state = new FacilityRuntimeState();
    const events: FacilityStateEvent[] = [];
    state.subscribe((e) => events.push(e));

    state.recordCheckpointActivated('cp-1');
    expect(events.some((e) => e.kind === 'checkpoint-activated' && e.id === 'cp-1')).toBe(true);
  });

  // ----- getSnapshot -------------------------------------------------------

  it('getSnapshot returns a consistent plain-data copy', () => {
    const state = new FacilityRuntimeState();
    state.tryAdvancePhase('SecurityCheckpoint');
    state.recordPickupCollected('pickup-a');
    state.recordDoorOpened('door-b');
    state.recordZoneDiscovered('zone-c');

    const snap = state.getSnapshot();
    expect(snap.progressionPhase).toBe('SecurityCheckpoint');
    expect(snap.collectedPickupIds).toContain('pickup-a');
    expect(snap.openedDoorIds).toContain('door-b');
    expect(snap.discoveredZoneIds).toContain('zone-c');
    expect(snap.isComplete).toBe(false);
  });

  // ----- reset -------------------------------------------------------------

  it('reset restores initial state and emits reset event', () => {
    const state = new FacilityRuntimeState();
    const events: FacilityStateEvent[] = [];
    state.subscribe((e) => events.push(e));

    state.tryAdvancePhase('SecurityCheckpoint');
    state.recordPickupCollected('pickup-a');

    state.reset();

    expect(state.progressionPhase).toBe('Approach');
    expect(state.isComplete).toBe(false);
    expect(state.hasPickup('pickup-a')).toBe(false);
    expect(events.some((e) => e.kind === 'reset')).toBe(true);
  });

  // ----- subscribe / unsubscribe -------------------------------------------

  it('subscribe returns an unsubscribe function', () => {
    const state = new FacilityRuntimeState();
    const listener = vi.fn();
    const unsub = state.subscribe(listener);

    state.recordPickupCollected('pickup-x');
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    state.recordPickupCollected('pickup-y');
    expect(listener).toHaveBeenCalledTimes(1); // no more calls
  });

  it('swallows errors thrown by listeners', () => {
    const state = new FacilityRuntimeState();
    state.subscribe(() => {
      throw new Error('listener error');
    });
    expect(() => state.recordPickupCollected('pickup-z')).not.toThrow();
  });
});
