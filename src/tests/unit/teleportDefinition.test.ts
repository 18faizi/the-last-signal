import { describe, expect, it } from 'vitest';
import { validateTeleportDefinition } from '../../game/facility/TeleportDefinition';
import type { TeleportDefinition } from '../../game/facility/TeleportDefinition';
import { TeleportRegistry } from '../../game/facility/TeleportRegistry';

const VALID_DEF: TeleportDefinition = {
  id: 'tp-courtyard',
  label: 'Courtyard Centre',
  position: { x: 10, y: 0.1, z: 0 },
  yaw: 0,
};

describe('validateTeleportDefinition', () => {
  it('returns empty array for a valid definition', () => {
    expect(validateTeleportDefinition(VALID_DEF)).toEqual([]);
  });

  it('reports empty id', () => {
    const problems = validateTeleportDefinition({ ...VALID_DEF, id: '   ' });
    expect(problems.some((p) => p.toLowerCase().includes('id'))).toBe(true);
  });

  it('reports empty label', () => {
    const problems = validateTeleportDefinition({ ...VALID_DEF, label: '' });
    expect(problems.some((p) => p.toLowerCase().includes('label'))).toBe(true);
  });

  it('reports non-finite x position', () => {
    const problems = validateTeleportDefinition({
      ...VALID_DEF,
      position: { x: NaN, y: 0, z: 0 },
    });
    expect(problems.some((p) => p.includes('position.x'))).toBe(true);
  });

  it('reports non-finite y position', () => {
    const problems = validateTeleportDefinition({
      ...VALID_DEF,
      position: { x: 0, y: Infinity, z: 0 },
    });
    expect(problems.some((p) => p.includes('position.y'))).toBe(true);
  });

  it('reports non-finite z position', () => {
    const problems = validateTeleportDefinition({
      ...VALID_DEF,
      position: { x: 0, y: 0, z: -Infinity },
    });
    expect(problems.some((p) => p.includes('position.z'))).toBe(true);
  });

  it('reports non-finite yaw', () => {
    const problems = validateTeleportDefinition({ ...VALID_DEF, yaw: NaN });
    expect(problems.some((p) => p.includes('yaw'))).toBe(true);
  });

  it('accepts negative finite coordinates', () => {
    const problems = validateTeleportDefinition({
      ...VALID_DEF,
      position: { x: -100, y: -5, z: -200 },
      yaw: -Math.PI,
    });
    expect(problems).toHaveLength(0);
  });
});

describe('TeleportRegistry', () => {
  it('registers and retrieves a teleport definition', () => {
    const reg = new TeleportRegistry();
    reg.register(VALID_DEF);
    expect(reg.get('tp-courtyard')).toBe(VALID_DEF);
  });

  it('throws on duplicate id', () => {
    const reg = new TeleportRegistry();
    reg.register(VALID_DEF);
    expect(() => reg.register(VALID_DEF)).toThrow(/duplicate/i);
  });

  it('throws on invalid definition', () => {
    const reg = new TeleportRegistry();
    expect(() => reg.register({ ...VALID_DEF, id: '' })).toThrow();
  });

  it('getAll returns all registered definitions', () => {
    const reg = new TeleportRegistry();
    reg.register(VALID_DEF);
    reg.register({ ...VALID_DEF, id: 'tp-gate', label: 'Gate' });
    expect(reg.getAll()).toHaveLength(2);
  });

  it('clear removes all definitions', () => {
    const reg = new TeleportRegistry();
    reg.register(VALID_DEF);
    reg.clear();
    expect(reg.getAll()).toHaveLength(0);
    expect(reg.get('tp-courtyard')).toBeUndefined();
  });

  it('get returns undefined for unknown id', () => {
    const reg = new TeleportRegistry();
    expect(reg.get('nonexistent')).toBeUndefined();
  });
});
