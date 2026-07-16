import { describe, expect, it } from 'vitest';
import { GeneratorController } from '../../game/generator/GeneratorController';
import { DEFAULT_GENERATOR_DEFINITION } from '../../game/generator/GeneratorDefinition';
import type { GeneratorEvent } from '../../game/generator/GeneratorEvent';

function readyController(): GeneratorController {
  const c = new GeneratorController();
  c.inspect();
  c.openFuelValve();
  c.connectBattery();
  c.releaseEmergencyStop();
  c.setSelectorManual();
  return c;
}

describe('GeneratorController — initial state', () => {
  it('starts Offline, valve closed, battery disconnected, e-stop engaged, selector off, breaker open', () => {
    const c = new GeneratorController();
    expect(c.generatorState).toBe('Offline');
    const s = c.snapshot;
    expect(s.fuelValve).toBe('Closed');
    expect(s.starterBattery).toBe('Disconnected');
    expect(s.emergencyStop).toBe('Engaged');
    expect(s.selector).toBe('Off');
    expect(s.mainBreaker).toBe('Open');
    expect(s.inspected).toBe(false);
  });
});

describe('GeneratorController — readiness gating', () => {
  it('reports NotReady with a blocking reason before any control is set', () => {
    const c = new GeneratorController();
    c.inspect();
    expect(c.generatorState).toBe('NotReady');
    expect(c.readiness.ready).toBe(false);
    expect(c.readiness.blockingReason).toBeTruthy();
  });

  it('advances to ReadyToStart only once every condition is met, in any order', () => {
    const c = new GeneratorController();
    c.inspect();
    c.setSelectorManual();
    c.releaseEmergencyStop();
    c.connectBattery();
    expect(c.generatorState).toBe('NotReady'); // valve still closed
    c.openFuelValve();
    expect(c.generatorState).toBe('ReadyToStart');
  });

  it('falls back to NotReady if a condition is lost after becoming ready', () => {
    const c = readyController();
    expect(c.generatorState).toBe('ReadyToStart');
    c.closeFuelValve();
    expect(c.generatorState).toBe('NotReady');
  });
});

describe('GeneratorController.attemptStart', () => {
  it('rejects starting when not ReadyToStart, with a reason', () => {
    const c = new GeneratorController();
    const reason = c.attemptStart();
    expect(reason).toBeTruthy();
    expect(c.generatorState).toBe('Offline');
  });

  it('succeeds from ReadyToStart, transitioning through Cranking into RunningUnstable', () => {
    const c = readyController();
    const events: GeneratorEvent[] = [];
    c.subscribe((e) => events.push(e));
    const reason = c.attemptStart();
    expect(reason).toBeNull();
    expect(c.generatorState).toBe('RunningUnstable');
    expect(events.some((e) => e.kind === 'GeneratorCranking')).toBe(true);
    expect(events.some((e) => e.kind === 'GeneratorStarted')).toBe(true);
  });

  it('a depleted starter battery drops readiness (fail-safe: cannot re-enter ReadyToStart)', () => {
    const c = readyController();
    c.simulateBatteryDepletion();
    // Depleting flips readiness (starterBattery no longer 'Connected'), so
    // the controller drops back to NotReady before a crank can even be
    // attempted — attemptStart() rejects with the readiness reason.
    expect(c.generatorState).toBe('NotReady');
    const reason = c.attemptStart();
    expect(reason).toBeTruthy();
    expect(c.generatorState).toBe('NotReady');
  });
});

describe('GeneratorController — warm-up via update()', () => {
  it('stays RunningUnstable until warmUpSeconds has accumulated', () => {
    const c = readyController();
    c.attemptStart();
    c.update(DEFAULT_GENERATOR_DEFINITION.warmUpSeconds / 2);
    expect(c.generatorState).toBe('RunningUnstable');
    expect(c.snapshot.warmUpProgress).toBeCloseTo(0.5, 1);
  });

  it('transitions to Running once warmUpSeconds elapses, emitting GeneratorStable', () => {
    const c = readyController();
    c.attemptStart();
    const events: GeneratorEvent[] = [];
    c.subscribe((e) => events.push(e));
    c.update(DEFAULT_GENERATOR_DEFINITION.warmUpSeconds + 0.1);
    expect(c.generatorState).toBe('Running');
    expect(events.some((e) => e.kind === 'GeneratorStable')).toBe(true);
  });

  it('accumulates delta across multiple update() calls (deterministic accumulator, not a timer)', () => {
    const c = readyController();
    c.attemptStart();
    const step = DEFAULT_GENERATOR_DEFINITION.warmUpSeconds / 4;
    c.update(step);
    c.update(step);
    c.update(step);
    expect(c.generatorState).toBe('RunningUnstable');
    c.update(step + 0.01);
    expect(c.generatorState).toBe('Running');
  });
});

describe('GeneratorController — main breaker', () => {
  it('rejects closing the main breaker while RunningUnstable', () => {
    const c = readyController();
    c.attemptStart();
    const reason = c.closeMainBreaker();
    expect(reason).toMatch(/MAIN BREAKER LOCKED/);
    expect(c.snapshot.mainBreaker).toBe('Open');
  });

  it('allows closing the main breaker once Running', () => {
    const c = readyController();
    c.attemptStart();
    c.update(DEFAULT_GENERATOR_DEFINITION.warmUpSeconds + 0.1);
    const reason = c.closeMainBreaker();
    expect(reason).toBeNull();
    expect(c.snapshot.mainBreaker).toBe('Closed');
  });
});

describe('GeneratorController.stop / emergency stop', () => {
  it('stop() transitions Running → Stopping → back to ReadyToStart (controls untouched, so still satisfied)', () => {
    const c = readyController();
    c.attemptStart();
    c.update(DEFAULT_GENERATOR_DEFINITION.warmUpSeconds + 0.1);
    c.stop();
    expect(c.generatorState).toBe('Stopping');
    c.update(DEFAULT_GENERATOR_DEFINITION.stopDownSeconds + 0.1);
    // stop() only affects the run state — valve/battery/e-stop/selector are
    // untouched, so readiness re-evaluates true and the controller is
    // immediately ready for another start attempt.
    expect(c.generatorState).toBe('ReadyToStart');
  });

  it('stop() settles at NotReady when a control was changed while running', () => {
    const c = readyController();
    c.attemptStart();
    c.update(DEFAULT_GENERATOR_DEFINITION.warmUpSeconds + 0.1);
    c.closeFuelValve(); // simulate the operator shutting the valve before stop completes
    c.stop();
    c.update(DEFAULT_GENERATOR_DEFINITION.stopDownSeconds + 0.1);
    expect(c.generatorState).toBe('NotReady');
  });

  it('opens the main breaker automatically when stop-down completes', () => {
    const c = readyController();
    c.attemptStart();
    c.update(DEFAULT_GENERATOR_DEFINITION.warmUpSeconds + 0.1);
    c.closeMainBreaker();
    c.stop();
    c.update(DEFAULT_GENERATOR_DEFINITION.stopDownSeconds + 0.1);
    expect(c.snapshot.mainBreaker).toBe('Open');
  });

  it('engaging the emergency stop while running forces an immediate stop', () => {
    const c = readyController();
    c.attemptStart();
    c.update(DEFAULT_GENERATOR_DEFINITION.warmUpSeconds + 0.1);
    c.engageEmergencyStop();
    expect(c.generatorState).toBe('Stopping');
  });

  it('engaging the emergency stop while RunningUnstable also forces a stop', () => {
    const c = readyController();
    c.attemptStart();
    expect(c.generatorState).toBe('RunningUnstable');
    c.engageEmergencyStop();
    expect(c.generatorState).toBe('Stopping');
  });
});

describe('GeneratorController.reset', () => {
  it('restores every control to factory defaults', () => {
    const c = readyController();
    c.attemptStart();
    c.reset();
    expect(c.generatorState).toBe('Offline');
    const s = c.snapshot;
    expect(s.fuelValve).toBe('Closed');
    expect(s.starterBattery).toBe('Disconnected');
    expect(s.emergencyStop).toBe('Engaged');
    expect(s.selector).toBe('Off');
    expect(s.mainBreaker).toBe('Open');
    expect(s.inspected).toBe(false);
  });
});

describe('GeneratorController.subscribe', () => {
  it('unsubscribe stops further delivery and listener errors are swallowed', () => {
    const c = new GeneratorController();
    const events: GeneratorEvent[] = [];
    const unsub = c.subscribe((e) => events.push(e));
    unsub();
    c.inspect();
    expect(events).toHaveLength(0);

    c.subscribe(() => {
      throw new Error('boom');
    });
    expect(() => c.openFuelValve()).not.toThrow();
  });
});
