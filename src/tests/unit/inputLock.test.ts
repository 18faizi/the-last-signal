import { describe, expect, it } from 'vitest';
import { InputLockSet } from '../../game/player/InputLock';

describe('InputLockSet', () => {
  it('locks while any token is held', () => {
    const locks = new InputLockSet();
    expect(locks.isLocked).toBe(false);
    const inspection = locks.acquire('inspection');
    expect(locks.isLocked).toBe(true);
    locks.release(inspection);
    expect(locks.isLocked).toBe(false);
  });

  it('releasing one token does not release another', () => {
    const locks = new InputLockSet();
    const inspection = locks.acquire('inspection');
    const documentLock = locks.acquire('document');
    locks.release(inspection);
    expect(locks.isLocked).toBe(true);
    expect(locks.reasons).toEqual(['document']);
    locks.release(documentLock);
    expect(locks.isLocked).toBe(false);
  });

  it('tokens with the same reason are independent', () => {
    const locks = new InputLockSet();
    const a = locks.acquire('inspection');
    const b = locks.acquire('inspection');
    locks.release(a);
    expect(locks.isLocked).toBe(true);
    locks.release(b);
    expect(locks.isLocked).toBe(false);
  });

  it('double release is a harmless no-op', () => {
    const locks = new InputLockSet();
    const token = locks.acquire('document');
    locks.release(token);
    locks.release(token);
    expect(locks.isLocked).toBe(false);
    expect(locks.count).toBe(0);
  });
});
