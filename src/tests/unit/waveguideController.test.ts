import { describe, expect, it } from 'vitest';
import { WaveguideController } from '../../game/waveguide/WaveguideController';
import type { WaveguideDefinition } from '../../game/waveguide/WaveguideDefinition';

const TEST_PORT = { id: 'test-port', displayName: 'Test Port' };
const RECEIVER_A = { id: 'receiver-a', displayName: 'Receiver A' };
const RECEIVER_B = { id: 'receiver-b', displayName: 'Receiver B' };

const MISROUTED_DEF: WaveguideDefinition = {
  id: 'wg-east',
  displayName: 'East Relay Waveguide',
  segments: ['Feed', 'Run', 'Feedthrough', 'Receiver B'],
  ports: [TEST_PORT, RECEIVER_B, RECEIVER_A],
  correctPortId: RECEIVER_B.id,
  defaultPortId: TEST_PORT.id,
  defaultState: 'Misrouted',
};

const CONNECTED_DEF: WaveguideDefinition = {
  id: 'wg-north',
  displayName: 'North Dish Waveguide',
  segments: ['Feed', 'Run', 'Receiver A'],
  ports: [RECEIVER_A, RECEIVER_B],
  correctPortId: RECEIVER_A.id,
  defaultPortId: RECEIVER_A.id,
  defaultState: 'Connected',
};

function newController(): WaveguideController {
  const c = new WaveguideController();
  c.registerPath(MISROUTED_DEF);
  c.registerPath(CONNECTED_DEF);
  return c;
}

describe('WaveguideController — default state', () => {
  it('starts Misrouted per the spec §23 example, with zero continuity', () => {
    const c = newController();
    expect(c.getState('wg-east')).toBe('Misrouted');
    expect(c.getContinuity('wg-east')).toBe(0);
  });

  it('a path defined as already-correct starts Connected with full continuity', () => {
    const c = newController();
    expect(c.getState('wg-north')).toBe('Connected');
    expect(c.getContinuity('wg-north')).toBe(1);
  });
});

describe('WaveguideController — correcting the route', () => {
  it('setPort to the correct port transitions to Connected', () => {
    const c = newController();
    const ok = c.setPort('wg-east', RECEIVER_B.id);
    expect(ok).toBe(true);
    expect(c.getState('wg-east')).toBe('Connected');
    expect(c.getContinuity('wg-east')).toBe(1);
  });

  it('setPort to a wrong (but valid) port stays/returns Misrouted', () => {
    const c = newController();
    c.setPort('wg-east', RECEIVER_A.id);
    expect(c.getState('wg-east')).toBe('Misrouted');
    expect(c.getContinuity('wg-east')).toBe(0);
  });

  it('setPort with an unknown port id is rejected and changes nothing', () => {
    const c = newController();
    const ok = c.setPort('wg-east', 'not-a-real-port');
    expect(ok).toBe(false);
    expect(c.getState('wg-east')).toBe('Misrouted');
  });

  it('setPort on an unknown path id is rejected', () => {
    const c = newController();
    expect(c.setPort('not-a-real-path', RECEIVER_B.id)).toBe(false);
  });

  it('cyclePort advances through candidate ports in order and wraps around', () => {
    const c = newController();
    expect(c.getCurrentPortId('wg-east')).toBe(TEST_PORT.id);
    c.cyclePort('wg-east');
    expect(c.getCurrentPortId('wg-east')).toBe(RECEIVER_B.id);
    expect(c.getState('wg-east')).toBe('Connected');
    c.cyclePort('wg-east');
    expect(c.getCurrentPortId('wg-east')).toBe(RECEIVER_A.id);
    c.cyclePort('wg-east');
    expect(c.getCurrentPortId('wg-east')).toBe(TEST_PORT.id); // wrapped
  });
});

describe('WaveguideController — events', () => {
  it('emits RouteChanged on every route change', () => {
    const c = newController();
    let changed = 0;
    c.subscribe((e) => {
      if (e.kind === 'RouteChanged') changed++;
    });
    c.cyclePort('wg-east');
    c.cyclePort('wg-east');
    expect(changed).toBe(2);
  });

  it('emits RouteCorrected exactly once when transitioning into Connected', () => {
    const c = newController();
    let corrected = 0;
    c.subscribe((e) => {
      if (e.kind === 'RouteCorrected') corrected++;
    });
    c.setPort('wg-east', RECEIVER_B.id);
    expect(corrected).toBe(1);
    // Re-setting the same (already correct) port is a no-op change — no re-fire.
    c.setPort('wg-east', RECEIVER_B.id);
    expect(corrected).toBe(1);
  });

  it('emits RouteBroken when leaving a Connected state for a wrong port', () => {
    const c = newController();
    c.setPort('wg-east', RECEIVER_B.id); // Connected
    let broken = 0;
    c.subscribe((e) => {
      if (e.kind === 'RouteBroken') broken++;
    });
    c.setPort('wg-east', RECEIVER_A.id); // now Misrouted
    expect(broken).toBe(1);
  });
});

describe('WaveguideController — reset', () => {
  it('reset restores every path to its default port/state', () => {
    const c = newController();
    c.setPort('wg-east', RECEIVER_B.id);
    c.setPort('wg-north', RECEIVER_B.id);
    c.reset();
    expect(c.getState('wg-east')).toBe('Misrouted');
    expect(c.getCurrentPortId('wg-east')).toBe(TEST_PORT.id);
    expect(c.getState('wg-north')).toBe('Connected');
    expect(c.getCurrentPortId('wg-north')).toBe(RECEIVER_A.id);
  });

  it('repeated resets settle to identical state', () => {
    const c = newController();
    for (let i = 0; i < 5; i++) {
      c.setPort('wg-east', RECEIVER_B.id);
      c.reset();
    }
    expect(c.getState('wg-east')).toBe('Misrouted');
  });
});

describe('WaveguideController — snapshots', () => {
  it('getAllSnapshots returns every registered path', () => {
    const c = newController();
    const snapshots = c.getAllSnapshots();
    expect(snapshots.map((s) => s.id).sort()).toEqual(['wg-east', 'wg-north']);
  });

  it('listPortOptions returns the full port list for a path', () => {
    const c = newController();
    expect(c.listPortOptions('wg-east').map((p) => p.id)).toEqual([
      TEST_PORT.id,
      RECEIVER_B.id,
      RECEIVER_A.id,
    ]);
  });
});
