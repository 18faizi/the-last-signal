import { describe, expect, it } from 'vitest';
import { AntennaController, ALIGNED_QUALITY_RATIO } from '../../game/antenna/AntennaController';
import type { AntennaArrayDefinition } from '../../game/antenna/AntennaArrayDefinition';
import { asAntennaArrayId } from '../../game/antenna/AntennaArrayId';

const ARRAY_ID = asAntennaArrayId('array-a');
const ARRAY_B_ID = asAntennaArrayId('array-b');

function makeDef(overrides: Partial<AntennaArrayDefinition> = {}): AntennaArrayDefinition {
  return {
    id: ARRAY_ID,
    displayName: 'Array A',
    role: 'RelayCandidate',
    minAzimuthDeg: -60,
    maxAzimuthDeg: 90,
    minElevationDeg: 0,
    maxElevationDeg: 40,
    minPolarizationDeg: -90,
    maxPolarizationDeg: 90,
    targetAzimuthDeg: 42,
    azimuthToleranceDeg: 8,
    targetElevationDeg: 18,
    elevationToleranceDeg: 6,
    targetPolarizationDeg: -35,
    polarizationToleranceDeg: 12,
    baseGain: 0.8,
    captureWidthDeg: 6,
    maxQuality: 0.95,
    requiredPowerCircuitId: 'circuit-1',
    waveguidePathId: 'waveguide-1',
    receiverCompatible: true,
    selectable: true,
    requiredForProgression: true,
    azimuthSpeedDegPerSecond: 16,
    elevationSpeedDegPerSecond: 12,
    polarizationSpeedDegPerSecond: 25,
    azimuthStepCoarseDeg: 2,
    azimuthStepFineDeg: 0.5,
    elevationStepCoarseDeg: 1.5,
    elevationStepFineDeg: 0.3,
    polarizationStepCoarseDeg: 3,
    polarizationStepFineDeg: 0.5,
    ...overrides,
  };
}

function newController(): AntennaController {
  const c = new AntennaController();
  c.registerArray(makeDef());
  return c;
}

function tick(c: AntennaController, seconds: number, step = 0.1): void {
  const ticks = Math.round(seconds / step);
  for (let i = 0; i < ticks; i++) c.update(step);
}

describe('AntennaController — initial state', () => {
  it('starts unpowered with every array Offline and none selected', () => {
    const c = newController();
    expect(c.isPowered).toBe(false);
    expect(c.getControlState(ARRAY_ID)).toBe('Offline');
    expect(c.selectedArray).toBeNull();
  });

  it('parks at each axis minimum bound by default', () => {
    const c = newController();
    const mech = c.getMechanicalState(ARRAY_ID);
    expect(mech?.currentAzimuthDeg).toBe(-60);
    expect(mech?.currentElevationDeg).toBe(0);
    expect(mech?.currentPolarizationDeg).toBe(-90);
    expect(mech?.parked).toBe(true);
  });
});

describe('AntennaController — power', () => {
  it('powerOn transitions selectable arrays to Idle and allows selection', () => {
    const c = newController();
    c.powerOn();
    expect(c.isPowered).toBe(true);
    expect(c.getControlState(ARRAY_ID)).toBe('Idle');
    expect(c.selectArray(ARRAY_ID)).toBe(true);
    expect(c.selectedArray).toBe(ARRAY_ID);
  });

  it('non-selectable arrays go to Unavailable on power-on, and cannot be selected', () => {
    const c = new AntennaController();
    c.registerArray(makeDef({ selectable: false }));
    c.powerOn();
    expect(c.getControlState(ARRAY_ID)).toBe('Unavailable');
    expect(c.selectArray(ARRAY_ID)).toBe(false);
  });

  it('movement commands fail while unpowered', () => {
    const c = newController();
    c.powerOn();
    c.selectArray(ARRAY_ID);
    c.powerOff();
    expect(c.setAzimuth(10)).toBe(false);
  });

  it('power loss routes every array to Offline and freezes the current position, discarding the pending target', () => {
    const c = newController();
    c.powerOn();
    c.selectArray(ARRAY_ID);
    c.setAzimuth(10);
    tick(c, 0.2); // partial movement
    const midAz = c.getMechanicalState(ARRAY_ID)?.currentAzimuthDeg ?? NaN;
    expect(midAz).toBeGreaterThan(-60); // it moved

    c.powerOff();
    expect(c.getControlState(ARRAY_ID)).toBe('Offline');
    const mech = c.getMechanicalState(ARRAY_ID);
    expect(mech?.currentAzimuthDeg).toBeCloseTo(midAz, 5); // preserved
    expect(mech?.targetAzimuthDeg).toBeNull(); // target cleared
  });

  it('restored power does NOT auto-resume movement — requires explicit re-command', () => {
    const c = newController();
    c.powerOn();
    c.selectArray(ARRAY_ID);
    c.setAzimuth(10);
    tick(c, 0.2);
    const midAz = c.getMechanicalState(ARRAY_ID)?.currentAzimuthDeg ?? NaN;
    c.powerOff();
    c.powerOn();
    // No movement without a fresh command, even though selection persists.
    tick(c, 1);
    expect(c.getMechanicalState(ARRAY_ID)?.currentAzimuthDeg).toBeCloseTo(midAz, 5);
  });
});

describe('AntennaController — mechanical movement', () => {
  it('movement starts, progresses, and completes exactly at the commanded target (no overshoot)', () => {
    const c = newController();
    c.powerOn();
    c.selectArray(ARRAY_ID);
    c.setAzimuth(42);
    expect(c.getControlState(ARRAY_ID)).toBe('Moving');
    tick(c, 20); // generously more than enough time at 16 deg/s over 102 degrees
    const mech = c.getMechanicalState(ARRAY_ID);
    expect(mech?.currentAzimuthDeg).toBeCloseTo(42, 5);
    expect(mech?.targetAzimuthDeg).toBeNull();
  });

  it('movement is frame-rate independent: many small ticks vs fewer larger ticks over the same total time land at the same position', () => {
    const a = newController();
    a.powerOn();
    a.selectArray(ARRAY_ID);
    a.setAzimuth(20);

    const b = newController();
    b.powerOn();
    b.selectArray(ARRAY_ID);
    b.setAzimuth(20);

    tick(a, 0.5, 0.02);
    tick(b, 0.5, 0.1);

    const azA = a.getMechanicalState(ARRAY_ID)?.currentAzimuthDeg ?? NaN;
    const azB = b.getMechanicalState(ARRAY_ID)?.currentAzimuthDeg ?? NaN;
    expect(azA).toBeCloseTo(azB, 3);
  });

  it('reversal: commanding a new target mid-transit redirects smoothly without drift', () => {
    const c = newController();
    c.powerOn();
    c.selectArray(ARRAY_ID);
    c.setAzimuth(80);
    tick(c, 0.3);
    c.setAzimuth(-40);
    tick(c, 20);
    expect(c.getMechanicalState(ARRAY_ID)?.currentAzimuthDeg).toBeCloseTo(-40, 5);
  });

  it('repeated move-to-same-target operations do not accumulate floating-point drift', () => {
    const c = newController();
    c.powerOn();
    c.selectArray(ARRAY_ID);
    for (let i = 0; i < 25; i++) {
      c.setAzimuth(42);
      tick(c, 5);
      c.setAzimuth(-10);
      tick(c, 5);
    }
    c.setAzimuth(42);
    tick(c, 5);
    expect(c.getMechanicalState(ARRAY_ID)?.currentAzimuthDeg).toBe(42);
  });

  it('clamps commanded targets to the array physical range', () => {
    const c = newController();
    c.powerOn();
    c.selectArray(ARRAY_ID);
    c.setAzimuth(999);
    tick(c, 30);
    expect(c.getMechanicalState(ARRAY_ID)?.currentAzimuthDeg).toBe(90); // maxAzimuthDeg
  });
});

describe('AntennaController — emergency stop', () => {
  it('halts motion in place and clears pending targets', () => {
    const c = newController();
    c.powerOn();
    c.selectArray(ARRAY_ID);
    c.setAzimuth(80);
    tick(c, 0.3);
    const posBefore = c.getMechanicalState(ARRAY_ID)?.currentAzimuthDeg ?? NaN;
    c.emergencyStop();
    tick(c, 5); // should not move further
    const posAfter = c.getMechanicalState(ARRAY_ID)?.currentAzimuthDeg ?? NaN;
    expect(posAfter).toBeCloseTo(posBefore, 5);
    expect(c.getMechanicalState(ARRAY_ID)?.targetAzimuthDeg).toBeNull();
  });

  it('a fresh movement command clears the emergency-stopped flag and resumes normal control', () => {
    const c = newController();
    c.powerOn();
    c.selectArray(ARRAY_ID);
    c.setAzimuth(80);
    tick(c, 0.3);
    c.emergencyStop();
    expect(c.getMechanicalState(ARRAY_ID)?.emergencyStopped).toBe(true);
    c.setAzimuth(42);
    expect(c.getMechanicalState(ARRAY_ID)?.emergencyStopped).toBe(false);
    tick(c, 20);
    expect(c.getMechanicalState(ARRAY_ID)?.currentAzimuthDeg).toBeCloseTo(42, 5);
  });
});

describe('AntennaController — park', () => {
  it('commands the array back to its parked (minimum-bound) position', () => {
    const c = newController();
    c.powerOn();
    c.selectArray(ARRAY_ID);
    c.setAzimuth(42);
    c.setElevation(18);
    c.setPolarization(-35);
    tick(c, 20);
    expect(c.getMechanicalState(ARRAY_ID)?.parked).toBe(false);

    c.park();
    tick(c, 30);
    const mech = c.getMechanicalState(ARRAY_ID);
    expect(mech?.currentAzimuthDeg).toBe(-60);
    expect(mech?.currentElevationDeg).toBe(0);
    expect(mech?.currentPolarizationDeg).toBe(-90);
    expect(mech?.parked).toBe(true);
  });
});

describe('AntennaController — Aligned is derived, never set directly', () => {
  it('reaches Aligned only once quality clears the threshold at the exact target, settled', () => {
    const c = newController();
    c.powerOn();
    c.selectArray(ARRAY_ID);
    c.setWaveguideQuality(ARRAY_ID, 1);
    c.setAzimuth(42);
    c.setElevation(18);
    c.setPolarization(-35);
    tick(c, 20);
    const metrics = c.getMetrics(ARRAY_ID);
    expect(metrics?.overallQuality).toBeGreaterThanOrEqual(
      makeDef().maxQuality * ALIGNED_QUALITY_RATIO,
    );
    expect(c.getControlState(ARRAY_ID)).toBe('Aligned');
  });

  it('drops out of Aligned back to Idle/AlignedCandidate when quality degrades (e.g. waveguide breaks)', () => {
    const c = newController();
    c.powerOn();
    c.selectArray(ARRAY_ID);
    c.setWaveguideQuality(ARRAY_ID, 1);
    c.setAzimuth(42);
    c.setElevation(18);
    c.setPolarization(-35);
    tick(c, 20);
    expect(c.getControlState(ARRAY_ID)).toBe('Aligned');

    c.setWaveguideQuality(ARRAY_ID, 0);
    expect(c.getControlState(ARRAY_ID)).not.toBe('Aligned');
  });

  it("a LOW-maxQuality array (e.g. North Dish's deliberately capped 0.6) still reaches Aligned at its own perfect alignment — regression test for a bug where a fixed absolute threshold made low-ceiling arrays unable to ever align", () => {
    const c = new AntennaController();
    c.registerArray(makeDef({ maxQuality: 0.6 }));
    c.powerOn();
    c.selectArray(ARRAY_ID);
    c.setWaveguideQuality(ARRAY_ID, 1);
    c.setAzimuth(42);
    c.setElevation(18);
    c.setPolarization(-35);
    tick(c, 20);
    const metrics = c.getMetrics(ARRAY_ID);
    expect(metrics?.overallQuality).toBeCloseTo(0.6, 5);
    expect(c.getControlState(ARRAY_ID)).toBe('Aligned');
  });
});

describe('AntennaController — events', () => {
  it('fires MovementStarted once per motion session (not once per axis)', () => {
    const c = newController();
    c.powerOn();
    c.selectArray(ARRAY_ID);
    let started = 0;
    c.subscribe((e) => {
      if (e.kind === 'MovementStarted') started++;
    });
    c.setAzimuth(10);
    c.setElevation(10);
    c.setPolarization(10);
    expect(started).toBe(1);
  });

  it('fires MovementCompleted exactly once when all axes settle', () => {
    const c = newController();
    c.powerOn();
    c.selectArray(ARRAY_ID);
    let completed = 0;
    c.subscribe((e) => {
      if (e.kind === 'MovementCompleted') completed++;
    });
    c.setAzimuth(10);
    tick(c, 20);
    expect(completed).toBe(1);
  });

  it('fires Aligned exactly once on entry, not repeatedly while holding alignment', () => {
    const c = newController();
    c.powerOn();
    c.selectArray(ARRAY_ID);
    c.setWaveguideQuality(ARRAY_ID, 1);
    let alignedCount = 0;
    c.subscribe((e) => {
      if (e.kind === 'Aligned') alignedCount++;
    });
    c.setAzimuth(42);
    c.setElevation(18);
    c.setPolarization(-35);
    tick(c, 20);
    tick(c, 5); // hold
    expect(alignedCount).toBe(1);
  });
});

describe('AntennaController — reset', () => {
  it('full reset returns every array to Offline/parked with no selection', () => {
    const c = newController();
    c.powerOn();
    c.selectArray(ARRAY_ID);
    c.setAzimuth(42);
    tick(c, 20);
    c.reset();
    expect(c.isPowered).toBe(false);
    expect(c.selectedArray).toBeNull();
    expect(c.getControlState(ARRAY_ID)).toBe('Offline');
    expect(c.getMechanicalState(ARRAY_ID)?.currentAzimuthDeg).toBe(-60);
  });

  it('repeated resets settle to an identical state (no drift)', () => {
    const c = newController();
    for (let i = 0; i < 5; i++) {
      c.powerOn();
      c.selectArray(ARRAY_ID);
      c.setAzimuth(42);
      tick(c, 3);
      c.reset();
    }
    expect(c.getMechanicalState(ARRAY_ID)?.currentAzimuthDeg).toBe(-60);
  });
});

describe('AntennaController — multiple arrays', () => {
  it('only the selected array is commandable; others remain unaffected', () => {
    const c = new AntennaController();
    c.registerArray(makeDef());
    c.registerArray(makeDef({ id: ARRAY_B_ID, displayName: 'Array B' }));
    c.powerOn();
    c.selectArray(ARRAY_ID);
    c.setAzimuth(42);
    tick(c, 20);
    expect(c.getMechanicalState(ARRAY_ID)?.currentAzimuthDeg).toBeCloseTo(42, 5);
    expect(c.getMechanicalState(ARRAY_B_ID)?.currentAzimuthDeg).toBe(-60); // untouched
  });
});
